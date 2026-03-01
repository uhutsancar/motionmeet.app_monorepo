import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import api from "~/api/axios";
import { useAuth } from "@clerk/clerk-react";
import { FileText, Plus, Search, Trash2, Dumbbell } from "lucide-react";

const RoutineBuilderModal = ({ setShowModal, onRoutineCreated }) => {
    const { getToken } = useAuth();
    const [form, setForm] = useState({ name: "", folder: "My Routines" });

    const [exercisesData, setExercisesData] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");

    const [selectedExercises, setSelectedExercises] = useState([]);

    useEffect(() => {
        const fetchExercises = async () => {
            try {
                const token = await getToken();
                if (!token) return;
                const { data } = await api.get(`/api/exercise?search=${searchQuery}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (data.success) {
                    setExercisesData(data.exercises);
                }
            } catch (error) {
                console.error("Error fetching exercises", error);
            }
        };

        const timeoutId = setTimeout(() => fetchExercises(), 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery, getToken]);

    const addExercise = (exercise) => {
        if (selectedExercises.find((e) => e.exerciseId._id === exercise._id)) {
            toast.error("Exercise already added.");
            return;
        }
        setSelectedExercises([
            ...selectedExercises,
            {
                exerciseId: exercise,
                sets: [{ setType: "normal", reps: 0, weight: 0, completed: false }]
            }
        ]);
        setSearchQuery("");
    };

    const removeExercise = (index) => {
        const updated = [...selectedExercises];
        updated.splice(index, 1);
        setSelectedExercises(updated);
    };

    const addSet = (exerciseIndex) => {
        const updated = [...selectedExercises];
        updated[exerciseIndex].sets.push({ setType: "normal", reps: 0, weight: 0, completed: false });
        setSelectedExercises(updated);
    };

    const removeSet = (exerciseIndex, setIndex) => {
        const updated = [...selectedExercises];
        updated[exerciseIndex].sets.splice(setIndex, 1);
        setSelectedExercises(updated);
    };

    const updateSet = (exerciseIndex, setIndex, field, value) => {
        const updated = [...selectedExercises];
        updated[exerciseIndex].sets[setIndex][field] = value;
        setSelectedExercises(updated);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) {
            toast.error("Routine name is required.");
            return;
        }
        if (selectedExercises.length === 0) {
            toast.error("Please add at least one exercise.");
            return;
        }

        try {
            const payload = {
                name: form.name,
                folder: form.folder,
                exercises: selectedExercises.map(e => ({
                    exerciseId: e.exerciseId._id,
                    sets: e.sets
                }))
            };

            const token = await getToken();
            const { data } = await api.post("/api/routine", payload, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (data.success) {
                toast.success(data.message || "Routine created successfully!");
                onRoutineCreated(data.routine);
                setShowModal(false);
            } else {
                toast.error(data.message || "Failed to create routine.");
            }
        } catch (error) {
            toast.error(error.message || "An error occurred.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-2xl bg-surface rounded-2xl shadow-xl border border-border-subtle my-auto max-h-[90vh] overflow-y-auto no-scrollbar p-6">

                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-accent-primary/10 rounded-full flex items-center justify-center">
                        <FileText className="w-5 h-5 text-accent-primary" />
                    </div>
                    <h1 className="text-xl font-bold text-text-primary">Build Routine</h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-text-primary mb-1">
                            Routine Name
                        </label>
                        <input
                            type="text"
                            className="w-full p-3 bg-background border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-accent-primary shadow-sm"
                            placeholder="e.g. Leg Day Destroyer"
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            value={form.name}
                            required
                        />
                    </div>

                    {/* Add Exercises Section */}
                    <div className="border border-border-subtle rounded-2xl p-4 bg-background">
                        <label className="block text-sm font-semibold text-text-primary mb-3">
                            Add Exercises
                        </label>
                        <div className="relative mb-3">
                            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Search exercise to add..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-surface border border-border-subtle rounded-xl pl-9 pr-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
                            />
                        </div>

                        {searchQuery && (
                            <div className="max-h-40 overflow-y-auto space-y-2 mb-4 p-2 bg-surface rounded-xl border border-border-subtle shadow-inner">
                                {exercisesData.length > 0 ? exercisesData.map(ex => (
                                    <div key={ex._id} onClick={() => addExercise(ex)} className="flex items-center justify-between p-2 hover:bg-surface-light rounded-lg cursor-pointer transition">
                                        <span className="text-sm font-medium text-text-primary">{ex.name}</span>
                                        <Plus className="w-4 h-4 text-accent-primary" />
                                    </div>
                                )) : (
                                    <p className="text-xs text-text-secondary text-center py-2">No exercises found.</p>
                                )}
                            </div>
                        )}

                        {/* Selected Exercises Configuration */}
                        {selectedExercises.length > 0 && (
                            <div className="space-y-4 mt-4">
                                {selectedExercises.map((se, exIndex) => (
                                    <div key={exIndex} className="bg-surface border border-border-subtle rounded-xl p-4 shadow-sm">
                                        <div className="flex justify-between items-center mb-4">
                                            <div className="flex items-center gap-2">
                                                <Dumbbell className="w-4 h-4 text-accent-primary" />
                                                <h4 className="font-bold text-sm text-text-primary">{se.exerciseId.name}</h4>
                                            </div>
                                            <button type="button" onClick={() => removeExercise(exIndex)} className="text-red-500 hover:text-red-600 transition p-1">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="grid grid-cols-4 gap-2 text-xs font-bold text-text-muted uppercase tracking-wider mb-1 px-1">
                                                <span className="col-span-1">Set</span>
                                                <span className="col-span-1 text-center">kg</span>
                                                <span className="col-span-1 text-center">reps</span>
                                                <span className="col-span-1"></span>
                                            </div>

                                            {se.sets.map((set, setIndex) => (
                                                <div key={setIndex} className="grid grid-cols-4 gap-2 items-center">
                                                    <div className="col-span-1 flex items-center justify-center p-2 bg-background border border-border-subtle rounded-lg text-sm text-text-secondary font-medium">
                                                        {setIndex + 1}
                                                    </div>
                                                    <div className="col-span-1">
                                                        <input
                                                            type="number"
                                                            className="w-full p-2 bg-background border border-border-subtle rounded-lg text-center text-sm text-text-primary focus:outline-none focus:border-accent-primary"
                                                            value={set.weight}
                                                            onChange={(e) => updateSet(exIndex, setIndex, "weight", Number(e.target.value))}
                                                        />
                                                    </div>
                                                    <div className="col-span-1">
                                                        <input
                                                            type="number"
                                                            className="w-full p-2 bg-background border border-border-subtle rounded-lg text-center text-sm text-text-primary focus:outline-none focus:border-accent-primary"
                                                            value={set.reps}
                                                            onChange={(e) => updateSet(exIndex, setIndex, "reps", Number(e.target.value))}
                                                        />
                                                    </div>
                                                    <div className="col-span-1 flex justify-end">
                                                        <button type="button" onClick={() => removeSet(exIndex, setIndex)} className="text-text-muted hover:text-red-500 transition p-2">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => addSet(exIndex)}
                                            className="w-full mt-3 py-2 border border-dashed border-border-subtle rounded-lg text-sm font-semibold text-text-secondary hover:text-accent-primary hover:border-accent-primary transition-colors flex items-center justify-center gap-1"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Add Set
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-border-subtle">
                        <button
                            onClick={() => setShowModal(false)}
                            type="button"
                            className="px-5 py-2.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-light font-semibold transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2.5 bg-accent-primary text-white rounded-xl hover:bg-accent-hover font-semibold transition shadow-sm"
                        >
                            Save Routine
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
};

export default RoutineBuilderModal;
