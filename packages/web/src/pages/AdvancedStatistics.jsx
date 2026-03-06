import React, { useState, useEffect } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChevronLeft, BarChart3, TrendingUp, Clock, Activity } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import api from "~/api/axios";

const AdvancedStatistics = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { getToken } = useAuth();

    const [period, setPeriod] = useState("month");
    const [statsData, setStatsData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const token = await getToken();
                const { data } = await api.get(`/api/workout/stats?period=${period}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (data.success) {
                    setStatsData(data.stats);
                }
            } catch (error) {
                console.error("Error fetching stats:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [period, getToken]);

    const chartData = statsData?.labels.map((label, index) => ({
        name: label,
        volume: statsData.volumes[index] || 0,
        reps: statsData.reps[index] || 0,
        duration: statsData.durations[index] || 0,
    })) || [];

    const CustomTooltip = ({ active, payload, label, unit }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-[var(--surface-color)] border border-[var(--border-color)] p-4 rounded-2xl shadow-xl">
                    <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2">{label}</p>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[var(--accent-primary)]"></div>
                        <p className="text-sm font-bold text-[var(--text-primary)]">
                            {payload[0].value.toLocaleString()}
                            <span className="text-[var(--text-secondary)] ml-1 font-medium">{unit}</span>
                        </p>
                    </div>
                </div>
            );
        }
        return null;
    };

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
                        <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">{t("statistics.advanced", "Gelişmiş İstatistikler")}</h1>
                        <p className="text-sm text-[var(--text-secondary)]">{t("statistics.advanced_desc", "Hacim, Set, Rep detayları")}</p>
                    </div>
                </div>

                {/* Period Selector */}
                <div className="flex gap-2 p-1.5 bg-[var(--surface-color)] rounded-2xl border border-[var(--border-color)] w-max mb-8">
                    {["week", "month", "year"].map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${period === p
                                ? "bg-[var(--accent-primary)] text-white shadow-lg"
                                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                }`}
                        >
                            {t(`statistics.${p}`)}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
                        <div className="h-64 bg-[var(--surface-color)] rounded-[2rem]"></div>
                        <div className="h-64 bg-[var(--surface-color)] rounded-[2rem]"></div>
                        <div className="h-64 bg-[var(--surface-color)] rounded-[2rem] md:col-span-2"></div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Volume Chart */}
                        <div className="bg-[var(--surface-color)] rounded-[2rem] border border-[var(--border-color)] p-6 shadow-sm hover:shadow-lg transition-shadow">
                            <div className="flex items-center gap-2 mb-6">
                                <TrendingUp className="w-5 h-5 text-[var(--accent-primary)]" />
                                <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('statistics.volume', 'Hacim')} (Total)</h2>
                            </div>
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.5} />
                                                <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "var(--text-secondary)", fontSize: 12 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-secondary)", fontSize: 12 }} dx={-10} />
                                        <Tooltip content={<CustomTooltip unit="kg" />} cursor={{ fill: 'transparent' }} />
                                        <Area type="monotone" dataKey="volume" stroke="var(--accent-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorVolume)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Reps Chart */}
                            <div className="bg-[var(--surface-color)] rounded-[2rem] border border-[var(--border-color)] p-6 shadow-sm hover:shadow-lg transition-shadow">
                                <div className="flex items-center gap-2 mb-6">
                                    <Activity className="w-5 h-5 text-green-500" />
                                    <h2 className="text-lg font-bold text-[var(--text-primary)]">Reps (Total)</h2>
                                </div>
                                <div className="h-[250px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "var(--text-secondary)", fontSize: 12 }} dy={10} />
                                            <Tooltip content={<CustomTooltip unit="reps" />} cursor={{ fill: 'var(--surface-light)' }} />
                                            <Bar dataKey="reps" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Duration Chart */}
                            <div className="bg-[var(--surface-color)] rounded-[2rem] border border-[var(--border-color)] p-6 shadow-sm hover:shadow-lg transition-shadow">
                                <div className="flex items-center gap-2 mb-6">
                                    <Clock className="w-5 h-5 text-blue-500" />
                                    <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('statistics.duration', 'Süre')} (Mins)</h2>
                                </div>
                                <div className="h-[250px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData}>
                                            <defs>
                                                <linearGradient id="colorDuration" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "var(--text-secondary)", fontSize: 12 }} dy={10} />
                                            <Tooltip content={<CustomTooltip unit="min" />} cursor={{ fill: 'transparent' }} />
                                            <Area type="monotone" dataKey="duration" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorDuration)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdvancedStatistics;
