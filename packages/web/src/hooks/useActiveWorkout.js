import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '~/api/axios';
import { useAuthContext } from "../context/AuthProvider";

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

    const togglePause = () => setPaused(!paused);

    const toggleSet = (exIdx, setIdx) => {
        const newEx = [...exercises];
        newEx[exIdx].sets[setIdx].completed = !newEx[exIdx].sets[setIdx].completed;
        setExercises(newEx);
    };

    const updateSet = (exIdx, setIdx, field, value) => {
        const newEx = [...exercises];
        newEx[exIdx].sets[setIdx][field] = value;
        setExercises(newEx);
    };

    const addSet = (exIdx) => {
        const newEx = [...exercises];
        const lastSet = newEx[exIdx].sets[newEx[exIdx].sets.length - 1] || { weight: '', reps: '' };
        newEx[exIdx].sets.push({ weight: lastSet.weight, reps: lastSet.reps, completed: false });
        setExercises(newEx);
    };

    const removeSet = (exIdx, setIdx) => {
        const newEx = [...exercises];
        newEx[exIdx].sets.splice(setIdx, 1);
        setExercises(newEx);
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
        setSaving(true);
        try {
            const token = await getToken();
            const endTime = new Date();
            const startTime = new Date(endTime.getTime() - (elapsed * 1000));
            const payload = {
                name: routine.name,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                durationMinutes: Math.round(elapsed / 60),
                volumeKg: totalVolume,
                exercises: exercises.map(ex => ({
                    exerciseId: ex.exerciseId._id || ex.exerciseId,
                    sets: ex.sets.filter(set => set.completed).map(({ weight, reps }) => ({ weight, reps })),
                })).filter(ex => ex.sets.length > 0)
            };

            const { data } = await api.post('/api/workout', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success) {
                const completedWorkout = {
                    ...payload,
                    ...(data.workout || {}),
                    exercises: exercises.map(ex => ({
                        exerciseId: ex.exerciseId,
                        sets: ex.sets.filter(set => set.completed).map(({ weight, reps }) => ({ weight, reps })),
                    })).filter(ex => ex.sets.length > 0),
                };
                navigate('/workout-summary', {
                    replace: true,
                    state: { workout: completedWorkout, workoutId: data.workout?._id },
                });
            } else {
                alert(data.message || "Workout could not be saved.");
            }
        } catch (error) {
            console.error("Failed to save workout:", error);
            alert("Workouts could not be saved.");
        } finally {
            setSaving(false);
        }
    };

    return {
        elapsed, paused, saving, exercises,
        togglePause, toggleSet, updateSet, addSet, removeSet,
        totalVolume, totalSetsCompleted, finishWorkout
    };
};
