import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { ArrowLeft, Flame, Share } from 'lucide-react';
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

    // Chart data from backend
    const chartData = (statsData?.stats?.labels || []).map((label, i) => ({
        name: label,
        value: activeTab === 'volume' ? (statsData.stats.volumes[i] || 0)
            : activeTab === 'duration' ? (statsData.stats.durations[i] || 0)
                : activeTab === 'sets' ? (statsData.stats.reps[i] || 0)
                    : 1,
    }));

    // Radar data from backend
    const MUSCLE_KEYS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Abs'];
    const MUSCLE_TR = { Chest: 'Göğüs', Back: 'Sırt', Legs: 'Bacak', Shoulders: 'Omuz', Arms: 'Kol', Abs: 'Core Bölgesi' };
    const radarData = MUSCLE_KEYS.map(k => ({
        subject: MUSCLE_TR[k],
        A: 0.1,
        B: statsData?.muscleDistribution?.[k] ?? 0.02,
        fullMark: 1.0
    }));

    const daysOfWeek = [
        t('monthly_report.days.mon', 'Pzt'), t('monthly_report.days.tue', 'Sal'), t('monthly_report.days.wed', 'Çar'),
        t('monthly_report.days.thu', 'Per'), t('monthly_report.days.fri', 'Cum'), t('monthly_report.days.sat', 'Cts'), t('monthly_report.days.sun', 'Paz')
    ];
    const calendarDays = [null, null, null, null, null, null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28];

    const tabs = [
        { id: 'workouts', label: t('monthly_report.workouts', 'Antrenmanlar') },
        { id: 'duration', label: t('monthly_report.duration', 'Süre') },
        { id: 'volume', label: t('monthly_report.volume', 'Hacim') },
        { id: 'sets', label: t('monthly_report.sets', 'Set') }
    ];

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
                {/* Title & Delta */}
                <div className="px-5 pt-6 pb-2">
                    <h2 className="text-2xl font-bold">{monthName}</h2>
                    <p className="text-[var(--text-secondary)] mt-1">{statsData?.totalWorkouts ?? 0} antrenman</p>
                </div>

                {/* Trend Area Chart */}
                <div className="h-[200px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                            <RechartsTooltip
                                contentStyle={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                                itemStyle={{ color: 'var(--accent-primary)' }}
                            />
                            <Area type="monotone" dataKey="value" stroke="var(--accent-primary)" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Tabs */}
                <div className="px-4 mt-6 overflow-x-auto no-scrollbar">
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

                <div className="h-px bg-[var(--surface-color)] my-8"></div>

                {/* Summary Grid */}
                <div className="px-5">
                    <h3 className="text-base font-semibold text-[var(--text-secondary)] mb-4">{t('monthly_report.summary', 'Özet')}</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[var(--surface-color)] rounded-2xl p-4 border border-[var(--border-color)]">
                            <div className="text-[var(--text-primary)] font-medium text-sm mb-3">{t('monthly_report.workouts', 'Antrenmanlar')}</div>
                            <div className="text-2xl font-bold mb-1">{statsData?.totalWorkouts ?? 0}</div>
                            <div className="text-sm text-emerald-500 font-semibold">↑ {statsData?.totalWorkouts ?? 0}</div>
                        </div>
                        <div className="bg-[var(--surface-color)] rounded-2xl p-4 border border-[var(--border-color)]">
                            <div className="text-[var(--text-primary)] font-medium text-sm mb-3">{t('monthly_report.duration', 'Süre')}</div>
                            <div className="text-2xl font-bold mb-1">{statsData?.totalDuration ?? 0}<span className="text-base font-normal ml-1">min</span></div>
                            <div className="text-sm text-emerald-500 font-semibold">↑ {statsData?.totalDuration ?? 0}min</div>
                        </div>
                        <div className="bg-[var(--surface-color)] rounded-2xl p-4 border border-[var(--border-color)]">
                            <div className="text-[var(--text-primary)] font-medium text-sm mb-3">{t('monthly_report.volume', 'Hacim')}</div>
                            <div className="text-2xl font-bold mb-1">{statsData?.totalVolume ?? 0} <span className="text-base font-normal ml-1">kg</span></div>
                            <div className="text-sm text-emerald-500 font-semibold">↑ {statsData?.totalVolume ?? 0} kg</div>
                        </div>
                        <div className="bg-[var(--surface-color)] rounded-2xl p-4 border border-[var(--border-color)]">
                            <div className="text-[var(--text-primary)] font-medium text-sm mb-3">{t('monthly_report.sets', 'Set')}</div>
                            <div className="text-2xl font-bold mb-1">{statsData?.totalSets ?? 0}</div>
                            <div className="text-sm text-emerald-500 font-semibold">↑ {statsData?.totalSets ?? 0}</div>
                        </div>
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
                                <div key={i} className={`text-center text-xs pb-2 ${i === 6 ? 'text-[var(--text-primary)] font-bold border-b border-[var(--border-color)]' : 'text-[var(--text-secondary)]'}`}>
                                    {d}
                                </div>
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
                                    <Radar name="Ocak 2026" dataKey="A" stroke="var(--text-secondary)" fill="none" strokeWidth={2} />
                                    <Radar name="Şubat 2026" dataKey="B" stroke="var(--accent-primary)" fill="var(--accent-primary)" fillOpacity={0.2} strokeWidth={2} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="flex gap-6 mt-2">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-[var(--text-secondary)]"></div>
                                <span className="text-xs text-[var(--text-secondary)]">Ocak 2026</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)]"></div>
                                <span className="text-xs text-[var(--text-secondary)]">Şubat 2026</span>
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
