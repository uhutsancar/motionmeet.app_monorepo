import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuthContext } from "../context/AuthProvider";
import toast from 'react-hot-toast';
import { createOperationId, type Exercise, type ExerciseSet, type Routine } from '@motionmeet/shared';
import { createWorkout } from '~/api/endpoints';

export interface ActiveWorkoutSet extends Omit<ExerciseSet, "weight" | "reps"> { weight: number | string; reps: number | string }
export interface ActiveWorkoutExercise { exerciseId: Exercise; sets: ActiveWorkoutSet[] }
interface WorkoutSubmission {
    operationId: string;
    name: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    volumeKg: number;
    exercises: Array<{ exerciseId: string; sets: ExerciseSet[] }>;
}

export const useActiveWorkout = (routine: Routine | null | undefined) => {
    const { getToken } = useAuthContext();
    const navigate = useNavigate();

    const [elapsed, setElapsed] = useState(0);
    const [paused, setPaused] = useState(false);
    const [saving, setSaving] = useState(false);

    const [exercises, setExercises] = useState<ActiveWorkoutExercise[]>(() => {
        if (!routine) return [];
        return routine.exercises.flatMap((exercise) => {
            if (!exercise.exerciseId || typeof exercise.exerciseId === "string") return [];
            return [{ exerciseId: exercise.exerciseId, sets: exercise.sets.map((set) => ({ ...set, completed: false })) }];
        });
    });

    const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
    const saveSubmissionRef = useRef<WorkoutSubmission | null>(null);

    const invalidatePendingSave = () => {
        saveSubmissionRef.current = null;
    };

    useEffect(() => {
        if (!routine) {
            navigate('/routines');
            return;
        }

        intervalRef.current = setInterval(() => {
            if (!paused) setElapsed(p => p + 1);
        }, 1000);

        return () => clearInterval(intervalRef.current);
    }, [paused, routine, navigate]);

    const togglePause = () => {
        invalidatePendingSave();
        setPaused((current) => !current);
    };

    const toggleSet = (exIdx: number, setIdx: number) => {
        invalidatePendingSave();
        setExercises((current) => current.map((exercise, exerciseIndex) => (
            exerciseIndex !== exIdx
                ? exercise
                : {
                    ...exercise,
                    sets: exercise.sets.map((set, setIndex) => (
                        setIndex === setIdx ? { ...set, completed: !set.completed } : set
                    )),
                }
        )));
    };

    const updateSet = (exIdx: number, setIdx: number, field: "weight" | "reps", value: string) => {
        invalidatePendingSave();
        setExercises((current) => current.map((exercise, exerciseIndex) => (
            exerciseIndex !== exIdx
                ? exercise
                : {
                    ...exercise,
                    sets: exercise.sets.map((set, setIndex) => (
                        setIndex === setIdx ? { ...set, [field]: value } : set
                    )),
                }
        )));
    };

    const addSet = (exIdx: number) => {
        invalidatePendingSave();
        setExercises((current) => current.map((exercise, exerciseIndex) => {
            if (exerciseIndex !== exIdx) return exercise;
            const lastSet = exercise.sets[exercise.sets.length - 1] ?? { weight: '', reps: '', setType: "normal" as const, completed: false };
            return {
                ...exercise,
                sets: [
                    ...exercise.sets,
                    { weight: lastSet.weight, reps: lastSet.reps, setType: lastSet.setType, completed: false },
                ],
            };
        }));
    };

    const removeSet = (exIdx: number, setIdx: number) => {
        invalidatePendingSave();
        setExercises((current) => current.map((exercise, exerciseIndex) => (
            exerciseIndex !== exIdx
                ? exercise
                : {
                    ...exercise,
                    sets: exercise.sets.filter((_, setIndex) => setIndex !== setIdx),
                }
        )));
    };

    const addExercise = (exercise: Exercise) => {
        invalidatePendingSave();
        setExercises((current) => {
            if (current.some((item) => item.exerciseId._id === exercise._id)) {
                return current;
            }
            return [
                ...current,
                {
                    exerciseId: exercise,
                    sets: [{ weight: '', reps: '', setType: 'normal', completed: false }],
                },
            ];
        });
    };

    const removeExercise = (exIdx: number) => {
        invalidatePendingSave();
        setExercises((current) => current.filter((_, index) => index !== exIdx));
    };

    const totalVolume = exercises.reduce((sum, ex) => {
        return sum + ex.sets.reduce((setSum, set) => {
            if (set.completed) {
                const w = Number.parseFloat(String(set.weight)) || 0;
                const r = Number.parseInt(String(set.reps), 10) || 0;
                return setSum + (w * r);
            }
            return setSum;
        }, 0);
    }, 0);

    const totalSetsCompleted = exercises.reduce((sum, ex) => {
        return sum + ex.sets.filter(s => s.completed).length;
    }, 0);

    const finishWorkout = async () => {
        const activeRoutine = routine;
        if (!activeRoutine) return;
        if (saving) return;
        if (totalSetsCompleted === 0) {
            toast.error("Complete at least one set before finishing.");
            return;
        }
        setSaving(true);
        try {
            const token = await getToken();
            if (!token) throw new Error("Authentication required");
            if (!saveSubmissionRef.current) {
                const endTime = new Date();
                const startTime = new Date(endTime.getTime() - (elapsed * 1000));
                saveSubmissionRef.current = {
                    operationId: createOperationId('workout'),
                    name: activeRoutine.name,
                    startTime: startTime.toISOString(),
                    endTime: endTime.toISOString(),
                    durationMinutes: Math.round(elapsed / 60),
                    volumeKg: totalVolume,
                    exercises: exercises.map(ex => ({
                        exerciseId: ex.exerciseId._id,
                        sets: ex.sets.filter(set => set.completed).map(({ weight, reps, setType }) => ({
                            setType: setType || 'normal',
                            weight: Number(weight) || 0,
                            reps: Number(reps) || 0,
                            completed: true,
                        })),
                    })).filter(ex => ex.sets.length > 0)
                };
            }
            const payload = saveSubmissionRef.current;
            const data = await createWorkout(payload, token);

            if (data.success) {
                saveSubmissionRef.current = null;
                const completedWorkout = {
                    ...payload,
                    ...(data.workout || {}),
                    exercises: exercises.map(ex => ({
                        exerciseId: ex.exerciseId,
                        sets: ex.sets.filter(set => set.completed).map(({ weight, reps, setType }) => ({
                            setType: setType || 'normal',
                            weight: Number(weight) || 0,
                            reps: Number(reps) || 0,
                            completed: true,
                        })),
                    })).filter(ex => ex.sets.length > 0),
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
