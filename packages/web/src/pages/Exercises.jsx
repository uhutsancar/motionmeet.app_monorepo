import React, { useState, useEffect } from "react";
import { Search, Plus, Dumbbell, ChevronDown, Activity, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@clerk/clerk-react";
import api from "~/api/axios";
import CustomExerciseModal from "../components/CustomExerciseModal";

const Exercises = () => {
    const { t } = useTranslation();
    const { getToken } = useAuth();

    const [exercises, setExercises] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [muscleFilter, setMuscleFilter] = useState(t('exercises.all_muscles', 'All Muscles'));
    const [equipmentFilter, setEquipmentFilter] = useState(t('exercises.all_equipment', 'All Equipment'));
    const [showModal, setShowModal] = useState(false);
    const [selectedExercise, setSelectedExercise] = useState(null);

    const muscleGroups = [
        "Abdominals", "Abductors", "Adductors", "Biceps", "Calves", "Chest",
        "Forearms", "Glutes", "Hamstrings", "Lats", "Lower Back", "Middle Back",
        "Neck", "Quadriceps", "Shoulders", "Traps", "Triceps"
    ];

    const equipmentList = [
        "Barbell", "Dumbbell", "Kettlebell", "Machine", "Cable",
        "Bodyweight", "Band", "Plate", "Other"
    ];

    useEffect(() => {
        const fetchExercises = async () => {
            try {
                const token = await getToken();
                if (!token) return;

                const params = new URLSearchParams();
                if (searchQuery) params.append("search", searchQuery);
                if (muscleFilter !== t('exercises.all_muscles', 'All Muscles')) params.append("muscleGroup", muscleFilter);
                if (equipmentFilter !== t('exercises.all_equipment', 'All Equipment')) params.append("equipment", equipmentFilter);

                const { data } = await api.get(`/api/exercise?${params.toString()}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (data.success) {
                    setExercises(data.exercises);
                }
            } catch (error) {
                console.error("Error fetching exercises:", error);
            }
        };

        const timeoutId = setTimeout(() => {
            fetchExercises();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchQuery, muscleFilter, equipmentFilter, getToken]);

    return (
        <div className="w-full h-full min-h-screen pt-4 pb-20 sm:pb-0 text-text-primary flex flex-col md:flex-row bg-background overflow-hidden">

            {/* Left: Selected Exercise / Detail View */}
            <div className="flex-1 px-4 sm:px-8 py-4 flex flex-col overflow-y-auto no-scrollbar">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2.5 bg-accent-primary/10 rounded-2xl border border-accent-primary/20">
                        <Activity className="w-6 h-6 text-accent-primary" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('menu.exercises')}</h1>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
                    {selectedExercise ? (
                        <div className="w-full max-w-2xl bg-surface rounded-3xl border border-border-subtle shadow-sm p-8 animate-in">
                            <div className="flex items-center gap-6 mb-8">
                                <div className="p-6 bg-surface-light rounded-2xl border border-border-subtle shadow-inner">
                                    <Dumbbell className="w-12 h-12 text-accent-primary" />
                                </div>
                                <div>
                                    <h2 className="text-3xl font-bold tracking-tight mb-2">{selectedExercise.name}</h2>
                                    <div className="flex gap-2">
                                        <span className="bg-accent-primary/10 text-accent-primary px-3 py-1 rounded-full text-xs font-bold border border-accent-primary/20 tracking-wide uppercase">
                                            {selectedExercise.muscleGroup}
                                        </span>
                                        <span className="bg-surface-light text-text-muted px-3 py-1 rounded-full text-xs font-bold border border-border-subtle tracking-wide uppercase">
                                            {selectedExercise.equipment}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-4 bg-surface-light rounded-2xl border border-border-subtle">
                                    <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">{t('exercises.personal_record')}</h3>
                                    <p className="text-xl font-bold text-text-primary">-- kg</p>
                                </div>
                                <div className="p-4 bg-surface-light rounded-2xl border border-border-subtle">
                                    <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">{t('exercises.total_sessions')}</h3>
                                    <p className="text-xl font-bold text-text-primary">--</p>
                                </div>
                            </div>

                            <div className="mt-8 flex items-center gap-3 p-4 bg-accent-primary/5 rounded-2xl border border-accent-primary/10">
                                <Info className="w-5 h-5 text-accent-primary" />
                                <p className="text-xs text-text-secondary font-medium italic">{t('exercises.history_coming_soon', 'History and progress charts coming soon to the web dashboard!')}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-surface w-full max-w-lg h-96 rounded-3xl border border-border-subtle shadow-sm flex flex-col items-center justify-center text-center p-8 animate-in">
                            <div className="p-5 bg-surface-light rounded-full mb-4">
                                <Dumbbell className="w-12 h-12 text-text-muted opacity-50" />
                            </div>
                            <h2 className="text-xl font-bold mb-2 tracking-tight">{t('exercises.select_exercise')}</h2>
                            <p className="text-text-secondary text-sm max-w-xs mx-auto font-medium leading-relaxed">{t('exercises.choose_from_library')}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Exercise Library Sidebar */}
            <div className="w-full md:w-80 lg:w-96 border-l border-border-subtle px-4 py-6 flex flex-col h-full bg-surface shadow-2xl z-10">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold tracking-tight">{t('exercises.library')}</h2>
                    <button
                        onClick={() => setShowModal(true)}
                        className="text-accent-primary text-sm font-bold flex items-center hover:bg-accent-primary/10 px-3 py-1.5 rounded-xl transition-all border border-transparent hover:border-accent-primary/20"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        {t('exercises.custom')}
                    </button>
                </div>

                {/* Filters */}
                <div className="space-y-3 mb-6">
                    <div className="relative">
                        <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder={t('exercises.search')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-background border border-border-subtle rounded-xl pl-10 pr-4 py-3 text-xs font-bold text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary transition-all shadow-inner"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                            <select
                                className="w-full bg-background border border-border-subtle rounded-xl pl-3 pr-8 py-2.5 text-[10px] font-black text-text-muted hover:bg-surface-light focus:outline-none focus:border-accent-primary appearance-none cursor-pointer shadow-inner transition-all uppercase tracking-tighter"
                                value={equipmentFilter}
                                onChange={(e) => setEquipmentFilter(e.target.value)}
                            >
                                <option value={t('exercises.all_equipment', 'All Equipment')}>{t('exercises.equipment')}</option>
                                {equipmentList.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                            </select>
                            <ChevronDown className="w-3 h-3 text-text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>

                        <div className="relative">
                            <select
                                className="w-full bg-background border border-border-subtle rounded-xl pl-3 pr-8 py-2.5 text-[10px] font-black text-text-muted hover:bg-surface-light focus:outline-none focus:border-accent-primary appearance-none cursor-pointer shadow-inner transition-all uppercase tracking-tighter"
                                value={muscleFilter}
                                onChange={(e) => setMuscleFilter(e.target.value)}
                            >
                                <option value={t('exercises.all_muscles', 'All Muscles')}>{t('exercises.muscle')}</option>
                                {muscleGroups.map(mg => <option key={mg} value={mg}>{mg}</option>)}
                            </select>
                            <ChevronDown className="w-3 h-3 text-text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    </div>
                </div>

                <div className="text-[11px] font-black tracking-widest uppercase text-text-muted mb-4 px-1 flex items-center justify-between">
                    <span>{t('exercises.all')}</span>
                    <span className="bg-surface-light px-2 py-0.5 rounded-full border border-border-subtle">{exercises.length}</span>
                </div>

                {/* Exercise List */}
                <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pr-1 pb-4">
                    {exercises.length > 0 ? (
                        exercises.map((exercise) => (
                            <div
                                key={exercise._id}
                                onClick={() => setSelectedExercise(exercise)}
                                className={`border rounded-2xl p-4 flex items-center gap-4 cursor-pointer transition-all active:scale-95 group
                                ${selectedExercise?._id === exercise._id ? 'bg-accent-primary/10 border-accent-primary shadow-sm' : 'bg-background border-border-subtle hover:bg-surface-light'}`}
                            >
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-colors
                                ${selectedExercise?._id === exercise._id ? 'bg-accent-primary border-accent-primary/30 shadow-md' : 'bg-surface border-border-subtle group-hover:bg-background'}`}>
                                    <Dumbbell className={`w-6 h-6 ${selectedExercise?._id === exercise._id ? 'text-white' : 'text-accent-primary'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className={`font-bold text-sm tracking-tight truncate ${selectedExercise?._id === exercise._id ? 'text-accent-primary' : 'text-text-primary'}`}>{exercise.name}</h4>
                                    <p className="text-[10px] text-text-muted font-bold truncate tracking-wide uppercase opacity-70">{exercise.muscleGroup} • {exercise.equipment}</p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center pt-20 text-center opacity-40">
                            <Dumbbell className="w-12 h-12 text-text-muted mb-3" />
                            <p className="text-text-muted text-xs font-bold uppercase tracking-widest leading-loose">{t('exercises.not_found')}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {showModal && (
                <CustomExerciseModal
                    setShowModal={setShowModal}
                    onExerciseCreated={(newExercise) => setExercises(prev => [newExercise, ...prev])}
                />
            )}
        </div>
    );
};

export default Exercises;
