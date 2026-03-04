import React, { useState, useEffect } from "react";
import { ChevronDown, MoreHorizontal, Plus, Folder, FileText, Search, Dumbbell, PlayCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@clerk/clerk-react";
import api from "~/api/axios";
import { useNavigate } from "react-router-dom";
import RoutineBuilderModal from "../components/RoutineBuilderModal";

const Routines = () => {
    const { t } = useTranslation();
    const { getToken } = useAuth();
    const navigate = useNavigate();
    const [routines, setRoutines] = useState([]);
    const [showBuilder, setShowBuilder] = useState(false);

    useEffect(() => {
        const fetchRoutines = async () => {
            try {
                const token = await getToken();
                if (!token) return;
                const { data } = await api.get("/api/routine", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (data.success) {
                    setRoutines(data.routines || []);
                }
            } catch (error) {
                console.error("Error fetching routines:", error);
            }
        };
        fetchRoutines();
    }, [getToken]);

    return (
        <div className="w-full h-full min-h-screen pt-4 pb-20 sm:pb-0 text-text-primary bg-background overflow-y-auto no-scrollbar">
            <div className="max-w-4xl mx-auto px-4 sm:px-8 space-y-8">

                {/* Header */}
                <div className="flex justify-between items-center py-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-accent-primary/10 rounded-2xl border border-accent-primary/20">
                            <Dumbbell className="w-6 h-6 text-accent-primary" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight">{t('routines.title')}</h1>
                    </div>
                    <div className="bg-gradient-to-br from-amber-400 to-orange-500 text-black shadow-lg text-[10px] font-black px-3 py-1 rounded-full tracking-widest uppercase border border-white/20">
                        {t('routines.pro_level', 'Pro level')}
                    </div>
                </div>

                {/* Main Action Area */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Start Empty Workout Button */}
                    <button
                        onClick={() => setShowBuilder(true)}
                        className="flex flex-col items-center justify-center bg-surface hover:bg-surface-light transition-all shadow-sm rounded-3xl p-8 border border-border-subtle group relative overflow-hidden active:scale-95"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-accent-primary/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
                        <div className="p-4 bg-accent-primary/10 rounded-2xl mb-4 group-hover:bg-accent-primary group-hover:scale-110 transition-all">
                            <Plus className="w-8 h-8 text-accent-primary group-hover:text-white transition-colors" />
                        </div>
                        <span className="font-bold text-lg text-text-primary">{t('routines.start_empty')}</span>
                        <p className="text-xs text-text-muted mt-2 font-medium">{t('routines.start_empty_desc', 'Log a quick session without a routine')}</p>
                    </button>

                    <div className="grid grid-rows-2 gap-4">
                        <button
                            onClick={() => setShowBuilder(true)}
                            className="flex items-center gap-4 bg-surface hover:bg-surface-light shadow-sm transition-all p-5 rounded-3xl border border-border-subtle group active:scale-95"
                        >
                            <div className="p-3 bg-surface-light rounded-2xl border border-border-subtle group-hover:bg-background group-hover:border-accent-primary/30 transition-all">
                                <FileText className="w-6 h-6 text-text-primary group-hover:text-accent-primary transition-colors" />
                            </div>
                            <div className="text-left">
                                <span className="font-bold text-text-primary block">{t('routines.new_routine')}</span>
                                <span className="text-xs text-text-muted font-medium">{t('routines.new_routine_desc', 'Build a custom workout plan')}</span>
                            </div>
                        </button>
                        <button className="flex items-center gap-4 bg-surface hover:bg-surface-light shadow-sm transition-all p-5 rounded-3xl border border-border-subtle group active:scale-95">
                            <div className="p-3 bg-surface-light rounded-2xl border border-border-subtle group-hover:bg-background group-hover:border-accent-primary/30 transition-all">
                                <Search className="w-6 h-6 text-text-primary group-hover:text-accent-primary transition-colors" />
                            </div>
                            <div className="text-left">
                                <span className="font-bold text-text-primary block">{t('routines.discover')}</span>
                                <span className="text-xs text-text-muted font-medium">{t('routines.discover_desc', 'Explore community favorites')}</span>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Routines List */}
                <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-sm font-bold text-text-muted uppercase tracking-widest">{t('routines.my_routines')} ({routines.length})</h2>
                        <button className="p-1.5 bg-surface rounded-xl border border-border-subtle hover:bg-surface-light transition shadow-sm">
                            <MoreHorizontal className="w-4 h-4 text-text-muted" />
                        </button>
                    </div>

                    {routines.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {routines.map(routine => (
                                <div key={routine._id} className="bg-surface rounded-3xl p-6 border border-border-subtle shadow-sm hover:shadow-md transition-all group flex flex-col justify-between animate-in">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex-1">
                                            <h3 className="text-xl font-bold text-text-primary tracking-tight group-hover:text-accent-primary transition-colors">{routine.name}</h3>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {routine.exercises.slice(0, 3).map((e, idx) => (
                                                    <span key={idx} className="text-[10px] font-bold bg-surface-light text-text-muted px-2 py-0.5 rounded-full border border-border-subtle">
                                                        {e.exerciseId?.name}
                                                    </span>
                                                ))}
                                                {routine.exercises.length > 3 && (
                                                    <span className="text-[10px] font-bold text-accent-primary">+{routine.exercises.length - 3} {t('profile.more_exercises', 'more')}</span>
                                                )}
                                            </div>
                                        </div>
                                        <button className="p-2 hover:bg-surface-light rounded-xl transition text-text-muted hover:text-text-primary border border-transparent hover:border-border-subtle">
                                            <MoreHorizontal className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => navigate('/active-workout', { state: { routine } })}
                                        className="w-full bg-accent-primary hover:bg-accent-hover transition-all font-bold text-white py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-accent-primary/10 active:scale-[0.98]">
                                        <PlayCircle className="w-5 h-5" />
                                        {t('routines.start_routine')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-surface rounded-3xl p-12 border border-border-subtle shadow-sm flex flex-col items-center justify-center text-center animate-in">
                            <div className="p-5 bg-surface-light rounded-full mb-4">
                                <FileText className="w-10 h-10 text-text-muted" />
                            </div>
                            <h3 className="text-xl font-bold text-text-primary mb-2">{t('routines.no_routines')}</h3>
                            <p className="text-sm text-text-secondary max-w-xs mx-auto">{t('routines.start_building')}</p>
                            <button
                                onClick={() => setShowBuilder(true)}
                                className="mt-6 px-8 py-3 bg-surface-light border border-border-subtle rounded-2xl font-bold text-text-primary hover:bg-background transition-colors"
                            >
                                {t('common.get_started', 'Get Started')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {showBuilder && (
                <RoutineBuilderModal
                    setShowModal={setShowBuilder}
                    onRoutineCreated={(r) => setRoutines(prev => [r, ...prev])}
                />
            )}
        </div>
    );
};

export default Routines;
