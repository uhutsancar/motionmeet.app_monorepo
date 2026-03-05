import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, Cell,
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { ArrowLeft, Flame, Share, ChevronRight } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import api from '~/api/axios';

const MonthlyReport = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { getToken } = useAuth();
    const [activeTab, setActiveTab] = useState('workouts');
    const [statsData, setStatsData] = useState(null);
    const [loading, setLoading] = useState(true);

    const now = new Date();
    const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const monthName = MONTHS_TR[now.getMonth()] + ' ' + now.getFullYear();

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const token = await getToken();
                const { data } = await api.get('/api/workout/stats?period=month', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (data.success) setStatsData(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [getToken]);

    const labels = statsData?.stats?.labels ?? [];
    const volumes = statsData?.stats?.volumes ?? [];
    const durations = statsData?.stats?.durations ?? [];
    const reps = statsData?.stats?.reps ?? [];

    const getChartValues = () => {
        if (activeTab === 'volume') return volumes;
        if (activeTab === 'duration') return durations;
        if (activeTab === 'sets') return reps;
        return volumes.map(v => (v > 0 ? 1 : 0));
    };

    const chartData = labels.map((label, i) => ({
        name: label,
        value: getChartValues()[i] || 0,
    }));

    const getBarColor = () => {
        if (activeTab === 'duration') return '#3b82f6';
        if (activeTab === 'sets') return '#a855f7';
        return 'var(--accent-primary)';
    };

    const getUnit = () => {
        if (activeTab === 'volume') return 'kg';
        if (activeTab === 'duration') return t('monthly_report.chart_unit_duration', 'dk');
        if (activeTab === 'sets') return t('monthly_report.chart_unit_sets', 'set');
        return t('monthly_report.chart_unit_workouts', 'seans');
    };

    // Radar chart data
    const MUSCLE_KEYS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Abs'];
    const MUSCLE_TR = { Chest: 'Göğüs', Back: 'Sırt', Legs: 'Bacak', Shoulders: 'Omuz', Arms: 'Kol', Abs: 'Core' };
    const radarData = MUSCLE_KEYS.map(k => ({
        subject: MUSCLE_TR[k],
        A: 0.1,
        B: statsData?.muscleDistribution?.[k] ?? 0.02,
        fullMark: 1.0
    }));

    const daysOfWeek = [
        t('monthly_report.days.mon', 'Pzt'), t('monthly_report.days.tue', 'Sal'),
        t('monthly_report.days.wed', 'Çar'), t('monthly_report.days.thu', 'Per'),
        t('monthly_report.days.fri', 'Cum'), t('monthly_report.days.sat', 'Cts'),
        t('monthly_report.days.sun', 'Paz')
    ];
    const calendarDays = [null, null, null, null, null, null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28];

    const tabs = [
        { id: 'workouts', label: t('monthly_report.workouts', 'Antrenmanlar') },
        { id: 'duration', label: t('monthly_report.duration', 'Süre') },
        { id: 'volume', label: t('monthly_report.volume', 'Hacim') },
        { id: 'sets', label: t('monthly_report.sets', 'Set') }
    ];

    // Stat cards with routes
    const statCards = [
        {
            key: 'workouts',
            label: t('monthly_report.workouts', 'Antrenmanlar'),
            value: statsData?.totalWorkouts ?? 0,
            unit: '',
            route: '/statistics/monthly-report/workouts',
            accentColor: 'var(--accent-primary)',
        },
        {
            key: 'duration',
            label: t('monthly_report.duration', 'Süre'),
            value: statsData?.totalDuration ?? 0,
            unit: 'min',
            route: '/statistics/monthly-report/duration',
            accentColor: '#3b82f6',
        },
        {
            key: 'volume',
            label: t('monthly_report.volume', 'Hacim'),
            value: statsData?.totalVolume ?? 0,
            unit: 'kg',
            route: '/statistics/monthly-report/volume',
            accentColor: 'var(--accent-primary)',
        },
        {
            key: 'sets',
            label: t('monthly_report.sets', 'Set'),
            value: statsData?.totalSets ?? 0,
            unit: '',
            route: '/statistics/monthly-report/sets',
            accentColor: '#a855f7',
        },
    ];

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload?.length) {
            return (
                <div className="bg-[var(--surface-color)] border border-[var(--border-color)] p-3 rounded-xl shadow-lg">
                    <p className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">{label}</p>
                    <p className="text-sm font-bold text-[var(--text-primary)]">
                        {payload[0].value?.toLocaleString() ?? 0}
                        <span className="text-[var(--text-secondary)] font-normal ml-1">{getUnit()}</span>
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="flex flex-col h-full bg-[var(--background)] text-[var(--text-primary)]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-[var(--surface-color)] transition-colors">
                    <ArrowLeft size={24} className="text-[var(--text-primary)]" />
                </button>
                <h1 className="text-lg font-bold">{monthName}</h1>
                <div className="w-10"></div>
            </div>

            <div className="flex-1 overflow-y-auto pb-24">
                {/* Title */}
                <div className="px-5 pt-6 pb-2">
                    <h2 className="text-2xl font-bold">{monthName}</h2>
                    <p className="text-[var(--text-secondary)] mt-1">
                        {statsData?.totalWorkouts ?? 0} {t('monthly_report.workouts', 'Antrenmanlar').toLowerCase()}
                    </p>
                </div>

                {/* Tabs */}
                <div className="px-4 mt-4 overflow-x-auto no-scrollbar">
                    <div className="flex gap-3 min-w-max pb-2">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-5 py-2 rounded-full border transition-colors ${activeTab === tab.id
                                    ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-black font-semibold'
                                    : 'bg-[var(--surface-color)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--border-color)]'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Bar Chart */}
                <div className="px-4 mt-4">
                    {loading ? (
                        <div className="h-[220px] flex items-center justify-center">
                            <div className="w-8 h-8 border-2 border-accent-primary/30 border-t-[var(--accent-primary)] rounded-full animate-spin" />
                        </div>
                    ) : (
                        <div className="bg-[var(--surface-color)] rounded-2xl border border-[var(--border-color)] p-4">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-sm font-semibold text-[var(--text-secondary)]">{t('monthly_report.trend_title', 'Trend')}</span>
                                <span className="text-xs text-[var(--text-secondary)] bg-[var(--background)] px-2 py-1 rounded-full border border-[var(--border-color)]">{getUnit()}</span>
                            </div>
                            {chartData.length === 0 ? (
                                <div className="h-[180px] flex items-center justify-center">
                                    <p className="text-[var(--text-secondary)] text-sm">{t('monthly_report.no_data', 'Bu dönem için veri yok')}</p>
                                </div>
                            ) : (
                                <div className="h-[200px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} margin={{ top: 16, right: 4, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                            <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'var(--border-color)', opacity: 0.3 }} />
                                            <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={36}>
                                                {chartData.map((_, i) => (
                                                    <Cell key={i} fill={getBarColor()} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="h-px bg-[var(--surface-color)] my-8"></div>

                {/* Summary Grid - Clickable */}
                <div className="px-5">
                    <h3 className="text-base font-semibold text-[var(--text-secondary)] mb-4">{t('monthly_report.summary', 'Özet')}</h3>
                    <div className="grid grid-cols-2 gap-4">
                        {statCards.map(card => (
                            <button
                                key={card.key}
                                onClick={() => navigate(card.route, { state: { statsData } })}
                                className="bg-[var(--surface-color)] rounded-2xl border border-[var(--border-color)] p-4 text-left hover:border-[var(--accent-primary)] hover:shadow-sm transition-all group relative overflow-hidden"
                            >
                                {/* Color accent bar at bottom */}
                                <div
                                    className="absolute bottom-0 left-0 right-0 h-[3px] rounded-b-2xl"
                                    style={{ backgroundColor: card.accentColor }}
                                />
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[var(--text-primary)] font-medium text-sm">{card.label}</span>
                                    <ChevronRight size={14} className="text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)] transition-colors" />
                                </div>
                                <div className="text-2xl font-bold mb-1">
                                    {card.value?.toLocaleString() ?? 0}
                                    {card.unit && <span className="text-base font-normal ml-1">{card.unit}</span>}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="h-px bg-[var(--surface-color)] my-8"></div>

                {/* Workout Days Log / Calendar */}
                <div className="px-5">
                    <h3 className="text-base font-semibold text-[var(--text-secondary)] mb-6">{t('monthly_report.workout_days_log', 'Antrenman Günleri Kaydı')}</h3>
                    <div className="flex flex-col items-center justify-center mb-8">
                        <Flame size={48} className="text-red-500 fill-red-500 drop-shadow-md" />
                        <div className="text-lg font-bold mt-2">{t('monthly_report.weekly_streak', { count: 0 }, '0 Haftalık Seri')}</div>
                    </div>
                    <div className="w-full">
                        <div className="grid grid-cols-7 mb-2">
                            {daysOfWeek.map((d, i) => (
                                <div key={i} className="text-center text-xs pb-2 text-[var(--text-secondary)]">{d}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-y-2 text-center">
                            {calendarDays.map((num, i) => (
                                <div key={i} className="h-10 flex items-center justify-center">
                                    {num && <span className="text-[var(--text-primary)] font-medium">{num}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="h-px bg-[var(--surface-color)] my-8"></div>

                {/* Muscle Distribution */}
                <div className="px-5 mb-10">
                    <h3 className="text-base font-semibold text-[var(--text-secondary)] mb-6">{t('monthly_report.muscle_distribution', 'Kas Dağılımı')}</h3>
                    <div className="flex flex-col items-center">
                        <div className="w-full max-w-[350px] aspect-square">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart outerRadius="70%" data={radarData}>
                                    <PolarGrid stroke="var(--border-color)" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 1.0]} tick={false} axisLine={false} />
                                    <Radar name="Önceki Ay" dataKey="A" stroke="var(--text-secondary)" fill="none" strokeWidth={2} />
                                    <Radar name="Bu Ay" dataKey="B" stroke="var(--accent-primary)" fill="var(--accent-primary)" fillOpacity={0.2} strokeWidth={2} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex gap-6 mt-2">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-[var(--text-secondary)]"></div>
                                <span className="text-xs text-[var(--text-secondary)]">
                                    {MONTHS_TR[now.getMonth() === 0 ? 11 : now.getMonth() - 1]} {now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)]"></div>
                                <span className="text-xs text-[var(--text-secondary)]">{monthName}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky Bottom Share Button */}
            <div className="fixed sm:absolute bottom-0 left-0 right-0 p-5 bg-[var(--background)] border-t border-[var(--border-color)]">
                <button className="w-full bg-[var(--accent-primary)] text-black font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all">
                    <Share size={20} className="text-black" />
                    <span>{t('monthly_report.share', 'Paylaş')}</span>
                </button>
            </div>
        </div>
    );
};

export default MonthlyReport;
