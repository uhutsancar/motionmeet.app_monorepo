import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, Cell,
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { useAuthContext } from "../context/AuthProvider";
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
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import LocalFireDepartmentRounded from '@mui/icons-material/LocalFireDepartmentRounded';
import ShareRounded from '@mui/icons-material/ShareRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';

const MONTHS_TR = ['Ocak', 'Åžubat', 'Mart', 'Nisan', 'MayÄ±s', 'Haziran', 'Temmuz', 'AÄŸustos', 'EylÃ¼l', 'Ekim', 'KasÄ±m', 'AralÄ±k'];

const MonthlyReport = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { getToken } = useAuthContext();
    const { data: muscleGroupsList } = useMuscleGroups();
    const [activeTab, setActiveTab] = useState('workouts');
    const [statsData, setStatsData] = useState(null);
    const [loading, setLoading] = useState(true);

    const now = new Date();
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

    const chartData = labels.map((label, i) => ({ name: label, value: getChartValues()[i] || 0 }));

    const getBarColor = () => {
        if (activeTab === 'duration') return '#3b82f6';
        if (activeTab === 'sets') return '#a855f7';
        return 'var(--mui-palette-primary-main)';
    };

    const getUnit = () => {
        if (activeTab === 'volume') return 'kg';
        if (activeTab === 'duration') return t('monthly_report.chart_unit_duration', 'dk');
        if (activeTab === 'sets') return t('monthly_report.chart_unit_sets', 'set');
        return t('monthly_report.chart_unit_workouts', 'seans');
    };

    const radarData = muscleGroupsList.map(mg => ({
        subject: t(`muscle_groups.${mg.code}`, mg.name),
        A: 0.1,
        B: statsData?.muscleDistribution?.[mg.code] ?? 0.02,
        fullMark: 1.0
    }));

    const daysOfWeek = [
        t('monthly_report.days.mon', 'Pzt'), t('monthly_report.days.tue', 'Sal'),
        t('monthly_report.days.wed', 'Ã‡ar'), t('monthly_report.days.thu', 'Per'),
        t('monthly_report.days.fri', 'Cum'), t('monthly_report.days.sat', 'Cts'),
        t('monthly_report.days.sun', 'Paz')
    ];
    const calendarDays = [null, null, null, null, null, null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28];

    const tabs = [
        { id: 'workouts', label: t('monthly_report.workouts', 'Antrenmanlar') },
        { id: 'duration', label: t('monthly_report.duration', 'SÃ¼re') },
        { id: 'volume', label: t('monthly_report.volume', 'Hacim') },
        { id: 'sets', label: t('monthly_report.sets', 'Set') }
    ];

    const statCards = [
        { key: 'workouts', label: t('monthly_report.workouts', 'Antrenmanlar'), value: statsData?.totalWorkouts ?? 0, unit: '', route: '/statistics/monthly-report/workouts', color: 'primary.main' },
        { key: 'duration', label: t('monthly_report.duration', 'SÃ¼re'), value: statsData?.totalDuration ?? 0, unit: 'min', route: '/statistics/monthly-report/duration', color: '#3b82f6' },
        { key: 'volume', label: t('monthly_report.volume', 'Hacim'), value: statsData?.totalVolume ?? 0, unit: 'kg', route: '/statistics/monthly-report/volume', color: 'primary.main' },
        { key: 'sets', label: t('monthly_report.sets', 'Set'), value: statsData?.totalSets ?? 0, unit: '', route: '/statistics/monthly-report/sets', color: '#a855f7' },
    ];

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload?.length) {
            return (
                <Paper elevation={3} sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="block" textTransform="uppercase" mb={0.5}>{label}</Typography>
                    <Typography variant="body2" fontWeight={700}>
                        {payload[0].value?.toLocaleString() ?? 0}
                        <Typography component="span" variant="caption" color="text.secondary" ml={0.5}>{getUnit()}</Typography>
                    </Typography>
                </Paper>
            );
        }
        return null;
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                <IconButton onClick={() => navigate(-1)} size="small"><ArrowBackRounded /></IconButton>
                <Typography variant="subtitle1" fontWeight={700}>{monthName}</Typography>
                <Box sx={{ width: 40 }} />
            </Stack>

            <Box sx={{ flex: 1, overflowY: 'auto', pb: 10 }}>
                {/* Title */}
                <Box sx={{ px: 3, pt: 4, pb: 1 }}>
                    <Typography variant="h5" fontWeight={800}>{monthName}</Typography>
                    <Typography variant="body2" color="text.secondary" mt={0.5}>
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
                        <Stack alignItems="center" justifyContent="center" height={220}>
                            <CircularProgress size={32} />
                        </Stack>
                    ) : (
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                                <Typography variant="body2" fontWeight={600} color="text.secondary">{t('monthly_report.trend_title', 'Trend')}</Typography>
                                <Chip label={getUnit()} size="small" variant="outlined" />
                            </Stack>
                            {chartData.length === 0 ? (
                                <Stack alignItems="center" justifyContent="center" height={180}>
                                    <Typography variant="body2" color="text.secondary">{t('monthly_report.no_data', 'Bu dÃ¶nem iÃ§in veri yok')}</Typography>
                                </Stack>
                            ) : (
                                <Box sx={{ height: 200 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} margin={{ top: 16, right: 4, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="4 4" vertical={false} opacity={0.3} />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                                            <RechartsTooltip content={<CustomTooltip />} cursor={{ opacity: 0.1 }} />
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
                    <Typography variant="body2" fontWeight={600} color="text.secondary" mb={2}>{t('monthly_report.summary', 'Ã–zet')}</Typography>
                    <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
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
                                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                                    <Typography variant="caption" fontWeight={600}>{card.label}</Typography>
                                    <ChevronRightRounded sx={{ fontSize: 16, color: 'text.secondary' }} />
                                </Stack>
                                <Typography variant="h6" fontWeight={800}>
                                    {card.value?.toLocaleString() ?? 0}
                                    {card.unit && <Typography component="span" variant="body2" color="text.secondary" ml={0.5}>{card.unit}</Typography>}
                                </Typography>
                            </Paper>
                        ))}
                    </Box>
                </Box>

                <Divider sx={{ my: 4, mx: 3 }} />

                {/* Workout Calendar */}
                <Box sx={{ px: 3 }}>
                    <Typography variant="body2" fontWeight={600} color="text.secondary" mb={3}>{t('monthly_report.workout_days_log', 'Antrenman GÃ¼nleri KaydÄ±')}</Typography>
                    <Stack alignItems="center" mb={3}>
                        <LocalFireDepartmentRounded sx={{ fontSize: 48, color: '#ef4444' }} />
                        <Typography variant="body1" fontWeight={700} mt={1}>{t('monthly_report.weekly_streak', { count: 0 }, '0 HaftalÄ±k Seri')}</Typography>
                    </Stack>
                    <Box display="grid" gridTemplateColumns="repeat(7, 1fr)" mb={1}>
                        {daysOfWeek.map((d, i) => (
                            <Typography key={i} variant="caption" color="text.secondary" textAlign="center" pb={1}>{d}</Typography>
                        ))}
                    </Box>
                    <Box display="grid" gridTemplateColumns="repeat(7, 1fr)" sx={{ rowGap: 1, textAlign: 'center' }}>
                        {calendarDays.map((num, i) => (
                            <Box key={i} sx={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {num && <Typography variant="body2" fontWeight={500}>{num}</Typography>}
                            </Box>
                        ))}
                    </Box>
                </Box>

                <Divider sx={{ my: 4, mx: 3 }} />

                {/* Muscle Distribution */}
                <Box sx={{ px: 3, mb: 4 }}>
                    <Typography variant="body2" fontWeight={600} color="text.secondary" mb={3}>{t('monthly_report.muscle_distribution', 'Kas DaÄŸÄ±lÄ±mÄ±')}</Typography>
                    <Stack alignItems="center">
                        <Box sx={{ width: '100%', maxWidth: 350, aspectRatio: '1' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart outerRadius="70%" data={radarData}>
                                    <PolarGrid />
                                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 1.0]} tick={false} axisLine={false} />
                                    <Radar name="Ã–nceki Ay" dataKey="A" stroke="gray" fill="none" strokeWidth={2} />
                                    <Radar name="Bu Ay" dataKey="B" stroke="var(--mui-palette-primary-main)" fill="var(--mui-palette-primary-main)" fillOpacity={0.2} strokeWidth={2} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </Box>
                        <Stack direction="row" spacing={3} mt={1}>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'text.secondary' }} />
                                <Typography variant="caption" color="text.secondary">
                                    {MONTHS_TR[now.getMonth() === 0 ? 11 : now.getMonth() - 1]} {now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()}
                                </Typography>
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'primary.main' }} />
                                <Typography variant="caption" color="text.secondary">{monthName}</Typography>
                            </Stack>
                        </Stack>
                    </Stack>
                </Box>
            </Box>

            {/* Sticky Share Button */}
            <Box sx={{ position: { xs: 'fixed', sm: 'sticky' }, bottom: 0, left: 0, right: 0, p: 2.5, bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}>
                <Button fullWidth variant="contained" size="large" startIcon={<ShareRounded />} sx={{ borderRadius: 3, fontWeight: 700 }}>
                    {t('monthly_report.share', 'PaylaÅŸ')}
                </Button>
            </Box>
        </Box>
    );
};

export default MonthlyReport;