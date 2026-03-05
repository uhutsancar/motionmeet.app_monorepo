import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Activity } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const WorkoutsDetail = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const statsData = location.state?.statsData ?? null;

    const labels = statsData?.stats?.labels ?? [];
    const volumes = statsData?.stats?.volumes ?? [];
    const workoutsPerLabel = volumes.map(v => (v > 0 ? 1 : 0));
    const totalWorkouts = statsData?.totalWorkouts ?? 0;
    const avgPerSession = labels.length > 0 ? (totalWorkouts / labels.length).toFixed(1) : 0;

    const chartData = labels.map((label, i) => ({
        name: label,
        value: workoutsPerLabel[i] || 0,
    }));

    const hasData = chartData.length > 0;

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload?.length) {
            return (
                <div className="bg-[var(--surface-color)] border border-[var(--border-color)] p-3 rounded-xl shadow-lg">
                    <p className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-1">{label}</p>
                    <p className="text-sm font-bold text-[var(--text-primary)]">
                        {payload[0].value} <span className="text-[var(--text-secondary)] font-normal">{t('monthly_report.chart_unit_workouts', 'seans')}</span>
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full min-h-screen bg-[var(--background)] text-[var(--text-primary)] p-4 sm:p-8">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-full hover:bg-[var(--surface-color)] transition-colors"
                    >
                        <ArrowLeft size={22} className="text-[var(--text-primary)]" />
                    </button>
                    <h1 className="text-2xl font-black">{t('monthly_report.workouts_detail', 'Antrenmanlar Detayı')}</h1>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-[var(--surface-color)] rounded-2xl p-5 border border-[var(--border-color)]">
                        <p className="text-sm text-[var(--text-secondary)] mb-3 font-medium">{t('monthly_report.total', 'Toplam')}</p>
                        <p className="text-4xl font-black text-[var(--text-primary)]">{totalWorkouts}</p>
                        <p className="text-xs text-[var(--text-secondary)] mt-1">{t('monthly_report.chart_unit_workouts', 'seans')}</p>
                    </div>
                    <div className="bg-[var(--surface-color)] rounded-2xl p-5 border border-[var(--border-color)]">
                        <p className="text-sm text-[var(--text-secondary)] mb-3 font-medium">{t('monthly_report.avg_per_session', 'Seans Başına Ort.')}</p>
                        <p className="text-4xl font-black text-[var(--text-primary)]">{avgPerSession}</p>
                        <p className="text-xs text-[var(--text-secondary)] mt-1">{t('monthly_report.chart_unit_workouts', 'seans')}</p>
                    </div>
                </div>

                {/* Chart */}
                <div className="bg-[var(--surface-color)] rounded-2xl p-6 border border-[var(--border-color)]">
                    <h2 className="text-base font-bold text-[var(--text-secondary)] mb-6">{t('monthly_report.trend_title', 'Trend')}</h2>
                    {!hasData ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <Activity size={48} className="text-[var(--text-secondary)]" />
                            <p className="text-[var(--text-secondary)]">{t('monthly_report.no_data', 'Bu dönem için veri yok')}</p>
                        </div>
                    ) : (
                        <div className="h-[260px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} allowDecimals={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={40}>
                                        {chartData.map((_, i) => (
                                            <Cell key={i} fill="var(--accent-primary)" />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WorkoutsDetail;
