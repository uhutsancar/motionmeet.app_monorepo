import { useState, useEffect } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChevronLeft, TrendingUp, Clock, Activity } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../context/AuthProvider";
import api from "~/api/axios";
import { Box, Stack, Typography, IconButton, Paper, Grid, ToggleButtonGroup, ToggleButton, Skeleton } from "@mui/material";

const AdvancedStatistics = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { getToken } = useAuthContext();

    const [period, setPeriod] = useState("month");
    const [statsData, setStatsData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const token = await getToken();
                const { data } = await api.get(`/api/workout/stats?period=${period}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (data.success) {
                    setStatsData(data.stats);
                }
            } catch (error) {
                console.error("Error fetching stats:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [period, getToken]);

    const chartData = statsData?.labels.map((label, index) => ({
        name: label,
        volume: statsData.volumes[index] || 0,
        reps: statsData.reps[index] || 0,
        duration: statsData.durations[index] || 0,
    })) || [];

    const CustomTooltip = ({ active, payload, label, unit }) => {
        if (active && payload && payload.length) {
            return (
                <Paper elevation={3} sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
                    <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, mb: 1, display: 'block' }}>
                        {label}
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <Box sx={{ w: 8, h: 8, borderRadius: '50%', bgcolor: 'primary.main', width: 8, height: 8 }} />
                        <Typography variant="subtitle2" fontWeight="bold">
                            {payload[0].value.toLocaleString()}
                            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>{unit}</Typography>
                        </Typography>
                    </Stack>
                </Paper>
            );
        }
        return null;
    };

    return (
        <Box sx={{ width: '100%', minHeight: '100dvh', bgcolor: 'background.default', p: { xs: 2, sm: 4 }, pb: { xs: 12, sm: 4 } }}>
            <Box sx={{ maxWidth: 'md', mx: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {/* Header */}
                <Stack direction="row" alignItems="center" spacing={2}>
                    <IconButton
                        onClick={() => navigate('/statistics')}
                        sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' } }}
                    >
                        <ChevronLeft size={24} />
                    </IconButton>
                    <Box>
                        <Typography variant="h4" fontWeight="900" letterSpacing="-0.02em">{t("statistics.advanced", "Gelişmiş İstatistikler")}</Typography>
                        <Typography variant="body2" color="text.secondary">{t("statistics.advanced_desc", "Hacim, Set, Rep detayları")}</Typography>
                    </Box>
                </Stack>

                {/* Period Selector */}
                <ToggleButtonGroup
                    value={period}
                    exclusive
                    onChange={(e, newPeriod) => { if (newPeriod) setPeriod(newPeriod); }}
                    sx={{ alignSelf: 'flex-start', bgcolor: 'background.paper', p: 0.5, borderRadius: 3, border: 1, borderColor: 'divider', '& .MuiToggleButton-root': { border: 'none', borderRadius: 2.5, px: 3, py: 1, fontWeight: 'bold', textTransform: 'none', color: 'text.secondary', '&.Mui-selected': { bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } } } }}
                >
                    {["week", "month", "year"].map((p) => (
                        <ToggleButton key={p} value={p}>
                            {t(`statistics.${p}`)}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>

                {loading ? (
                    <Grid container spacing={3}>
                        <Grid item xs={12}><Skeleton variant="rounded" height={250} sx={{ borderRadius: 6 }} /></Grid>
                        <Grid item xs={12} md={6}><Skeleton variant="rounded" height={250} sx={{ borderRadius: 6 }} /></Grid>
                        <Grid item xs={12} md={6}><Skeleton variant="rounded" height={250} sx={{ borderRadius: 6 }} /></Grid>
                    </Grid>
                ) : (
                    <Stack spacing={3}>
                        {/* Volume Chart */}
                        <Paper variant="outlined" sx={{ p: 3, borderRadius: 6, bgcolor: 'background.paper', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 4 } }}>
                            <Stack direction="row" alignItems="center" spacing={1} mb={3}>
                                <TrendingUp size={20} color="var(--accent-primary)" />
                                <Typography variant="h6" fontWeight="bold">{t('statistics.volume', 'Hacim')} {t('statistics.total_uppercase', '(Total)')}</Typography>
                            </Stack>
                            <Box sx={{ height: 250, width: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.5} />
                                                <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "var(--text-secondary)", fontSize: 12 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-secondary)", fontSize: 12 }} dx={-10} />
                                        <Tooltip content={<CustomTooltip unit="kg" />} cursor={{ fill: 'transparent' }} />
                                        <Area type="monotone" dataKey="volume" stroke="var(--accent-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorVolume)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </Box>
                        </Paper>

                        <Grid container spacing={3}>
                            {/* Reps Chart */}
                            <Grid item xs={12} md={6}>
                                <Paper variant="outlined" sx={{ p: 3, borderRadius: 6, bgcolor: 'background.paper', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 4 }, height: '100%' }}>
                                    <Stack direction="row" alignItems="center" spacing={1} mb={3}>
                                        <Activity size={20} color="#22c55e" />
                                        <Typography variant="h6" fontWeight="bold">Reps {t('statistics.total_uppercase', '(Total)')}</Typography>
                                    </Stack>
                                    <Box sx={{ height: 250, width: '100%' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "var(--text-secondary)", fontSize: 12 }} dy={10} />
                                                <Tooltip content={<CustomTooltip unit="reps" />} cursor={{ fill: 'var(--surface-light)' }} />
                                                <Bar dataKey="reps" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </Box>
                                </Paper>
                            </Grid>

                            {/* Duration Chart */}
                            <Grid item xs={12} md={6}>
                                <Paper variant="outlined" sx={{ p: 3, borderRadius: 6, bgcolor: 'background.paper', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 4 }, height: '100%' }}>
                                    <Stack direction="row" alignItems="center" spacing={1} mb={3}>
                                        <Clock size={20} color="#3b82f6" />
                                        <Typography variant="h6" fontWeight="bold">{t('statistics.duration', 'Süre')} {t('statistics.mins_uppercase', '(Mins)')}</Typography>
                                    </Stack>
                                    <Box sx={{ height: 250, width: '100%' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={chartData}>
                                                <defs>
                                                    <linearGradient id="colorDuration" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
                                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "var(--text-secondary)", fontSize: 12 }} dy={10} />
                                                <Tooltip content={<CustomTooltip unit="min" />} cursor={{ fill: 'transparent' }} />
                                                <Area type="monotone" dataKey="duration" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorDuration)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </Box>
                                </Paper>
                            </Grid>
                        </Grid>
                    </Stack>
                )}
            </Box>
        </Box>
    );
};

export default AdvancedStatistics;
