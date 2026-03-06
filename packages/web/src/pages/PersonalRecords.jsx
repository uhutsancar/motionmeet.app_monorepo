import React, { useState } from "react";
import { ChevronLeft, Award, Flame, Trophy, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

const PersonalRecords = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    // Since we don't have dedicated PR tracking in backend yet, we use a premium static design
    // that shows what the layout looks like.
    const [records] = useState([
        { id: 1, name: "Bench Press", value: "100", unit: "kg", date: "Oct 24, 2025", icon: Trophy, color: "from-blue-500 to-indigo-600" },
        { id: 2, name: "Squat", value: "140", unit: "kg", date: "Sep 12, 2025", icon: Flame, color: "from-orange-400 to-red-500" },
        { id: 3, name: "Deadlift", value: "160", unit: "kg", date: "Nov 02, 2025", icon: Award, color: "from-amber-400 to-yellow-600" },
        { id: 4, name: "Overhead Press", value: "65", unit: "kg", date: "Aug 15, 2025", icon: Star, color: "from-emerald-400 to-teal-500" }
    ]);

    return (
        <div className="w-full min-h-screen bg-[var(--background)] p-4 sm:p-8 animate-in no-scrollbar overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-6 pb-20">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate('/statistics')}
                        className="p-3 bg-[var(--surface-color)] rounded-2xl border border-[var(--border-color)] hover:border-[var(--accent-primary)] transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6 text-[var(--text-primary)]" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">{t("statistics.records", "Kişisel Rekorlar")}</h1>
                            <div className="bg-amber-500/20 px-2 py-1 rounded-md border border-amber-500/30">
                                <span className="text-amber-500 text-[10px] font-black uppercase">PRO</span>
                            </div>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)]">{t("statistics.records_desc", "1RM ve en iyi setlerin")}</p>
                    </div>
                </div>

                {/* Content */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {records.map((record) => {
                        const Icon = record.icon;
                        return (
                            <div key={record.id} className="relative group overflow-hidden rounded-[2rem] border border-[var(--border-color)] bg-[var(--surface-color)] hover:border-[var(--accent-primary)] hover:shadow-2xl transition-all duration-300">
                                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${record.color} opacity-10 rounded-full blur-3xl group-hover:opacity-20 transition-opacity`} />

                                <div className="p-6 relative z-10 flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className={`p-3 rounded-2xl bg-gradient-to-br ${record.color} shadow-lg`}>
                                                <Icon className="w-6 h-6 text-white" />
                                            </div>
                                            <div className="bg-[var(--surface-light)] px-3 py-1 rounded-full border border-[var(--border-color)]">
                                                <span className="text-xs font-bold text-[var(--text-primary)]">1RM</span>
                                            </div>
                                        </div>

                                        <h3 className="text-xl font-black text-[var(--text-primary)] mb-1">{record.name}</h3>
                                        <p className="text-sm text-[var(--text-secondary)] font-medium">Archived on {record.date}</p>
                                    </div>

                                    <div className="text-right">
                                        <div className="flex items-baseline justify-end gap-1">
                                            <span className="text-4xl font-black text-[var(--text-primary)] tracking-tighter">{record.value}</span>
                                            <span className="text-lg font-bold text-[var(--text-secondary)]">{record.unit}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {records.length === 0 && (
                    <div className="text-center py-20 bg-[var(--surface-color)] rounded-[2rem] border border-[var(--border-color)]">
                        <Award className="w-16 h-16 mx-auto text-[var(--text-secondary)] mb-4 opacity-50" />
                        <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">No Records Yet</h3>
                        <p className="text-[var(--text-secondary)]">Log more workouts to see your personal records here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PersonalRecords;
