import { useNavigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import FitnessCenterRounded from '@mui/icons-material/FitnessCenterRounded';

const WorkoutsDetail = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const statsData = location.state?.statsData ?? null;

    const labels = statsData?.stats?.labels ?? [];
    const workoutsPerLabel = statsData?.stats?.workouts ?? [];
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
                <Paper elevation={3} sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="block" textTransform="uppercase" mb={0.5}>{label}</Typography>
                    <Typography variant="body2" fontWeight={700}>
                        {payload[0].value} <Typography component="span" variant="caption" color="text.secondary">{t('monthly_report.chart_unit_workouts', 'seans')}</Typography>
                    </Typography>
                </Paper>
            );
        }
        return null;
    };

    return (
        <Box sx={{ width: '100%', minHeight: '100vh', bgcolor: 'background.default', p: { xs: 2, sm: 4 } }}>
            <Box sx={{ maxWidth: 768, mx: 'auto', pb: 10 }}>
                {/* Header */}
                <Stack direction="row" sx={{ alignItems: "center" }} spacing={2} mb={4}>
                    <IconButton onClick={() => navigate(-1)} sx={{ bgcolor: 'action.hover' }}>
                        <ArrowBackRounded />
                    </IconButton>
                    <Typography variant="h5" fontWeight={900}>{t('monthly_report.workouts_detail', 'Antrenmanlar Detayı')}</Typography>
                </Stack>

                {/* Summary Cards */}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 4 }}>
                    <Paper variant="outlined" sx={{ p: 3, borderRadius: 4 }}>
                        <Typography variant="body2" fontWeight={600} color="text.secondary" mb={2}>{t('monthly_report.total', 'Toplam')}</Typography>
                        <Typography variant="h4" fontWeight={900}>{totalWorkouts}</Typography>
                        <Typography variant="caption" color="text.secondary">{t('monthly_report.chart_unit_workouts', 'seans')}</Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 3, borderRadius: 4 }}>
                        <Typography variant="body2" fontWeight={600} color="text.secondary" mb={2}>{t('monthly_report.avg_per_active_day', 'Aktif Gün Başına Ort.')}</Typography>
                        <Typography variant="h4" fontWeight={900}>{avgPerSession}</Typography>
                        <Typography variant="caption" color="text.secondary">{t('monthly_report.chart_unit_workouts', 'seans')}</Typography>
                    </Paper>
                </Box>

                {/* Chart */}
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 4 }}>
                    <Typography variant="body2" fontWeight={700} color="text.secondary" mb={3}>{t('monthly_report.trend_title', 'Trend')}</Typography>
                    {!hasData ? (
                        <Stack sx={{ justifyContent: "center",  alignItems: "center" }} py={8} spacing={1.5}>
                            <FitnessCenterRounded sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5 }} />
                            <Typography variant="body2" color="text.secondary">{t('monthly_report.no_data', 'Bu dönem için veri yok')}</Typography>
                        </Stack>
                    ) : (
                        <Box sx={{ height: 260 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="4 4" vertical={false} opacity={0.3} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} allowDecimals={false} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ opacity: 0.1 }} />
                                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={40}>
                                        {chartData.map((_, i) => (
                                            <Cell key={i} fill="var(--mui-palette-primary-main)" />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </Box>
                    )}
                </Paper>
            </Box>
        </Box>
    );
};

export default WorkoutsDetail;
