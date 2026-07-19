import { useNavigate, useLocation } from 'react-router-dom';
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
import AccessTimeRounded from '@mui/icons-material/AccessTimeRounded';

const DurationDetail = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const statsData = location.state?.statsData ?? null;

    const labels = statsData?.stats?.labels ?? [];
    const durations = statsData?.stats?.durations ?? [];
    const totalDuration = statsData?.totalDuration ?? 0;
    const avgDuration = labels.length > 0
        ? Math.round(durations.reduce((a, b) => a + (b || 0), 0) / labels.length)
        : 0;

    const chartData = labels.map((label, i) => ({
        name: label,
        value: durations[i] || 0,
    }));

    const hasData = chartData.length > 0;

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload?.length) {
            return (
                <Paper elevation={3} sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="block" textTransform="uppercase" mb={0.5}>{label}</Typography>
                    <Typography variant="body2" fontWeight={700}>
                        {payload[0].value} <Typography component="span" variant="caption" color="text.secondary">{t('monthly_report.chart_unit_duration', 'dk')}</Typography>
                    </Typography>
                </Paper>
            );
        }
        return null;
    };

    return (
        <Box sx={{ width: '100%', minHeight: '100vh', bgcolor: 'background.default', p: { xs: 2, sm: 4 } }}>
            <Box sx={{ maxWidth: 768, mx: 'auto', pb: 10 }}>
                <Stack direction="row" alignItems="center" spacing={2} mb={4}>
                    <IconButton onClick={() => navigate(-1)} sx={{ bgcolor: 'action.hover' }}>
                        <ArrowBackRounded />
                    </IconButton>
                    <Typography variant="h5" fontWeight={900}>{t('monthly_report.duration_detail', 'Süre Detayı')}</Typography>
                </Stack>

                <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2} mb={4}>
                    <Paper variant="outlined" sx={{ p: 3, borderRadius: 4 }}>
                        <Typography variant="body2" fontWeight={600} color="text.secondary" mb={2}>{t('monthly_report.total', 'Toplam')}</Typography>
                        <Typography variant="h4" fontWeight={900}>{totalDuration}</Typography>
                        <Typography variant="caption" color="text.secondary">{t('monthly_report.chart_unit_duration', 'dk')}</Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 3, borderRadius: 4 }}>
                        <Typography variant="body2" fontWeight={600} color="text.secondary" mb={2}>{t('monthly_report.avg_per_session', 'Seans Başına Ort.')}</Typography>
                        <Typography variant="h4" fontWeight={900}>{avgDuration}</Typography>
                        <Typography variant="caption" color="text.secondary">{t('monthly_report.chart_unit_duration', 'dk')}</Typography>
                    </Paper>
                </Box>

                <Paper variant="outlined" sx={{ p: 3, borderRadius: 4 }}>
                    <Typography variant="body2" fontWeight={700} color="text.secondary" mb={3}>{t('monthly_report.trend_title', 'Trend')}</Typography>
                    {!hasData ? (
                        <Stack alignItems="center" justifyContent="center" py={8} spacing={1.5}>
                            <AccessTimeRounded sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5 }} />
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
                                            <Cell key={i} fill="#3b82f6" />
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

export default DurationDetail;
