import React, { useState, useEffect } from 'react';
import { ArrowLeft, HelpCircle, Share, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import api from '~/api/axios';

const MUSCLE_LABELS = {
    Chest: 'Göğüs',
    Back: 'Sırt',
    Legs: 'Bacak',
    Shoulders: 'Omuz',
    Arms: 'Kol',
    Abs: 'Core Bölgesi',
};
const MUSCLE_KEYS = Object.keys(MUSCLE_LABELS);

const MuscleDistribution = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { getToken } = useAuth();

    const [period, setPeriod] = useState('month');
    const [showDropdown, setShowDropdown] = useState(false);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    const periodLabels = {
        week: 'Son 7 Gün',
        month: 'Son 30 Gün',
        year: 'Son 1 Yıl',
    };

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const token = await getToken();
                const { data } = await api.get(`/api/workout/stats?period=${period}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (data.success) {
                    setStats(data);
                }
            } catch (error) {
                console.error('Error fetching stats:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [period, getToken]);

    // Radar chart values (0–1) from backend or zeros
    const values = MUSCLE_KEYS.map(k => stats?.muscleDistribution?.[k] ?? 0);
    const angles = MUSCLE_KEYS.map((_, i) => (Math.PI * 2 * i) / MUSCLE_KEYS.length - Math.PI / 2);

    const SIZE = 300;
    const CENTER = SIZE / 2;
    const RADIUS = SIZE / 2 - 40;

    const getPoint = (val, idx) => {
        const r = RADIUS * Math.max(val, 0.02); // show faint shape even at 0
        return `${CENTER + r * Math.cos(angles[idx])},${CENTER + r * Math.sin(angles[idx])}`;
    };

    const currentPolygon = values.map((v, i) => getPoint(v, i)).join(' ');
    const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

    return (
        <div className="w-full min-h-screen bg-background text-text-primary p-4 lg:p-8 flex flex-col items-center">
            {/* Header */}
            <div className="w-full max-w-2xl flex items-center justify-between mb-8">
                <button onClick={() => navigate('/statistics')} className="p-2 hover:bg-surface rounded-full transition-colors">
                    <ArrowLeft className="w-6 h-6 text-text-primary" />
                </button>
                <h1 className="text-xl font-bold">{t('statistics.muscle_dist', 'Kas Dağılımı')}</h1>
                <div className="flex items-center gap-2">
                    <button className="p-2 hover:bg-surface rounded-full transition-colors">
                        <HelpCircle className="w-6 h-6 text-text-muted" />
                    </button>
                    <button className="p-2 hover:bg-surface rounded-full transition-colors">
                        <Share className="w-6 h-6 text-text-muted" />
                    </button>
                </div>
            </div>

            {/* Period Dropdown */}
            <div className="relative mb-12">
                <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="flex items-center gap-2 bg-surface hover:bg-surface-light px-6 py-2.5 rounded-full border border-border-subtle transition-colors"
                >
                    <span className="font-semibold text-text-primary">{periodLabels[period]}</span>
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                </button>
                {showDropdown && (
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-surface border border-border-subtle rounded-2xl shadow-2xl z-10 overflow-hidden">
                        {Object.entries(periodLabels).map(([key, label]) => (
                            <button
                                key={key}
                                onClick={() => { setPeriod(key); setShowDropdown(false); }}
                                className={`block w-full text-left px-6 py-3 text-sm font-semibold transition-colors hover:bg-surface-light ${period === key ? 'text-accent-primary' : 'text-text-primary'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Radar Chart */}
            {loading ? (
                <div className="w-[300px] h-[300px] flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="flex flex-col items-center mb-16 relative">
                    <svg width={SIZE} height={SIZE} className="overflow-visible">
                        {/* Grid */}
                        {gridLevels.map((lvl, index) => (
                            <polygon
                                key={`grid-${index}`}
                                points={MUSCLE_KEYS.map((_, i) => getPoint(lvl, i)).join(' ')}
                                stroke="var(--border-subtle)"
                                strokeWidth="1"
                                fill="none"
                            />
                        ))}
                        {/* Axes */}
                        {MUSCLE_KEYS.map((_, i) => (
                            <line
                                key={`axis-${i}`}
                                x1={CENTER} y1={CENTER}
                                x2={CENTER + RADIUS * Math.cos(angles[i])}
                                y2={CENTER + RADIUS * Math.sin(angles[i])}
                                stroke="var(--border-subtle)"
                                strokeWidth="1"
                            />
                        ))}
                        {/* Data polygon */}
                        <polygon
                            points={currentPolygon}
                            stroke="var(--accent-primary)"
                            strokeWidth="2"
                            fill="var(--accent-primary)"
                            fillOpacity="0.15"
                            className="transition-all duration-700 ease-in-out"
                        />
                        {/* Labels */}
                        {MUSCLE_KEYS.map((key, i) => {
                            const x = CENTER + (RADIUS + 30) * Math.cos(angles[i]);
                            const y = CENTER + (RADIUS + 30) * Math.sin(angles[i]);
                            return (
                                <text
                                    key={`label-${i}`}
                                    x={x}
                                    y={y + 4}
                                    fontSize="12"
                                    fontWeight="600"
                                    fill="var(--text-muted)"
                                    textAnchor="middle"
                                >
                                    {MUSCLE_LABELS[key]}
                                </text>
                            );
                        })}
                    </svg>

                    {/* Legend */}
                    <div className="flex items-center gap-6 mt-12 bg-surface px-6 py-3 rounded-2xl border border-border-subtle">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-accent-primary"></div>
                            <span className="text-sm text-text-muted font-medium">{t('statistics.current', 'Güncel')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-text-muted"></div>
                            <span className="text-sm text-text-muted font-medium">{t('statistics.previous', 'Önceki')}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Grid — dynamic */}
            <div className="w-full max-w-2xl grid grid-cols-2 gap-4">
                <div className="bg-surface rounded-3xl p-6 border border-border-subtle flex flex-col items-start hover:border-accent-primary/30 transition-colors">
                    <span className="text-sm font-semibold text-text-muted mb-3">{t('statistics.workouts', 'Antrenman')}</span>
                    <span className="text-3xl font-black text-text-primary mb-1">{stats?.totalWorkouts ?? 0}</span>
                    <span className="text-xs font-bold text-emerald-500">↑ {stats?.totalWorkouts ?? 0}</span>
                </div>
                <div className="bg-surface rounded-3xl p-6 border border-border-subtle flex flex-col items-start hover:border-accent-primary/30 transition-colors">
                    <span className="text-sm font-semibold text-text-muted mb-3">{t('statistics.duration', 'Süre')}</span>
                    <span className="text-3xl font-black text-text-primary mb-1">{stats?.totalDuration ?? 0} <span className="text-base font-medium">min</span></span>
                    <span className="text-xs font-bold text-emerald-500">↑ {stats?.totalDuration ?? 0}min</span>
                </div>
                <div className="bg-surface rounded-3xl p-6 border border-border-subtle flex flex-col items-start hover:border-accent-primary/30 transition-colors">
                    <span className="text-sm font-semibold text-text-muted mb-3">{t('statistics.volume', 'Hacim')}</span>
                    <span className="text-3xl font-black text-text-primary mb-1">{stats?.totalVolume ?? 0} <span className="text-base font-medium">kg</span></span>
                    <span className="text-xs font-bold text-emerald-500">↑ {stats?.totalVolume ?? 0} kg</span>
                </div>
                <div className="bg-surface rounded-3xl p-6 border border-border-subtle flex flex-col items-start hover:border-accent-primary/30 transition-colors">
                    <span className="text-sm font-semibold text-text-muted mb-3">{t('statistics.sets', 'Set')}</span>
                    <span className="text-3xl font-black text-text-primary mb-1">{stats?.totalSets ?? 0}</span>
                    <span className="text-xs font-bold text-emerald-500">↑ {stats?.totalSets ?? 0}</span>
                </div>
            </div>
        </div>
    );
};

export default MuscleDistribution;
