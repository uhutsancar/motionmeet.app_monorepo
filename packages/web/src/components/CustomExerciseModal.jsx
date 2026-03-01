import React, { useState } from "react";
import toast from "react-hot-toast";
import api from "~/api/axios";
import { useAuth } from "@clerk/clerk-react";
import { Dumbbell } from "lucide-react";

const CustomExerciseModal = ({ setShowModal, onExerciseCreated }) => {
    const { getToken } = useAuth();
    const [form, setForm] = useState({
        name: "",
        muscleGroup: "All Muscles",
        equipment: "All Equipment",
    });

    const muscleGroups = [
        "Abdominals", "Abductors", "Adductors", "Biceps", "Calves", "Chest",
        "Forearms", "Glutes", "Hamstrings", "Lats", "Lower Back", "Middle Back",
        "Neck", "Quadriceps", "Shoulders", "Traps", "Triceps"
    ];

    const equipmentList = [
        "Barbell", "Dumbbell", "Kettlebell", "Machine", "Cable",
        "Bodyweight", "Band", "Plate", "Other"
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) {
            toast.error("Exercise name is required.");
            return;
        }

        if (form.muscleGroup === "All Muscles" || form.equipment === "All Equipment") {
            toast.error("Please select a muscle group and equipment type");
            return;
        }

        try {
            const token = await getToken();
            const { data } = await api.post(
                "/api/exercise",
                {
                    name: form.name,
                    muscleGroup: form.muscleGroup,
                    equipment: form.equipment,
                },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (data.success) {
                toast.success(data.message || "Exercise created successfully!");
                onExerciseCreated(data.exercise);
                setShowModal(false);
            } else {
                toast.error(data.message || "Failed to create exercise.");
            }
        } catch (error) {
            toast.error(error.message || "An error occurred.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-md bg-surface rounded-2xl shadow-xl border border-border-subtle my-auto p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-accent-primary/10 rounded-full flex items-center justify-center">
                        <Dumbbell className="w-5 h-5 text-accent-primary" />
                    </div>
                    <h1 className="text-xl font-bold text-text-primary">Custom Exercise</h1>
                </div>

                <form className="space-y-4" onSubmit={handleSubmit}>
                    <div>
                        <label className="block text-sm font-semibold text-text-primary mb-1">
                            Exercise Name
                        </label>
                        <input
                            type="text"
                            className="w-full p-3 bg-background border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-accent-primary shadow-sm"
                            placeholder="e.g. Incline Bench Press"
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            value={form.name}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-text-primary mb-1">
                            Target Muscle Group
                        </label>
                        <select
                            className="w-full p-3 bg-background border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-accent-primary shadow-sm appearance-none"
                            onChange={(e) => setForm({ ...form, muscleGroup: e.target.value })}
                            value={form.muscleGroup}
                        >
                            <option disabled>All Muscles</option>
                            {muscleGroups.map((mg) => (
                                <option key={mg} value={mg}>{mg}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-text-primary mb-1">
                            Equipment Required
                        </label>
                        <select
                            className="w-full p-3 bg-background border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-accent-primary shadow-sm appearance-none"
                            onChange={(e) => setForm({ ...form, equipment: e.target.value })}
                            value={form.equipment}
                        >
                            <option disabled>All Equipment</option>
                            {equipmentList.map((eq) => (
                                <option key={eq} value={eq}>{eq}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-border-subtle mt-6">
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
                            Create
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CustomExerciseModal;
