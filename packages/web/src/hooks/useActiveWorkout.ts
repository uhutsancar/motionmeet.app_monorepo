import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuthContext } from "../context/AuthProvider";
import toast from 'react-hot-toast';
import {
    createOperationId,
    elapsedWorkoutSeconds,
    parseDecimalInput,
    type Exercise,
    type ExerciseSet,
    type Routine,
} from '@motionmeet/shared';
import { createWorkout } from '~/api/endpoints';

export interface ActiveWorkoutSet extends Omit<ExerciseSet, "weight" | "reps"> { weight: number | string; reps: number | string }
export interface ActiveWorkoutExercise { exerciseId: Exercise; sets: ActiveWorkoutSet[] }

/**
 * Wall-clock bookkeeping for the session. Duration is active time: from the
 * start, minus every pause. It is computed from these instants rather than
 * counted per tick, because a background tab's timers are throttled.
 */
interface WorkoutClock { startedAt: number; pausedAt: number | null; pausedMs: number }

/**
 * What survives a reload or a closed tab. One per member and routine; the
 * routine itself is kept so the page can be rebuilt without the router state.
 */
interface StoredWorkoutDraft {
    version: 1;
    ownerId: string;
    routine: Routine;
    clock: WorkoutClock;
    exercises: ActiveWorkoutExercise[];
    /** Fixed at the first save attempt so a lost response cannot save twice. */
    operationId: string | null;
}

const draftKey = (ownerId: string): string => `mm_active_workout:${ownerId}`;

const readDraft = (ownerId: string | undefined): StoredWorkoutDraft | null => {
    if (!ownerId) return null;
    try {
        const parsed = JSON.parse(localStorage.getItem(draftKey(ownerId)) ?? 'null') as Partial<StoredWorkoutDraft> | null;
        if (parsed?.version !== 1 || parsed.ownerId !== ownerId || !parsed.routine?._id || !parsed.clock || !Array.isArray(parsed.exercises)) return null;
        return parsed as StoredWorkoutDraft;
    } catch {
        return null;
    }
};

const writeDraft = (draft: StoredWorkoutDraft): void => {
    try { localStorage.setItem(draftKey(draft.ownerId), JSON.stringify(draft)); } catch { /* storage full or blocked: the session still works, it just won't survive a reload */ }
};

const clearDraft = (ownerId: string | undefined): void => {
    if (!ownerId) return;
    try { localStorage.removeItem(draftKey(ownerId)); } catch { /* nothing to clear */ }
};

const exercisesFromRoutine = (routine: Routine): ActiveWorkoutExercise[] =>
    routine.exercises.flatMap((exercise) => {
        if (!exercise.exerciseId || typeof exercise.exerciseId === "string") return [];
        return [{ exerciseId: exercise.exerciseId, sets: exercise.sets.map((set) => ({ ...set, completed: false })) }];
    });

const weightOf = (set: ActiveWorkoutSet): number => parseDecimalInput(String(set.weight ?? '')) ?? 0;
const repsOf = (set: ActiveWorkoutSet): number => Math.round(parseDecimalInput(String(set.reps ?? '')) ?? 0);

const completedSets = (exercises: ActiveWorkoutExercise[]) => exercises.map((exercise) => ({
    exercise,
    sets: exercise.sets.filter((set) => set.completed).map((set) => ({
        setType: set.setType || 'normal',
        weight: weightOf(set),
        reps: repsOf(set),
        completed: true,
    })),
})).filter((entry) => entry.sets.length > 0);

export const useActiveWorkout = (routine: Routine | null | undefined) => {
    const { getToken, userId } = useAuthContext();
    const navigate = useNavigate();

    // A reload of the same routine picks up where it was; anything else starts clean.
    const [restored] = useState(() => {
        const stored = readDraft(userId);
        return stored && routine && stored.routine._id === routine._id ? stored : null;
    });
    const [clock, setClock] = useState<WorkoutClock>(() => restored?.clock ?? { startedAt: Date.now(), pausedAt: null, pausedMs: 0 });
    const [exercises, setExercises] = useState<ActiveWorkoutExercise[]>(() => restored?.exercises ?? (routine ? exercisesFromRoutine(routine) : []));
    const [operationId, setOperationId] = useState<string | null>(() => restored?.operationId ?? null);
    const [now, setNow] = useState(() => Date.now());
    const [saving, setSaving] = useState(false);
    // False while another routine's unfinished session is stored and the
    // member has not yet chosen; nothing is written over it until then.
    const [ownsDraft, setOwnsDraft] = useState(() => {
        const stored = readDraft(userId);
        return !stored || stored.routine._id === routine?._id;
    });

    useEffect(() => {
        if (!routine) navigate('/routines');
    }, [routine, navigate]);

    useEffect(() => {
        if (ownsDraft || !routine) return;
        const other = readDraft(userId);
        if (other && window.confirm(`"${other.routine.name}" is still in progress. Resume it instead of starting "${routine.name}"?`)) {
            navigate('/active-workout', { replace: true, state: { routine: other.routine } });
            return;
        }
        setOwnsDraft(true);
    }, [navigate, ownsDraft, routine, userId]);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!routine || !userId || !ownsDraft) return;
        writeDraft({ version: 1, ownerId: userId, routine, clock, exercises, operationId });
    }, [clock, exercises, operationId, ownsDraft, routine, userId]);

    const paused = clock.pausedAt !== null;
    const elapsed = elapsedWorkoutSeconds(clock.startedAt + clock.pausedMs, clock.pausedAt ?? now);

    const togglePause = () => {
        const at = Date.now();
        setClock((current) => (current.pausedAt === null
            ? { ...current, pausedAt: at }
            : { ...current, pausedAt: null, pausedMs: current.pausedMs + (at - current.pausedAt) }));
        setNow(at);
    };

    const updateExercise = (exIdx: number, update: (exercise: ActiveWorkoutExercise) => ActiveWorkoutExercise) => {
        setExercises((current) => current.map((exercise, exerciseIndex) => (exerciseIndex === exIdx ? update(exercise) : exercise)));
    };

    const toggleSet = (exIdx: number, setIdx: number) => {
        updateExercise(exIdx, (exercise) => ({
            ...exercise,
            sets: exercise.sets.map((set, setIndex) => (setIndex === setIdx ? { ...set, completed: !set.completed } : set)),
        }));
    };

    const updateSet = (exIdx: number, setIdx: number, field: "weight" | "reps", value: string) => {
        updateExercise(exIdx, (exercise) => ({
            ...exercise,
            sets: exercise.sets.map((set, setIndex) => (setIndex === setIdx ? { ...set, [field]: value } : set)),
        }));
    };

    const addSet = (exIdx: number) => {
        updateExercise(exIdx, (exercise) => {
            const lastSet = exercise.sets[exercise.sets.length - 1] ?? { weight: '', reps: '', setType: "normal" as const, completed: false };
            return {
                ...exercise,
                sets: [...exercise.sets, { weight: lastSet.weight, reps: lastSet.reps, setType: lastSet.setType, completed: false }],
            };
        });
    };

    const removeSet = (exIdx: number, setIdx: number) => {
        updateExercise(exIdx, (exercise) => ({ ...exercise, sets: exercise.sets.filter((_, setIndex) => setIndex !== setIdx) }));
    };

    const addExercise = (exercise: Exercise) => {
        setExercises((current) => {
            if (current.some((item) => item.exerciseId._id === exercise._id)) return current;
            return [...current, { exerciseId: exercise, sets: [{ weight: '', reps: '', setType: 'normal', completed: false }] }];
        });
    };

    const removeExercise = (exIdx: number) => {
        setExercises((current) => current.filter((_, index) => index !== exIdx));
    };

    const totalVolume = exercises.reduce((sum, ex) => (
        sum + ex.sets.reduce((setSum, set) => (set.completed ? setSum + weightOf(set) * repsOf(set) : setSum), 0)
    ), 0);

    const totalSetsCompleted = exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.completed).length, 0);

    const finishWorkout = async () => {
        if (!routine || saving) return;
        if (totalSetsCompleted === 0) {
            toast.error("Complete at least one set before finishing.");
            return;
        }
        setSaving(true);
        try {
            const token = await getToken();
            if (!token) throw new Error("Authentication required");
            const attemptOperationId = operationId ?? createOperationId('workout');
            if (!operationId) setOperationId(attemptOperationId);
            const finished = completedSets(exercises);
            const payload = {
                operationId: attemptOperationId,
                name: routine.name,
                startTime: new Date(clock.startedAt).toISOString(),
                endTime: new Date().toISOString(),
                durationMinutes: Math.round(elapsed / 60),
                volumeKg: totalVolume,
                exercises: finished.map(({ exercise, sets }) => ({ exerciseId: exercise.exerciseId._id, sets })),
            };
            const data = await createWorkout(payload, token);

            if (data.success) {
                clearDraft(userId);
                const completedWorkout = {
                    ...payload,
                    ...(data.workout || {}),
                    exercises: finished.map(({ exercise, sets }) => ({ exerciseId: exercise.exerciseId, sets })),
                };
                navigate('/workout-summary', {
                    replace: true,
                    state: { workout: completedWorkout, workoutId: data.workout?._id },
                });
            } else {
                toast.error(data.message || "Workout could not be saved.");
            }
        } catch (error: unknown) {
            console.error("Failed to save workout:", error);
            toast.error(error instanceof Error ? error.message : "Workout could not be saved.");
        } finally {
            setSaving(false);
        }
    };

    return {
        elapsed, paused, saving, exercises,
        togglePause, toggleSet, updateSet, addSet, removeSet, addExercise, removeExercise,
        totalVolume, totalSetsCompleted, finishWorkout
    };
};
