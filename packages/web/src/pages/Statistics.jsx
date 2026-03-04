import React, { useState, useEffect } from "react";
import {
    LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import {
    TrendingUp, Calendar, Clock, BarChart3, Dumbbell,
    Flame, ChevronRight, Activity, Zap, ActivitySquare, Award
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import api from "~/api/axios";
import moment from "moment";

const Statistics = () => {
    const { t } = useTranslation();
    const { getToken } = useAuth();
    const navigate = useNavigate();

    const menuItems = [
        {
            title: t('statistics.advanced', 'Gelişmiş İstatistikler'),
            subtitle: t('statistics.advanced_desc', 'Hacim, Set, Rep detayları'),
            icon: <ActivitySquare className="w-8 h-8 text-accent-primary" />,
            route: '/statistics/history',
            isPro: false
        },
        {
            title: t('statistics.muscle_dist', 'Kas Dağılımı'),
            subtitle: t('statistics.muscle_dist_desc', 'Hangi kasları çalıştırdığını gör'),
            icon: <Dumbbell className="w-8 h-8 text-purple-500" />,
            route: '/statistics/muscle-distribution',
            isPro: false
        },
        {
            title: t('statistics.records', 'Kişisel Rekorlar'),
            subtitle: t('statistics.records_desc', '1RM ve en iyi setlerin'),
            icon: <Award className="w-8 h-8 text-amber-500" />,
            route: '/statistics/records',
            isPro: true
        },
        {
            title: t('statistics.monthly_report', 'Aylık Rapor'),
            subtitle: t('statistics.monthly_desc', 'Aylık antrenman ve istatistiklerinizin özeti.'),
            icon: <Calendar className="w-8 h-8 text-blue-500" />,
            route: '/statistics/monthly-report',
            isPro: false
        }
    ];

    const [period, setPeriod] = useState("month");
    const [statsData, setStatsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("volume");

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
            <div className="max-w-4xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 bg-accent-primary/10 rounded-2xl border border-accent-primary/20">
                            <BarChart3 className="w-6 h-6 text-accent-primary" />
                        </div>
                        <h1 className="text-3xl font-black tracking-tight text-text-primary">{t("statistics.title", "İstatistikler")}</h1>
                    </div>
                </div>

                {/* Grid Menu */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {menuItems.map((item, idx) => (
                        <div
                            key={idx}
                            onClick={() => navigate(item.route)}
                            className="bg-surface rounded-[2rem] border border-border-subtle p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-accent-primary hover:shadow-lg transition-all group relative"
                        >
                            {/* PRO Badge */}
                            {item.isPro && (
                                <div className="absolute top-4 right-4 bg-amber-500/20 px-2 py-1 rounded-md border border-amber-500/30">
                                    <span className="text-amber-500 text-[10px] font-black uppercase">PRO</span>
                                </div>
                            )}

                            <div className="p-4 bg-surface-light rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                                {item.icon}
                            </div>
                            <h3 className="text-lg font-bold text-text-primary mb-2 group-hover:text-accent-primary transition-colors">{item.title}</h3>
                            <p className="text-sm text-text-muted">{item.subtitle}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Statistics;
