import React, { useState, useEffect } from "react";
import { Search, Plus, Dumbbell, ChevronDown, Activity, Info, Zap, Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@clerk/clerk-react";
import api from "~/api/axios";
import CustomExerciseModal from "../components/CustomExerciseModal";
import { ResponsiveContainer, LineChart, XAxis, YAxis, Tooltip, Line } from "recharts";
import moment from "moment";

const muscleGroups = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Abs", "Cardio", "Full Body"];
const equipmentList = ["Dumbbell", "Barbell", "Machine", "Cables", "Bodyweight", "Kettlebell", "Other"];

const Exercises = () => {
    const { t } = useTranslation();
    const { getToken } = useAuth();

    const [exercises, setExercises] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [muscleFilter, setMuscleFilter] = useState("All Muscles");
    const [equipmentFilter, setEquipmentFilter] = useState("All Equipment");
    const [showModal, setShowModal] = useState(false);
    const [selectedExercise, setSelectedExercise] = useState(null);
    const [exerciseStats, setExerciseStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(false);

    // Fetch stats when exercise selection changes
    useEffect(() => {
        const fetchStats = async () => {
            if (!selectedExercise) return;
            setStatsLoading(true);
            try {
                const token = await getToken();
                const { data } = await api.get(`/api/exercise/${selectedExercise._id}/stats`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (data.success) {
                    setExerciseStats(data.stats);
                }
            } catch (error) {
                console.error("Error fetching exercise stats:", error);
            } finally {
                setStatsLoading(false);
            }
        };
        fetchStats();
    }, [selectedExercise, getToken]);

    // Fetch exercises logic based on filters
    useEffect(() => {
        const fetchExercises = async () => {
            try {
                const token = await getToken();
                const params = new URLSearchParams();
                if (searchQuery) params.append("search", searchQuery);
                if (muscleFilter !== "All Muscles") params.append("muscleGroup", muscleFilter);
                if (equipmentFilter !== "All Equipment") params.append("equipment", equipmentFilter);

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
        }, 300); // Debounce search

        return () => clearTimeout(timeoutId);
    }, [searchQuery, muscleFilter, equipmentFilter, getToken]);

    return (
        <div className="w-full h-full min-h-screen pt-4 pb-20 sm:pb-0 text-text-primary flex flex-col md:flex-row bg-background overflow-hidden no-scrollbar">

            {/* Left: Selected Exercise / Detail View */}
            <div className="flex-1 px-4 sm:px-8 py-4 flex flex-col overflow-y-auto no-scrollbar">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2.5 bg-accent-primary/10 rounded-2xl border border-accent-primary/20">
                        <Activity className="w-6 h-6 text-accent-primary" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('menu.exercises')}</h1>
                </div>

                <div className="flex-1 flex flex-col items-center justify-start min-h-[400px]">
                    {selectedExercise ? (
                        <div className="w-full max-w-3xl bg-surface rounded-[2.5rem] border border-border-subtle shadow-sm p-8 sm:p-10 animate-in">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-10">
                                <div className="p-6 bg-surface-light rounded-3xl border border-border-subtle shadow-inner self-start">
                                    <Dumbbell className="w-12 h-12 text-accent-primary" />
                                </div>
                                <div>
                                    <h2 className="text-4xl font-black tracking-tight mb-3 text-text-primary leading-tight">{selectedExercise.name}</h2>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="bg-accent-primary text-white px-4 py-1.5 rounded-xl text-[10px] font-black border border-accent-primary/20 tracking-widest uppercase shadow-lg shadow-accent-primary/20">
                                            {selectedExercise.muscleGroup}
                                        </span>
                                        <span className="bg-surface-light text-text-muted px-4 py-1.5 rounded-xl text-[10px] font-black border border-border-subtle tracking-widest uppercase">
                                            {selectedExercise.equipment}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
                                <div className="p-6 bg-surface-light rounded-3xl border border-border-subtle transition-transform hover:scale-[1.02]">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Zap className="w-4 h-4 text-orange-500" />
                                        <h3 className="text-[11px] font-black text-text-muted uppercase tracking-widest">{t('exercises.personal_record')}</h3>
                                    </div>
                                    <p className="text-3xl font-black text-text-primary">
                                        {exerciseStats?.personalRecord || 0}
                                        <span className="text-sm font-bold text-text-muted ml-1">kg</span>
                                    </p>
                                </div>
                                <div className="p-6 bg-surface-light rounded-3xl border border-border-subtle transition-transform hover:scale-[1.02]">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Calendar className="w-4 h-4 text-blue-500" />
                                        <h3 className="text-[11px] font-black text-text-muted uppercase tracking-widest">{t('exercises.total_sessions')}</h3>
                                    </div>
                                    <p className="text-3xl font-black text-text-primary">{exerciseStats?.totalSessions || 0}</p>
                                </div>
                            </div>

                            {/* Mini Chart */}
                            <div className="w-full bg-surface-light rounded-[2rem] border border-border-subtle p-8 overflow-hidden">
                                <h3 className="text-sm font-bold text-text-primary mb-6 flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-accent-primary" />
                                    {t('exercises.progress_history', 'Progress History')}
                                </h3>

                                <div className="h-[200px] w-full">
                                    {statsLoading ? (
                                        <div className="h-full flex items-center justify-center">
                                            <Activity className="w-6 h-6 text-accent-primary animate-spin opacity-30" />
                                        </div>
                                    ) : exerciseStats?.history?.length > 1 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={exerciseStats.history}>
                                                <XAxis dataKey="date" hide />
                                                <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                                                <Tooltip
                                                    content={({ active, payload }) => {
                                                        if (active && payload && payload.length) {
                                                            return (
                                                                <div className="bg-surface border border-border-subtle p-3 rounded-xl shadow-xl">
                                                                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">
                                                                        {moment(payload[0].payload.date).format("MMM DD, YYYY")}
                                                                    </p>
                                                                    <p className="text-sm font-black text-accent-primary">{payload[0].value} kg</p>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="maxWeight"
                                                    stroke="var(--accent-primary)"
                                                    strokeWidth={4}
                                                    dot={{ r: 4, fill: 'var(--accent-primary)', strokeWidth: 2, stroke: '#fff' }}
                                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center opacity-30">
                                            <Info className="w-8 h-8 mb-2" />
                                            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{t('exercises.more_sessions_needed', 'Need at least 2 sessions for trends')}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-surface w-full max-w-lg h-[450px] rounded-[3rem] border-2 border-dashed border-border-subtle flex flex-col items-center justify-center text-center p-12 animate-in-up">
                            <div className="p-8 bg-surface-light rounded-[2.5rem] mb-6 shadow-inner">
                                <Dumbbell className="w-16 h-16 text-text-muted opacity-30" />
                            </div>
                            <h2 className="text-2xl font-black mb-3 tracking-tight text-text-primary">{t('exercises.select_exercise')}</h2>
                            <p className="text-text-secondary text-sm max-w-[240px] mx-auto font-medium leading-relaxed opacity-80">{t('exercises.choose_from_library')}</p>
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

                    {/* Filter Blocks */}
                    <div className="flex gap-3 mb-6">
                        <div className="relative flex-1">
                            <select
                                className="w-full bg-surface rounded-xl px-4 py-3.5 text-sm font-bold text-text-primary hover:bg-surface-light focus:outline-none focus:border-accent-primary appearance-none cursor-pointer border border-transparent shadow-sm transition-all"
                                value={equipmentFilter}
                                onChange={(e) => setEquipmentFilter(e.target.value)}
                            >
                                <option value="All Equipment">{t('exercises.all_equipment', 'Tüm Ekipmanlar')}</option>
                                {equipmentList.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                            </select>
                            <ChevronDown className="w-4 h-4 text-text-muted absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                        <div className="relative flex-1">
                            <select
                                className="w-full bg-surface rounded-xl px-4 py-3.5 text-sm font-bold text-text-primary hover:bg-surface-light focus:outline-none focus:border-accent-primary appearance-none cursor-pointer border border-transparent shadow-sm transition-all"
                                value={muscleFilter}
                                onChange={(e) => setMuscleFilter(e.target.value)}
                            >
                                <option value="All Muscles">{t('exercises.all_muscles', 'Tüm Kaslar')}</option>
                                {muscleGroups.map(mg => <option key={mg} value={mg}>{mg}</option>)}
                            </select>
                            <ChevronDown className="w-4 h-4 text-text-muted absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    </div>

                    {/* Exercise List */}
                    <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 pr-1 pb-4">
                        {exercises.length > 0 ? (
                            <>
                                {/* Son Egzersizler (Recent) Dummy slice for now */}
                                <div>
                                    <h3 className="text-sm font-semibold text-text-muted mb-3 px-2">{t('exercises.recent', 'Son Egzersizler')}</h3>
                                    <div className="flex flex-col border-t border-border-subtle">
                                        {exercises.slice(0, 4).map((exercise) => (
                                            <div
                                                key={`recent-${exercise._id}`}
                                                onClick={() => setSelectedExercise(exercise)}
                                                className={`p-3 flex items-center gap-4 cursor-pointer transition-all border-b border-border-subtle hover:bg-surface-light group
                                        ${selectedExercise?._id === exercise._id ? 'bg-surface-light' : 'bg-background'}`}
                                            >
                                                <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 bg-surface">
                                                    <Dumbbell className={`w-6 h-6 ${selectedExercise?._id === exercise._id ? 'text-accent-primary' : 'text-text-muted'}`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className={`font-semibold text-base mb-1 ${selectedExercise?._id === exercise._id ? 'text-accent-primary' : 'text-text-primary'}`}>{exercise.name}</h4>
                                                    <p className="text-sm text-text-muted">{exercise.muscleGroup} • {exercise.equipment}</p>
                                                </div>
                                                <ChevronDown className="w-5 h-5 -rotate-90 text-text-muted opacity-50" />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Tüm Egzersizler (All) */}
                                <div>
                                    <h3 className="text-sm font-semibold text-text-muted mb-3 px-2">{t('exercises.all', 'Tüm Egzersizler')}</h3>
                                    <div className="flex flex-col border-t border-border-subtle">
                                        {exercises.map((exercise) => (
                                            <div
                                                key={`all-${exercise._id}`}
                                                onClick={() => setSelectedExercise(exercise)}
                                                className={`p-3 flex items-center gap-4 cursor-pointer transition-all border-b border-border-subtle hover:bg-surface-light group
                                        ${selectedExercise?._id === exercise._id ? 'bg-surface-light' : 'bg-background'}`}
                                            >
                                                <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 bg-surface">
                                                    <Dumbbell className={`w-6 h-6 ${selectedExercise?._id === exercise._id ? 'text-accent-primary' : 'text-text-muted'}`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className={`font-semibold text-base mb-1 ${selectedExercise?._id === exercise._id ? 'text-accent-primary' : 'text-text-primary'}`}>{exercise.name}</h4>
                                                    <p className="text-sm text-text-muted">{exercise.muscleGroup} • {exercise.equipment}</p>
                                                </div>
                                                <ChevronDown className="w-5 h-5 -rotate-90 text-text-muted opacity-50" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
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
        </div>
    );
};

export default Exercises;
