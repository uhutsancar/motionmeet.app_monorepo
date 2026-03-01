import React, { useState, useEffect, useRef } from "react";
import { X, Check, Dumbbell, Clock, Trophy } from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import api from "~/api/axios";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const ActiveWorkoutModal = ({ routine, onClose, onWorkoutSaved }) => {
    const { t } = useTranslation();
    const { getToken } = useAuth();

    // Timer
    const [elapsed, setElapsed] = useState(0);
    const startTimeRef = useRef(new Date());
    const intervalRef = useRef(null);

    // Exercises - pre-filled from routine data, track completion per set
    const [exercises, setExercises] = useState(() =>
        (routine?.exercises || []).map((e) => ({
            exerciseId: e.exerciseId?._id || e.exerciseId,
            name: e.exerciseId?.name || "Exercise",
            sets: e.sets.map((s) => ({
                weight: s.weight ?? 0,
                reps: s.reps ?? 0,
                done: false,
            })),
        }))
    );

    const [saving, setSaving] = useState(false);
    const [finished, setFinished] = useState(false);

    useEffect(() => {
        intervalRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
        return () => clearInterval(intervalRef.current);
    }, []);

    const formatTime = (secs) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
        return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };

    const toggleSetDone = (exIdx, setIdx) => {
        setExercises((prev) =>
            prev.map((ex, i) =>
                i === exIdx
                    ? { ...ex, sets: ex.sets.map((s, si) => si === setIdx ? { ...s, done: !s.done } : s) }
                    : ex
            )
        );
    };

    // Volume stats
    const totalVolume = exercises.reduce((total, ex) =>
        total + ex.sets.reduce((t, s) => t + (s.weight || 0) * (s.reps || 0), 0), 0
    );
    const doneSets = exercises.reduce((t, ex) => t + ex.sets.filter((s) => s.done).length, 0);
    const totalSets = exercises.reduce((t, ex) => t + ex.sets.length, 0);
    const progress = totalSets > 0 ? (doneSets / totalSets) * 100 : 0;

    // Per-exercise volume for chart
    const chartData = exercises.map((ex) => ({
        name: ex.name.split(" ")[0],
        volume: ex.sets.reduce((t, s) => t + (s.weight || 0) * (s.reps || 0), 0),
        done: ex.sets.every(s => s.done),
    }));

    const handleFinish = async () => {
        setSaving(true);
        try {
            const token = await getToken();
            const endTime = new Date();
            const durationMinutes = Math.max(1, Math.round(elapsed / 60));

            const payload = {
                name: routine?.name || "Quick Workout",
                startTime: startTimeRef.current,
                endTime,
                durationMinutes,
                volumeKg: Math.round(totalVolume * 10) / 10,
                exercises: exercises.map((ex) => ({
                    exerciseId: ex.exerciseId,
                    sets: ex.sets.map((s) => ({ weight: s.weight || 0, reps: s.reps || 0 })),
                })),
            };

            const { data } = await api.post("/api/workout", payload, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (data.success) {
                clearInterval(intervalRef.current);
                setFinished(true);
                toast.success("Workout saved! 🏆");
                if (onWorkoutSaved) onWorkoutSaved(data.workout);
            } else {
                toast.error(data.message);
            }
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    // ── Finish Screen ────────────────────────────────────────────────────────
    if (finished) {
        return (
            <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-surface border border-border-subtle rounded-3xl p-8 text-center shadow-2xl animate-in">
                    <div className="w-20 h-20 bg-accent-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Trophy className="w-10 h-10 text-accent-primary" />
                    </div>
                    <h2 className="text-2xl font-black text-text-primary mb-1">Workout Complete! 🏆</h2>
                    <p className="text-text-muted text-sm mb-6">{formatTime(elapsed)} active • {Math.round(totalVolume)} kg total volume</p>

                    {/* Summary stats */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <div className="bg-surface-light rounded-2xl p-3 border border-border-subtle">
                            <div className="text-xl font-black text-accent-primary">{formatTime(elapsed)}</div>
                            <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider mt-1">{t('routines.elapsed', 'Duration')}</div>
                        </div>
                        <div className="bg-surface-light rounded-2xl p-3 border border-border-subtle">
                            <div className="text-xl font-black text-accent-primary">{Math.round(totalVolume)}</div>
                            <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider mt-1">{t('profile.volume', 'volume')} kg</div>
                        </div>
                        <div className="bg-surface-light rounded-2xl p-3 border border-border-subtle">
                            <div className="text-xl font-black text-accent-primary">{doneSets}/{totalSets}</div>
                            <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider mt-1">Sets</div>
                        </div>
                    </div>

                    {/* Volume by exercise chart */}
                    {chartData.some(d => d.volume > 0) && (
                        <div className="mb-6">
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-3 text-left">Volume per Exercise</p>
                            <div className="h-40 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                        <XAxis dataKey="name" fontSize={10} stroke="var(--text-muted)" tickLine={false} axisLine={false} />
                                        <YAxis hide />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', fontSize: '12px' }}
                                            formatter={(v) => [`${v} kg`, 'Volume']}
                                        />
                                        <Bar dataKey="volume" radius={[6, 6, 0, 0]}>
                                            {chartData.map((entry, i) => (
                                                <Cell key={i} fill={entry.done ? 'var(--accent-primary)' : 'var(--accent-primary)'} fillOpacity={entry.done ? 1 : 0.4} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={onClose}
                        className="w-full bg-accent-primary hover:bg-accent-hover text-white font-black py-4 rounded-2xl transition-all active:scale-95"
                    >
                        Done
                    </button>
                </div>
            </div>
        );
    }

    // ── Active Workout Screen ─────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-[200] bg-background flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface shadow-sm">
                <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-light transition border border-transparent hover:border-border-subtle">
                    <X className="w-5 h-5 text-text-muted" />
                </button>
                <div className="text-center">
                    <h2 className="font-black text-text-primary text-lg">{routine?.name || t('routines.active_workout')}</h2>
                    <div className="flex items-center justify-center gap-2 text-accent-primary text-sm font-bold">
                        <Clock className="w-4 h-4" />
                        <span className="font-mono tracking-widest">{formatTime(elapsed)}</span>
                    </div>
                </div>
                <button
                    onClick={handleFinish}
                    disabled={saving}
                    className="bg-accent-primary hover:bg-accent-hover text-white text-sm font-black px-5 py-2.5 rounded-2xl transition-all active:scale-95 disabled:opacity-60 shadow-lg shadow-accent-primary/20"
                >
                    {saving ? "..." : t('routines.finish', 'Finish')}
                </button>
            </div>

            {/* Progress Bar */}
            <div className="h-1.5 bg-surface-light">
                <div
                    className="h-full bg-accent-primary transition-all duration-500"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Stats Bar */}
            <div className="flex gap-4 px-6 py-3 bg-surface border-b border-border-subtle">
                <div className="flex-1 text-center">
                    <div className="font-black text-text-primary text-base">{Math.round(totalVolume)} kg</div>
                    <div className="text-text-muted font-bold uppercase tracking-wider text-[10px]">{t('profile.volume', 'Volume')}</div>
                </div>
                <div className="w-px bg-border-subtle" />
                <div className="flex-1 text-center">
                    <div className="font-black text-text-primary text-base">{doneSets}/{totalSets}</div>
                    <div className="text-text-muted font-bold uppercase tracking-wider text-[10px]">Sets Done</div>
                </div>
                <div className="w-px bg-border-subtle" />
                <div className="flex-1 text-center">
                    <div className="font-black text-text-primary text-base">{exercises.length}</div>
                    <div className="text-text-muted font-bold uppercase tracking-wider text-[10px]">Exercises</div>
                </div>
            </div>

            {/* Live Mini Chart */}
            {chartData.some(d => d.volume > 0) && (
                <div className="px-6 py-2 border-b border-border-subtle bg-surface">
                    <div className="h-16 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                                <XAxis dataKey="name" fontSize={9} stroke="var(--text-muted)" tickLine={false} axisLine={false} />
                                <Bar dataKey="volume" radius={[3, 3, 0, 0]}>
                                    {chartData.map((entry, i) => <Cell key={i} fill="var(--accent-primary)" fillOpacity={entry.done ? 1 : 0.35} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Exercise Cards */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-4 pb-8">
                {exercises.map((ex, exIdx) => {
                    const exDone = ex.sets.every(s => s.done);
                    return (
                        <div key={exIdx} className={`border rounded-3xl overflow-hidden shadow-sm transition-all ${exDone ? 'bg-accent-primary/5 border-accent-primary/30' : 'bg-surface border-border-subtle'}`}>
                            {/* Exercise Header */}
                            <div className="flex items-center gap-3 px-5 py-4 border-b border-border-subtle/50">
                                <div className={`p-2 rounded-xl transition-colors ${exDone ? 'bg-accent-primary' : 'bg-accent-primary/10'}`}>
                                    <Dumbbell className={`w-4 h-4 ${exDone ? 'text-white' : 'text-accent-primary'}`} />
                                </div>
                                <h3 className="font-black text-text-primary flex-1">{ex.name}</h3>
                                <span className={`text-xs font-bold px-2 py-1 rounded-full border ${exDone ? 'text-accent-primary border-accent-primary/30 bg-accent-primary/10' : 'text-text-muted border-border-subtle bg-surface-light'}`}>
                                    {ex.sets.filter(s => s.done).length}/{ex.sets.length}
                                </span>
                            </div>

                            {/* Column Headers */}
                            <div className="grid grid-cols-12 gap-2 px-5 pt-3 pb-1 text-[10px] font-black text-text-muted uppercase tracking-widest">
                                <div className="col-span-1">#</div>
                                <div className="col-span-4 text-center">Weight</div>
                                <div className="col-span-4 text-center">Reps</div>
                                <div className="col-span-3 text-center">Done</div>
                            </div>

                            {/* Sets - pre-filled from routine */}
                            <div className="px-5 pb-4 space-y-2">
                                {ex.sets.map((s, setIdx) => (
                                    <div
                                        key={setIdx}
                                        className={`grid grid-cols-12 gap-2 items-center py-2 px-2 rounded-xl transition-all ${s.done ? 'bg-accent-primary/10 border border-accent-primary/20' : 'bg-background'}`}
                                    >
                                        <div className="col-span-1 text-xs font-black text-text-muted">{setIdx + 1}</div>
                                        <div className="col-span-4 text-center">
                                            <span className={`text-sm font-bold px-3 py-1.5 rounded-lg block ${s.done ? 'text-accent-primary' : 'text-text-primary bg-surface border border-border-subtle'}`}>
                                                {s.weight} kg
                                            </span>
                                        </div>
                                        <div className="col-span-4 text-center">
                                            <span className={`text-sm font-bold px-3 py-1.5 rounded-lg block ${s.done ? 'text-accent-primary' : 'text-text-primary bg-surface border border-border-subtle'}`}>
                                                {s.reps} reps
                                            </span>
                                        </div>
                                        <div className="col-span-3 flex justify-center">
                                            <button
                                                onClick={() => toggleSetDone(exIdx, setIdx)}
                                                className={`w-9 h-9 rounded-xl transition-all active:scale-90 flex items-center justify-center ${s.done ? 'bg-accent-primary text-white shadow-md' : 'bg-surface border border-border-subtle text-text-muted hover:border-accent-primary/40'}`}
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ActiveWorkoutModal;
