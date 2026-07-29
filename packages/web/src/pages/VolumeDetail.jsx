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
import TrendingUpRounded from '@mui/icons-material/TrendingUpRounded';

const VolumeDetail = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const statsData = location.state?.statsData ?? null;

    const labels = statsData?.stats?.labels ?? [];
    const volumes = statsData?.stats?.volumes ?? [];
    const totalVolume = statsData?.totalVolume ?? 0;
    const totalWorkouts = statsData?.totalWorkouts ?? 0;
    const avgVolume = totalWorkouts > 0
        ? Math.round(totalVolume / totalWorkouts)
        : 0;

    const chartData = labels.map((label, i) => ({
        name: label,
        value: volumes[i] || 0,
    }));

    const hasData = chartData.length > 0;
    const exerciseBreakdown = statsData?.exerciseBreakdown ?? [];

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload?.length) {
            return (
                <Paper elevation={3} sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="block" textTransform="uppercase" mb={0.5}>{label}</Typography>
                    <Typography variant="body2" fontWeight={700}>
                        {payload[0].value?.toLocaleString()} <Typography component="span" variant="caption" color="text.secondary">kg</Typography>
                    </Typography>
                </Paper>
            );
        }
        return null;
    };

    return (
        <Box sx={{ width: '100%', minHeight: '100vh', bgcolor: 'background.default', p: { xs: 2, sm: 4 } }}>
            <Box sx={{ maxWidth: 768, mx: 'auto', pb: 10 }}>
                <Stack direction="row" sx={{ alignItems: "center" }} spacing={2} mb={4}>
                    <IconButton onClick={() => navigate(-1)} sx={{ bgcolor: 'action.hover' }}>
                        <ArrowBackRounded />
                    </IconButton>
                    <Typography variant="h5" fontWeight={900}>{t('monthly_report.volume_detail', 'Hacim Detayı')}</Typography>
                </Stack>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 4 }}>
                    <Paper variant="outlined" sx={{ p: 3, borderRadius: 4 }}>
                        <Typography variant="body2" fontWeight={600} color="text.secondary" mb={2}>{t('monthly_report.total', 'Toplam')}</Typography>
                        <Typography variant="h4" fontWeight={900}>{totalVolume?.toLocaleString()}</Typography>
                        <Typography variant="caption" color="text.secondary">kg</Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 3, borderRadius: 4 }}>
                        <Typography variant="body2" fontWeight={600} color="text.secondary" mb={2}>{t('monthly_report.avg_per_session', 'Seans Başına Ort.')}</Typography>
                        <Typography variant="h4" fontWeight={900}>{avgVolume?.toLocaleString()}</Typography>
                        <Typography variant="caption" color="text.secondary">kg</Typography>
                    </Paper>
                </Box>

                <Paper variant="outlined" sx={{ p: 3, borderRadius: 4, mb: 3 }}>
                    <Typography variant="body2" fontWeight={700} color="text.secondary" mb={3}>{t('monthly_report.trend_title', 'Trend')}</Typography>
                    {!hasData ? (
                        <Stack sx={{ justifyContent: "center",  alignItems: "center" }} py={8} spacing={1.5}>
                            <TrendingUpRounded sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5 }} />
                            <Typography variant="body2" color="text.secondary">{t('monthly_report.no_data', 'Bu dönem için veri yok')}</Typography>
                        </Stack>
                    ) : (
                        <Box sx={{ height: 260 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="4 4" vertical={false} opacity={0.3} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
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

                {/* Exercise Breakdown */}
                {exerciseBreakdown.length > 0 && (
                    <Paper variant="outlined" sx={{ p: 3, borderRadius: 4 }}>
                        <Typography variant="body2" fontWeight={700} color="text.secondary" mb={2}>{t('statistics.top_exercises', 'En İyi Egzersizler')}</Typography>
                        <Stack spacing={1}>
                            {exerciseBreakdown.slice(0, 5).map((ex, i) => (
                                <Stack key={i} direction="row" sx={{ alignItems: "center", py: 1.5, borderBottom: i === Math.min(exerciseBreakdown.length, 5) - 1 ? 0 : 1, borderColor: 'divider' }}>
                                    <Typography variant="body2" fontWeight={900} color="primary.main" sx={{ width: 28 }}>#{i + 1}</Typography>
                                    <Typography variant="body2" fontWeight={600} flex={1}>{ex.name}</Typography>
                                    <Typography variant="body2" fontWeight={700} color="text.secondary">{ex.total?.toLocaleString()} kg</Typography>
                                </Stack>
                            ))}
                        </Stack>
                    </Paper>
                )}
            </Box>
        </Box>
    );
};

export default VolumeDetail;
