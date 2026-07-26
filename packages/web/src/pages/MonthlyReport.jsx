import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, Cell,
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { useAuthContext } from "../context/AuthProvider";
import { API_ROUTES } from '@motionmeet/shared';
import api from '~/api/axios';
import { useMuscleGroups } from '~/hooks/useMuscleGroups';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import { alpha, useTheme } from '@mui/material/styles';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import LocalFireDepartmentRounded from '@mui/icons-material/LocalFireDepartmentRounded';
import ShareRounded from '@mui/icons-material/ShareRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';

const MonthlyReport = () => {
    const { t, i18n } = useTranslation();
    const theme = useTheme();
    const navigate = useNavigate();
    const { getToken } = useAuthContext();
    const { data: muscleGroupsList } = useMuscleGroups();
    const [activeTab, setActiveTab] = useState('workouts');
    const [statsData, setStatsData] = useState(null);
    const [loading, setLoading] = useState(true);

    const shareReport = async () => {
        const message = t('monthly_report.share_message', {
            month: monthName,
            workouts: statsData?.totalWorkouts ?? 0,
            volume: Math.round(statsData?.totalVolume ?? 0),
            duration: Math.round(statsData?.totalDurationMinutes ?? 0),
        });

        if (navigator.share) {
            await navigator.share({ title: `MotionMeet · ${monthName}`, text: message });
        } else {
            await navigator.clipboard.writeText(message);
        }
    };

    const now = new Date();
    const monthName = new Intl.DateTimeFormat(i18n.resolvedLanguage || 'en', {
        month: 'long',
        year: 'numeric',
    }).format(now);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const token = await getToken();
                const { data } = await api.get(API_ROUTES.workout.stats, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { period: 'calendar_month' }
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
    const sets = statsData?.stats?.sets ?? [];
    const workouts = statsData?.stats?.workouts ?? [];

    const getChartValues = () => {
        if (activeTab === 'volume') return volumes;
        if (activeTab === 'duration') return durations;
        if (activeTab === 'sets') return sets;
        return workouts;
    };

    const chartData = labels.map((label, i) => ({ name: label, value: getChartValues()[i] || 0 }));
    const chartAccent = theme.palette.mode === 'dark' ? '#60A5FA' : '#2563EB';

    const getBarColor = () => {
        if (activeTab === 'duration') return chartAccent;
        if (activeTab === 'sets') return '#a855f7';
        return theme.palette.primary.main;
    };

    const getUnit = () => {
        if (activeTab === 'volume') return 'kg';
        if (activeTab === 'duration') return t('monthly_report.chart_unit_duration', 'dk');
        if (activeTab === 'sets') return t('monthly_report.chart_unit_sets', 'set');
        return t('monthly_report.chart_unit_workouts', 'seans');
    };

    const radarData = muscleGroupsList.map(mg => ({
        subject: t(`muscle_groups.${mg.code}`, mg.name),
        value: statsData?.muscleDistribution?.[mg.code] ?? 0,
        fullMark: 1.0
    }));

    const daysOfWeek = [
        t('monthly_report.days.mon', 'Pzt'), t('monthly_report.days.tue', 'Sal'),
        t('monthly_report.days.wed', 'Çar'), t('monthly_report.days.thu', 'Per'),
        t('monthly_report.days.fri', 'Cum'), t('monthly_report.days.sat', 'Cts'),
        t('monthly_report.days.sun', 'Paz')
    ];
    const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
    const firstDayOffset = (new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getUTCDay() + 6) % 7;
    const calendarDays = [
        ...Array(firstDayOffset).fill(null),
        ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];
    const currentMonthPrefix = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-`;
    const workoutDays = new Set(
        (statsData?.workoutDates ?? [])
            .filter(date => date.startsWith(currentMonthPrefix))
            .map(date => Number(date.slice(-2)))
    );

    const tabs = [
        { id: 'workouts', label: t('monthly_report.workouts', 'Antrenmanlar') },
        { id: 'duration', label: t('monthly_report.duration', 'Süre') },
        { id: 'volume', label: t('monthly_report.volume', 'Hacim') },
        { id: 'sets', label: t('monthly_report.sets', 'Set') }
    ];

    const statCards = [
        { key: 'workouts', label: t('monthly_report.workouts', 'Antrenmanlar'), value: statsData?.totalWorkouts ?? 0, unit: '', route: '/statistics/monthly-report/workouts', color: 'primary.main' },
        { key: 'duration', label: t('monthly_report.duration', 'Süre'), value: statsData?.totalDuration ?? 0, unit: 'min', route: '/statistics/monthly-report/duration', color: '#3b82f6' },
        { key: 'volume', label: t('monthly_report.volume', 'Hacim'), value: statsData?.totalVolume ?? 0, unit: 'kg', route: '/statistics/monthly-report/volume', color: 'primary.main' },
        { key: 'sets', label: t('monthly_report.sets', 'Set'), value: statsData?.totalSets ?? 0, unit: '', route: '/statistics/monthly-report/sets', color: '#a855f7' },
    ];

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload?.length) {
            return (
                <Paper elevation={3} sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textTransform: 'uppercase', mb: 0.5 }}>{label}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {payload[0].value?.toLocaleString() ?? 0}
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>{getUnit()}</Typography>
                    </Typography>
                </Paper>
            );
        }
        return null;
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                <IconButton onClick={() => navigate(-1)} size="small"><ArrowBackRounded /></IconButton>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{monthName}</Typography>
                <Box sx={{ width: 40 }} />
            </Stack>

            <Box sx={{ flex: 1, overflowY: 'auto', pb: 10, width: '100%', maxWidth: 1180, mx: 'auto' }}>
                {/* Title */}
                <Box sx={{ px: 3, pt: 4, pb: 1 }}>
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>{monthName}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {statsData?.totalWorkouts ?? 0} {t('monthly_report.workouts', 'Antrenmanlar').toLowerCase()}
                    </Typography>
                </Box>

                {/* Tabs */}
                <Stack direction="row" spacing={1} sx={{ px: 3, mt: 2, overflowX: 'auto', flexWrap: 'nowrap', pb: 1 }}>
                    {tabs.map(tab => (
                        <Chip
                            key={tab.id}
                            label={tab.label}
                            onClick={() => setActiveTab(tab.id)}
                            color={activeTab === tab.id ? 'primary' : 'default'}
                            variant={activeTab === tab.id ? 'filled' : 'outlined'}
                            sx={{ fontWeight: 600, cursor: 'pointer' }}
                        />
                    ))}
                </Stack>

                {/* Bar Chart */}
                <Box sx={{ px: 2, mt: 2 }}>
                    {loading ? (
                        <Stack sx={{ alignItems: 'center', justifyContent: 'center', height: 220 }}>
                            <CircularProgress size={32} />
                        </Stack>
                    ) : (
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{t('monthly_report.trend_title', 'Trend')}</Typography>
                                <Chip label={getUnit()} size="small" variant="outlined" />
                            </Stack>
                            {chartData.length === 0 ? (
                                <Stack sx={{ alignItems: 'center', justifyContent: 'center', height: 180 }}>
                                    <Typography variant="body2" color="text.secondary">{t('monthly_report.no_data', 'Bu dönem için veri yok')}</Typography>
                                </Stack>
                            ) : (
                                <Box sx={{ height: 200 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} margin={{ top: 16, right: 4, left: -20, bottom: 0 }}>
                                            <CartesianGrid stroke={theme.palette.divider} strokeDasharray="4 4" vertical={false} opacity={0.72} />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: theme.palette.text.secondary }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: theme.palette.text.secondary }} />
                                            <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: alpha(getBarColor(), 0.08) }} />
                                            <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={36}>
                                                {chartData.map((_, i) => <Cell key={i} fill={getBarColor()} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </Box>
                            )}
                        </Paper>
                    )}
                </Box>

                <Divider sx={{ my: 4, mx: 3 }} />

                {/* Summary Grid */}
                <Box sx={{ px: 3 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 2 }}>{t('monthly_report.summary', 'Özet')}</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
                        {statCards.map(card => (
                            <Paper
                                key={card.key}
                                variant="outlined"
                                onClick={() => navigate(card.route, { state: { statsData } })}
                                sx={{
                                    p: 2, borderRadius: 3, cursor: 'pointer',
                                    position: 'relative', overflow: 'hidden',
                                    '&:hover': { borderColor: 'primary.main' },
                                    '&::after': {
                                        content: '""', position: 'absolute',
                                        bottom: 0, left: 0, right: 0, height: 3,
                                        bgcolor: card.color, borderRadius: '0 0 12px 12px',
                                    }
                                }}
                            >
                                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                    <Typography variant="caption" sx={{ fontWeight: 600 }}>{card.label}</Typography>
                                    <ChevronRightRounded sx={{ fontSize: 16, color: 'text.secondary' }} />
                                </Stack>
                                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                    {card.value?.toLocaleString() ?? 0}
                                    {card.unit && <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>{card.unit}</Typography>}
                                </Typography>
                            </Paper>
                        ))}
                    </Box>
                </Box>

                <Divider sx={{ my: 4, mx: 3 }} />

                {/* Workout Calendar */}
                <Paper
                    variant="outlined"
                    sx={{
                        mx: 3,
                        p: { xs: 2, sm: 3 },
                        borderRadius: 3,
                        background: `linear-gradient(145deg, ${alpha(chartAccent, 0.055)}, transparent 42%), ${theme.palette.background.paper}`,
                    }}
                >
                    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 3 }}>
                        <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                                {t('monthly_report.workout_days_log', 'Antrenman Günleri Kaydı')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {workoutDays.size} {t('monthly_report.active_days', 'active days')}
                            </Typography>
                        </Box>
                        <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75, px: 1.25, py: 0.75, borderRadius: 2, bgcolor: alpha('#ef4444', 0.1) }}>
                            <LocalFireDepartmentRounded sx={{ fontSize: 22, color: '#ef4444' }} />
                            <Typography variant="body2" sx={{ fontWeight: 800 }}>
                            {t('monthly_report.day_streak', { count: statsData?.currentStreakDays ?? 0 }, `${statsData?.currentStreakDays ?? 0} day streak`)}
                            </Typography>
                        </Stack>
                    </Stack>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 1 }}>
                        {daysOfWeek.map((d, i) => (
                            <Typography key={i} variant="caption" color="text.secondary" sx={{ textAlign: 'center', pb: 1, fontWeight: 700 }}>{d}</Typography>
                        ))}
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 1, textAlign: 'center' }}>
                        {calendarDays.map((num, i) => {
                            const isWorkoutDay = workoutDays.has(num);
                            const isToday = num === now.getUTCDate();
                            return (
                                <Box key={i} sx={{ height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {num && (
                                        <Box
                                            sx={{
                                                position: 'relative',
                                                width: 34,
                                                height: 34,
                                                display: 'grid',
                                                placeItems: 'center',
                                                borderRadius: 2.25,
                                                border: 1,
                                                borderColor: isToday && !isWorkoutDay ? chartAccent : 'transparent',
                                                bgcolor: isWorkoutDay ? chartAccent : 'transparent',
                                                color: isWorkoutDay ? '#FFFFFF' : 'text.primary',
                                                boxShadow: isWorkoutDay ? `0 7px 18px ${alpha(chartAccent, 0.24)}` : 'none',
                                                '&::after': isWorkoutDay ? {
                                                    content: '""',
                                                    position: 'absolute',
                                                    width: 4,
                                                    height: 4,
                                                    borderRadius: '50%',
                                                    bottom: 3,
                                                    bgcolor: '#FFFFFF',
                                                } : undefined,
                                            }}
                                        >
                                            <Typography variant="body2" sx={{ fontWeight: isWorkoutDay || isToday ? 800 : 500 }}>{num}</Typography>
                                        </Box>
                                    )}
                                </Box>
                            );
                        })}
                    </Box>
                </Paper>

                <Divider sx={{ my: 4, mx: 3 }} />

                {/* Muscle Distribution */}
                <Box sx={{ px: 3, mb: 4 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 3 }}>{t('monthly_report.muscle_distribution', 'Kas Dağılımı')}</Typography>
                    <Stack sx={{ alignItems: 'center' }}>
                        <Box sx={{ width: '100%', maxWidth: 350, aspectRatio: '1' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart outerRadius="70%" data={radarData}>
                                    <PolarGrid stroke={theme.palette.divider} />
                                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: theme.palette.text.secondary, fontWeight: 600 }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 1.0]} tick={false} axisLine={false} />
                                    <Radar
                                        name={monthName}
                                        dataKey="value"
                                        stroke={chartAccent}
                                        fill={chartAccent}
                                        fillOpacity={0.18}
                                        strokeWidth={3}
                                        dot={{ r: 3, fill: theme.palette.background.paper, stroke: chartAccent, strokeWidth: 2 }}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                        </Box>
                        <Stack direction="row" spacing={3} sx={{ mt: 1 }}>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: chartAccent, boxShadow: `0 0 0 4px ${alpha(chartAccent, 0.12)}` }} />
                                <Typography variant="caption" color="text.secondary">{monthName}</Typography>
                            </Stack>
                        </Stack>
                    </Stack>
                </Box>
            </Box>

            {/* Sticky Share Button */}
            <Box sx={{ position: { xs: 'fixed', sm: 'sticky' }, bottom: 0, left: 0, right: 0, p: 2.5, bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}>
                <Button fullWidth variant="contained" size="large" startIcon={<ShareRounded />} onClick={shareReport} sx={{ borderRadius: 3, fontWeight: 700 }}>
                    {t('monthly_report.share', 'Paylaş')}
                </Button>
            </Box>
        </Box>
    );
};

export default MonthlyReport;
