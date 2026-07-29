import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuthContext } from "../context/AuthProvider";
import toast from 'react-hot-toast';
import { createOperationId } from '@motionmeet/shared';
import { createWorkout } from '~/api/endpoints';

export const useActiveWorkout = (routine) => {
    const { getToken } = useAuthContext();
    const navigate = useNavigate();

    const [elapsed, setElapsed] = useState(0);
    const [paused, setPaused] = useState(false);
    const [saving, setSaving] = useState(false);

    const [exercises, setExercises] = useState(() => {
        if (!routine) return [];
        return routine.exercises.map(ex => ({
            exerciseId: ex.exerciseId,
            sets: ex.sets.map(s => ({ ...s, completed: false }))
        }));
    });

    const intervalRef = useRef(null);
    const saveSubmissionRef = useRef(null);

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

    const toggleSet = (exIdx, setIdx) => {
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

    const updateSet = (exIdx, setIdx, field, value) => {
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

    const addSet = (exIdx) => {
        invalidatePendingSave();
        setExercises((current) => current.map((exercise, exerciseIndex) => {
            if (exerciseIndex !== exIdx) return exercise;
            const lastSet = exercise.sets[exercise.sets.length - 1] || { weight: '', reps: '' };
            return {
                ...exercise,
                sets: [
                    ...exercise.sets,
                    { weight: lastSet.weight, reps: lastSet.reps, completed: false },
                ],
            };
        }));
    };

    const removeSet = (exIdx, setIdx) => {
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

    const addExercise = (exercise) => {
        invalidatePendingSave();
        setExercises((current) => {
            if (current.some((item) => (item.exerciseId?._id || item.exerciseId) === exercise._id)) {
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

    const removeExercise = (exIdx) => {
        invalidatePendingSave();
        setExercises((current) => current.filter((_, index) => index !== exIdx));
    };

    const totalVolume = exercises.reduce((sum, ex) => {
        return sum + ex.sets.reduce((setSum, set) => {
            if (set.completed) {
                const w = parseFloat(set.weight) || 0;
                const r = parseInt(set.reps) || 0;
                return setSum + (w * r);
            }
            return setSum;
        }, 0);
    }, 0);

    const totalSetsCompleted = exercises.reduce((sum, ex) => {
        return sum + ex.sets.filter(s => s.completed).length;
    }, 0);

    const finishWorkout = async () => {
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
                    name: routine.name,
                    startTime: startTime.toISOString(),
                    endTime: endTime.toISOString(),
                    durationMinutes: Math.round(elapsed / 60),
                    volumeKg: totalVolume,
                    exercises: exercises.map(ex => ({
                        exerciseId: ex.exerciseId._id || ex.exerciseId,
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
        } catch (error) {
            console.error("Failed to save workout:", error);
            toast.error(error.response?.data?.message || "Workout could not be saved.");
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
