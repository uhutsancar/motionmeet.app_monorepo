import React, { useState, useEffect } from "react";
import {
    LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import {
    TrendingUp, Calendar, Clock, BarChart3, Dumbbell,
    Flame, ChevronRight, Activity, Zap
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@clerk/clerk-react";
import api from "~/api/axios";
import moment from "moment";

const Statistics = () => {
    const { t } = useTranslation();
    const { getToken } = useAuth();

    const [period, setPeriod] = useState("month");
    const [statsData, setStatsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("volume"); // volume | duration | reps

    const fetchStats = async () => {
        setLoading(true);
        try {
            const token = await getToken();
            const { data } = await api.get(`/api/workout/stats?period=${period}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (data.success) {
                setStatsData(data);
            }
        } catch (error) {
            console.error("Error fetching stats:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, [period, getToken]);

    // Format data for Recharts
    const chartData = statsData?.stats?.labels.map((label, index) => ({
        name: label,
        volume: statsData.stats.volumes[index],
        duration: statsData.stats.durations[index],
        reps: statsData.stats.reps[index],
    })) || [];

    const exerciseData = statsData?.exerciseBreakdown?.map(ex => ({
        name: ex.name,
        value: ex.total
    })) || [];

    const statsHeader = [
        {
            label: t("statistics.total_volume", "Total Volume"),
            value: `${statsData?.totalVolume?.toLocaleString() || 0}`,
            unit: "kg",
            icon: TrendingUp,
            color: "text-accent-primary",
            bg: "bg-accent-primary/10"
        },
        {
            label: t("statistics.total_duration", "Total Duration"),
            value: `${statsData?.totalDuration || 0}`,
            unit: "min",
            icon: Clock,
            color: "text-blue-500",
            bg: "bg-blue-500/10"
        },
        {
            label: t("statistics.calories_burned", "Calories Burned"),
            value: `${statsData?.totalCalories?.toLocaleString() || 0}`,
            unit: "kcal",
            icon: Flame,
            color: "text-orange-500",
            bg: "bg-orange-500/10"
        },
        {
            label: t("statistics.total_workouts", "Workouts"),
            value: `${statsData?.totalWorkouts || 0}`,
            unit: "",
            icon: Activity,
            color: "text-green-500",
            bg: "bg-green-500/10"
        }
    ];

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-surface border border-border-subtle p-4 rounded-2xl shadow-xl">
                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-2">{label}</p>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-accent-primary"></div>
                        <p className="text-sm font-bold text-text-primary">
                            {payload[0].value.toLocaleString()}
                            <span className="text-text-muted ml-1 font-medium">
                                {activeTab === "volume" ? "kg" : activeTab === "duration" ? "min" : "reps"}
                            </span>
                        </p>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full min-h-screen bg-background p-4 sm:p-8 animate-in no-scrollbar overflow-y-auto">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-accent-primary/10 rounded-xl border border-accent-primary/20">
                                <BarChart3 className="w-5 h-5 text-accent-primary" />
                            </div>
                            <h1 className="text-3xl font-bold tracking-tight text-text-primary">{t("statistics.title", "Analytics")}</h1>
                        </div>
                        <p className="text-text-secondary text-sm font-medium">{t("statistics.subtitle", "Your fitness journey in numbers and trends.")}</p>
                    </div>

                    <div className="flex items-center bg-surface p-1 rounded-2xl border border-border-subtle shadow-sm self-start">
                        {["week", "month", "year"].map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${period === p
                                    ? "bg-accent-primary text-white shadow-md shadow-accent-primary/20"
                                    : "text-text-muted hover:text-text-primary hover:bg-surface-light"
                                    }`}
                            >
                                {t(`statistics.${p}`, p.charAt(0).toUpperCase() + p.slice(1))}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {statsHeader.map((stat, idx) => (
                        <div key={idx} className="bg-surface p-6 rounded-3xl border border-border-subtle shadow-sm hover:shadow-md transition-all group">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-3 ${stat.bg} rounded-2xl transition-transform group-hover:scale-110`}>
                                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                                </div>
                                <Zap className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-30 transition-opacity" />
                            </div>
                            <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">{stat.label}</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black text-text-primary">{stat.value}</span>
                                <span className="text-xs font-bold text-text-muted">{stat.unit}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Progress Chart */}
                <div className="bg-surface rounded-[2rem] border border-border-subtle shadow-sm p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
                        <div>
                            <h2 className="text-xl font-bold text-text-primary tracking-tight mb-1">{t("statistics.progress_trends", "Progress Trends")}</h2>
                            <p className="text-xs text-text-muted font-medium uppercase tracking-widest">{period === "week" ? "Last 7 Days" : period === "month" ? "Last 30 Days" : "This Year"}</p>
                        </div>

                        <div className="flex items-center gap-2 bg-surface-light p-1 rounded-2xl border border-border-subtle self-start">
                            {["volume", "duration", "reps"].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-4 py-2 text-[10px] font-black uppercase tracking-tighter rounded-xl transition-all ${activeTab === tab
                                        ? "bg-surface text-accent-primary border border-border-subtle shadow-sm"
                                        : "text-text-muted hover:text-accent-primary"
                                        }`}
                                >
                                    {t(`profile.${tab}`)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-[350px] w-full">
                        {loading ? (
                            <div className="h-full flex items-center justify-center">
                                <Activity className="w-8 h-8 text-accent-primary animate-spin opacity-20" />
                            </div>
                        ) : chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" opacity={0.5} />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 'bold' }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 'bold' }}
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--accent-primary)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                    <Area
                                        type="monotone"
                                        dataKey={activeTab}
                                        stroke="var(--accent-primary)"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorValue)"
                                        animationDuration={1500}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                                <Dumbbell className="w-12 h-12 mb-4" />
                                <p className="text-sm font-bold uppercase tracking-widest">{t("common.no_data")}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Exercise Breakdown */}
                    <div className="lg:col-span-2 bg-surface rounded-[2rem] border border-border-subtle shadow-sm p-8">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-bold text-text-primary tracking-tight">{t("statistics.top_exercises", "Top Exercises")}</h2>
                            <Dumbbell className="w-5 h-5 text-text-muted" />
                        </div>

                        <div className="h-[300px] w-full">
                            {loading ? (
                                <div className="h-full flex items-center justify-center">
                                    <Activity className="w-8 h-8 text-accent-primary animate-spin opacity-20" />
                                </div>
                            ) : exerciseData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={exerciseData} layout="vertical" margin={{ left: 40 }}>
                                        <XAxis type="number" hide />
                                        <YAxis
                                            dataKey="name"
                                            type="category"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: 'var(--text-primary)', fontSize: 11, fontWeight: '700' }}
                                            width={100}
                                        />
                                        <Tooltip
                                            cursor={{ fill: 'var(--surface-light)', opacity: 0.5 }}
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <div className="bg-surface border border-border-subtle p-3 rounded-xl shadow-lg">
                                                            <p className="text-xs font-bold text-accent-primary">{payload[0].value} {t("routines.reps")}</p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={20}>
                                            {exerciseData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={index === 0 ? 'var(--accent-primary)' : 'var(--text-muted)'}
                                                    opacity={0.8 - (index * 0.1)}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center opacity-30">
                                    <p className="text-sm font-bold uppercase tracking-widest">{t("common.no_data")}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Performance Records */}
                    <div className="bg-gradient-to-br from-accent-primary to-accent-primary/80 rounded-[2rem] p-8 text-white relative overflow-hidden flex flex-col justify-between">
                        <div className="relative z-10">
                            <Zap className="w-10 h-10 mb-6 opacity-80" />
                            <h2 className="text-2xl font-black mb-2">{t("statistics.best_performance")}</h2>
                            <p className="text-white/60 text-sm font-bold uppercase tracking-widest mb-8">{t("statistics.reached_milestones")}</p>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20">
                                            <TrendingUp className="w-4 h-4 text-white" />
                                        </div>
                                        <span className="text-sm font-bold">{t("statistics.max_volume")}</span>
                                    </div>
                                    <span className="text-sm font-black">{statsData?.totalVolume?.toLocaleString() || 0} kg</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20">
                                            <Zap className="w-4 h-4 text-white" />
                                        </div>
                                        <span className="text-sm font-bold">{t("statistics.intense_session")}</span>
                                    </div>
                                    <span className="text-sm font-black">-- %</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20">
                                            <Calendar className="w-4 h-4 text-white" />
                                        </div>
                                        <span className="text-sm font-bold">{t("statistics.streak")}</span>
                                    </div>
                                    <span className="text-sm font-black">-- days</span>
                                </div>
                            </div>
                        </div>

                        <button className="relative z-10 w-full bg-white text-accent-primary py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-accent-primary/20 hover:scale-[1.02] transition-transform active:scale-95 mt-8">
                            {t("statistics.view_records")}
                        </button>

                        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                        <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Statistics;
