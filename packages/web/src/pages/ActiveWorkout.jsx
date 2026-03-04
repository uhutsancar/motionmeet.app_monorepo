import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@clerk/clerk-react';
import {
    Activity, ArrowLeft, Check, CheckCircle2, ChevronRight,
    Dumbbell, Flame, Pause, Play, Plus, Trash2, X
} from 'lucide-react';
import api from '~/api/axios';
import moment from 'moment';

const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const ActiveWorkout = () => {
    const { t } = useTranslation();
    const { getToken } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const { routine } = location.state || {};
    const [elapsed, setElapsed] = useState(0);
    const [paused, setPaused] = useState(false);
    const [saving, setSaving] = useState(false);

    // Initial state setup based on passed routine
    const [exercises, setExercises] = useState(() => {
        if (!routine) return [];
        return routine.exercises.map(ex => ({
            exerciseId: ex.exerciseId,
            sets: ex.sets.map(s => ({ ...s, completed: false }))
        }));
    });

    const intervalRef = useRef(null);
    const startTimeRef = useRef(new Date());

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

    // Helpers
    const togglePause = () => setPaused(!paused);

    const toggleSet = (exIdx, setIdx) => {
        const newEx = [...exercises];
        newEx[exIdx].sets[setIdx].completed = !newEx[exIdx].sets[setIdx].completed;
        setExercises(newEx);
    };

    const updateSet = (exIdx, setIdx, field, val) => {
        const newEx = [...exercises];
        newEx[exIdx].sets[setIdx][field] = Number(val) || 0;
        setExercises(newEx);
    };

    const addSet = (exIdx) => {
        const newEx = [...exercises];
        const lastSet = newEx[exIdx].sets[newEx[exIdx].sets.length - 1];
        newEx[exIdx].sets.push({
            weight: lastSet ? lastSet.weight : 0,
            reps: lastSet ? lastSet.reps : 0,
            completed: false
        });
        setExercises(newEx);
    };

    const removeSet = (exIdx, setIdx) => {
        const newEx = [...exercises];
        newEx[exIdx].sets.splice(setIdx, 1);
        if (newEx[exIdx].sets.length === 0) {
            newEx.splice(exIdx, 1);
        }
        setExercises(newEx);
    };

    const totalVolume = exercises.reduce((sum, ex) =>
        sum + ex.sets.reduce((sSum, s) => sSum + (s.completed ? s.weight * s.reps : 0), 0)
        , 0);

    const totalSetsCompleted = exercises.reduce((sum, ex) =>
        sum + ex.sets.filter(s => s.completed).length
        , 0);

    const finishWorkout = async () => {
        setSaving(true);
        try {
            const token = await getToken();
            const durationMinutes = Math.max(1, Math.round(elapsed / 60));

            const payload = {
                name: routine.name,
                startTime: startTimeRef.current,
                endTime: new Date(),
                durationMinutes,
                volumeKg: totalVolume,
                exercises: exercises.map(ex => ({
                    exerciseId: ex.exerciseId?._id || ex.exerciseId,
                    sets: ex.sets.filter(s => s.completed).map(s => ({
                        weight: s.weight,
                        reps: s.reps
                    }))
                })).filter(ex => ex.sets.length > 0)
            };

            const { data } = await api.post('/api/workout', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success) {
                // Here we would normally go to WorkoutCompleteShare or Summary page
                // But for now, returning to routines with a success toast handles the base case.
                navigate('/routines');
            }
        } catch (error) {
            console.error("Failed to save workout:", error);
            alert("Workouts could not be saved.");
        } finally {
            setSaving(false);
        }
    };

    if (!routine) return null;

    return (
        <div className="w-full min-h-[100dvh] bg-background flex flex-col no-scrollbar">

            {/* Top Fixed Header with Live Stats */}
            <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border-subtle p-4 lg:px-8 shadow-sm">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={togglePause} className="w-12 h-12 rounded-full bg-accent-primary/10 flex items-center justify-center text-accent-primary hover:bg-accent-primary hover:text-white transition-colors">
                            {paused ? <Play className="w-5 h-5 ml-1" /> : <Pause className="w-5 h-5" />}
                        </button>
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase tracking-widest font-black text-text-muted">{paused ? t('active_workout.paused', 'Duraklatıldı') : t('active_workout.active', 'Aktif')}</span>
                            <span className={`text-2xl font-black tabular-nums tracking-tight ${paused ? 'text-accent-primary' : 'text-text-primary'}`}>
                                {formatTime(elapsed)}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-4 sm:gap-8 overflow-x-auto no-scrollbar shrink-0 px-2">
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">{t('statistics.volume', 'Hacim')}</span>
                            <span className="font-bold text-text-primary">{totalVolume} <span className="text-[10px] text-text-muted">kg</span></span>
                        </div>
                        <div className="w-px bg-border-subtle h-8"></div>
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">{t('statistics.sets', 'Set')}</span>
                            <span className="font-bold text-text-primary">{totalSetsCompleted}</span>
                        </div>
                        <div className="w-px bg-border-subtle h-8"></div>
                        <button className="flex flex-col items-center justify-center group" title="Body Heatmap">
                            <Flame className="w-5 h-5 text-orange-500 group-hover:scale-110 transition-transform" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 w-full max-w-4xl mx-auto p-4 lg:py-8 lg:px-0 space-y-6 pb-32">
                <div className="flex items-center justify-between mb-2 px-1">
                    <h1 className="text-2xl font-black text-text-primary">{routine.name}</h1>
                </div>

                {exercises.map((ex, exIdx) => (
                    <div key={exIdx} className="bg-surface rounded-3xl border border-border-subtle overflow-hidden shadow-sm hover:shadow-md transition-shadow">

                        {/* Exercise Header */}
                        <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-surface-light/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-background rounded-xl border border-border-subtle shadow-inner">
                                    <Dumbbell className="w-5 h-5 text-accent-primary" />
                                </div>
                                <h3 className="font-bold text-text-primary text-base sm:text-lg">
                                    {ex.exerciseId?.name || 'Unknown Exercise'}
                                </h3>
                            </div>
                            <button className="text-text-muted hover:text-text-primary p-2">
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Sets List */}
                        <div className="p-2 sm:p-4">
                            {/* Columns Header */}
                            <div className="flex items-center text-[10px] font-black uppercase tracking-widest text-text-muted px-2 py-2 mb-1">
                                <div className="w-10 text-center">Set</div>
                                <div className="flex-1 min-w-[60px] text-center hidden sm:block">Önceki</div>
                                <div className="flex-1 text-center">kg</div>
                                <div className="flex-1 text-center">Tekrar</div>
                                <div className="w-12 flex justify-center"><CheckCircle2 className="w-4 h-4 opacity-50" /></div>
                            </div>

                            {/* Set Rows */}
                            {ex.sets.map((set, setIdx) => (
                                <div
                                    key={setIdx}
                                    className={`flex items-center gap-1 sm:gap-2 px-1 sm:px-2 py-2 mb-2 rounded-2xl transition-all ${set.completed ? "bg-emerald-500/10" : "bg-background"
                                        }`}
                                >
                                    {/* Set Number */}
                                    <div className="w-8 sm:w-10 flex justify-center">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${set.completed ? "bg-emerald-500 text-white" : "text-text-muted bg-surface-light border border-border-subtle"
                                            }`}>
                                            {setIdx + 1}
                                        </div>
                                    </div>

                                    {/* Previous Status (Static for now) */}
                                    <div className="flex-1 min-w-[60px] text-center hidden sm:block">
                                        <span className="text-xs font-bold text-text-muted block">-</span>
                                    </div>

                                    {/* Weight Input */}
                                    <div className="flex-1">
                                        <input
                                            type="number"
                                            value={set.weight || ''}
                                            onChange={(e) => updateSet(exIdx, setIdx, 'weight', e.target.value)}
                                            className={`w-full text-center py-2.5 rounded-xl font-bold bg-surface-light border border-transparent focus:border-accent-primary focus:bg-background outline-none transition-all ${set.completed ? "opacity-50 pointer-events-none" : "text-text-primary"
                                                }`}
                                            placeholder="0"
                                        />
                                    </div>

                                    {/* Reps Input */}
                                    <div className="flex-1">
                                        <input
                                            type="number"
                                            value={set.reps || ''}
                                            onChange={(e) => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                                            className={`w-full text-center py-2.5 rounded-xl font-bold bg-surface-light border border-transparent focus:border-accent-primary focus:bg-background outline-none transition-all ${set.completed ? "opacity-50 pointer-events-none" : "text-text-primary"
                                                }`}
                                            placeholder="0"
                                        />
                                    </div>

                                    {/* Complete Checkbox */}
                                    <div className="w-10 sm:w-12 flex justify-center">
                                        <button
                                            onClick={() => toggleSet(exIdx, setIdx)}
                                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${set.completed
                                                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                                                    : "bg-surface-light hover:bg-surface border border-border-subtle text-text-muted"
                                                }`}
                                        >
                                            <Check className="w-5 h-5 stroke-[3]" />
                                        </button>
                                    </div>

                                    {/* Delete Set Button */}
                                    {!set.completed && (
                                        <button
                                            onClick={() => removeSet(exIdx, setIdx)}
                                            className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors ml-1"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}

                            {/* Add Set Button */}
                            <div className="mt-4 flex justify-center">
                                <button
                                    onClick={() => addSet(exIdx)}
                                    className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-text-muted hover:text-accent-primary transition-colors py-2 px-4 rounded-xl hover:bg-accent-primary/10"
                                >
                                    <Plus className="w-4 h-4" />
                                    {t('active_workout.add_set', '+ Set Ekle')}
                                </button>
                            </div>

                        </div>
                    </div>
                ))}

                {/* Add Exercise Floating Row */}
                <button className="w-full py-4 border-2 border-dashed border-accent-primary/30 rounded-3xl flex items-center justify-center gap-2 text-accent-primary font-bold hover:bg-accent-primary/5 transition-colors">
                    <Plus className="w-5 h-5" />
                    {t('active_workout.add_exercise', 'Egzersiz Ekle')}
                </button>
            </div>

            {/* Floating Finish Button Area */}
            <div className="fixed bottom-0 left-0 w-full bg-background/90 backdrop-blur-md border-t border-border-subtle p-4 lg:p-6 pb-8 lg:pb-8 flex justify-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                <button
                    onClick={finishWorkout}
                    disabled={saving}
                    className="w-full max-w-lg bg-emerald-500 text-white font-black uppercase tracking-widest py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors shadow-xl shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50"
                >
                    {saving ? (
                        <>
                            <Activity className="w-5 h-5 animate-spin" />
                            {t('common.saving', 'Kaydediliyor...')}
                        </>
                    ) : (
                        <>
                            {t('active_workout.finish_workout', 'Antrenmanı Bitir')}
                            <CheckCircle2 className="w-5 h-5" />
                        </>
                    )}
                </button>
            </div>

        </div>
    );
};

export default ActiveWorkout;
