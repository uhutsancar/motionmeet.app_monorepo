import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from "../context/AuthProvider";
import api from '~/api/axios';
import { useMuscleGroups } from '../hooks/useMuscleGroups';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import HelpOutlineRounded from '@mui/icons-material/HelpOutlineRounded';
import ShareRounded from '@mui/icons-material/ShareRounded';
import KeyboardArrowDownRounded from '@mui/icons-material/KeyboardArrowDownRounded';
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded';

const MuscleDistribution = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { getToken } = useAuthContext();
    const { data: muscleGroupsList, isLoading: isMusclesLoading } = useMuscleGroups();

    const [period, setPeriod] = useState('month');
    const [anchorEl, setAnchorEl] = useState(null);
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

    const MUSCLE_KEYS = muscleGroupsList.map(mg => mg.code);

    // Radar chart values (0–1) from backend or zeros
    const values = MUSCLE_KEYS.map(k => stats?.muscleDistribution?.[k] ?? 0);
    const angles = MUSCLE_KEYS.map((_, i) => (Math.PI * 2 * i) / (MUSCLE_KEYS.length || 1) - Math.PI / 2);

    const SIZE = 300;
    const CENTER = SIZE / 2;
    const RADIUS = SIZE / 2 - 40;

    const getPoint = (val, idx) => {
        const r = RADIUS * Math.max(val, 0.02); // show faint shape even at 0
        return `${CENTER + r * Math.cos(angles[idx])},${CENTER + r * Math.sin(angles[idx])}`;
    };

    const currentPolygon = values.map((v, i) => getPoint(v, i)).join(' ');
    const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

    const handleMenuOpen = (event) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    return (
        <Box sx={{ width: '100%', minHeight: '100vh', bgcolor: 'background.default', p: { xs: 2, lg: 4 }, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: '100%', maxWidth: 672, mb: 4 }}>
                <IconButton onClick={() => navigate('/statistics')} sx={{ bgcolor: 'action.hover' }}>
                    <ArrowBackRounded />
                </IconButton>
                <Typography variant="h6" fontWeight={700}>{t('statistics.muscle_dist', 'Kas Dağılımı')}</Typography>
                <Stack direction="row" spacing={1}>
                    <IconButton sx={{ bgcolor: 'action.hover' }}><HelpOutlineRounded fontSize="small" /></IconButton>
                    <IconButton sx={{ bgcolor: 'action.hover' }}><ShareRounded fontSize="small" /></IconButton>
                </Stack>
            </Stack>

            {/* Period Dropdown */}
            <Box mb={6} position="relative">
                <Button
                    variant="outlined"
                    color="inherit"
                    endIcon={<KeyboardArrowDownRounded />}
                    onClick={handleMenuOpen}
                    sx={{ borderRadius: 8, px: 3, py: 1, fontWeight: 600, textTransform: 'none' }}
                >
                    {periodLabels[period]}
                </Button>
                <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleMenuClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'center' }}
                    PaperProps={{ sx: { borderRadius: 3, mt: 1, minWidth: 200 } }}
                >
                    {Object.entries(periodLabels).map(([key, label]) => (
                        <MenuItem
                            key={key}
                            onClick={() => { setPeriod(key); handleMenuClose(); }}
                            selected={period === key}
                            sx={{ py: 1.5, fontWeight: period === key ? 700 : 500, color: period === key ? 'primary.main' : 'text.primary' }}
                        >
                            {label}
                        </MenuItem>
                    ))}
                </Menu>
            </Box>

            {/* Radar Chart */}
            {loading || isMusclesLoading ? (
                <Stack alignItems="center" justifyContent="center" width={300} height={300}>
                    <CircularProgress />
                </Stack>
            ) : (
                <Stack alignItems="center" mb={8} position="relative">
                    <Box component="svg" width={SIZE} height={SIZE} sx={{ overflow: 'visible' }}>
                        {/* Grid */}
                        {gridLevels.map((lvl, index) => (
                            <polygon
                                key={`grid-${index}`}
                                points={MUSCLE_KEYS.map((_, i) => getPoint(lvl, i)).join(' ')}
                                stroke="var(--mui-palette-divider)"
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
                                stroke="var(--mui-palette-divider)"
                                strokeWidth="1"
                            />
                        ))}
                        {/* Data polygon */}
                        <polygon
                            points={currentPolygon}
                            stroke="var(--mui-palette-primary-main)"
                            strokeWidth="2"
                            fill="var(--mui-palette-primary-main)"
                            fillOpacity="0.15"
                            style={{ transition: 'all 0.7s ease-in-out' }}
                        />
                        {/* Labels */}
                        {MUSCLE_KEYS.map((key, i) => {
                            const x = CENTER + (RADIUS + 30) * Math.cos(angles[i]);
                            const y = CENTER + (RADIUS + 30) * Math.sin(angles[i]);
                            const mg = muscleGroupsList.find(m => m.code === key);
                            return (
                                <text
                                    key={`label-${i}`}
                                    x={x}
                                    y={y + 4}
                                    fontSize="12"
                                    fontWeight="600"
                                    fill="var(--mui-palette-text-secondary)"
                                    textAnchor="middle"
                                >
                                    {t(`muscle_groups.${key}`, mg?.name || key)}
                                </text>
                            );
                        })}
                    </Box>

                    {/* Legend */}
                    <Stack direction="row" spacing={3} mt={6} component={Paper} variant="outlined" sx={{ px: 3, py: 1.5, borderRadius: 4 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <Box sx={{ w: 10, h: 10, borderRadius: '50%', bgcolor: 'primary.main', width: 12, height: 12 }} />
                            <Typography variant="body2" fontWeight={600} color="text.secondary">{t('statistics.current', 'Güncel')}</Typography>
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <Box sx={{ w: 10, h: 10, borderRadius: '50%', bgcolor: 'text.secondary', width: 12, height: 12 }} />
                            <Typography variant="body2" fontWeight={600} color="text.secondary">{t('statistics.previous', 'Önceki')}</Typography>
                        </Stack>
                    </Stack>
                </Stack>
            )}

            {/* Stats Grid */}
            <Box sx={{ width: '100%', maxWidth: 672, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                {[
                    { label: t('statistics.workouts', 'Antrenman'), value: stats?.totalWorkouts ?? 0, unit: '', up: stats?.totalWorkouts ?? 0 },
                    { label: t('statistics.duration', 'Süre'), value: stats?.totalDuration ?? 0, unit: 'min', up: `${stats?.totalDuration ?? 0}min` },
                    { label: t('statistics.volume', 'Hacim'), value: stats?.totalVolume ?? 0, unit: 'kg', up: `${stats?.totalVolume ?? 0}kg` },
                    { label: t('statistics.sets', 'Set'), value: stats?.totalSets ?? 0, unit: '', up: stats?.totalSets ?? 0 }
                ].map((item, idx) => (
                    <Paper key={idx} variant="outlined" sx={{ p: 3, borderRadius: 4, '&:hover': { borderColor: 'primary.main', transition: 'border-color 0.2s' } }}>
                        <Typography variant="body2" fontWeight={600} color="text.secondary" mb={1.5}>{item.label}</Typography>
                        <Typography variant="h4" fontWeight={900} mb={1}>
                            {item.value} {item.unit && <Typography component="span" variant="subtitle1" fontWeight={600}>{item.unit}</Typography>}
                        </Typography>
                        <Stack direction="row" alignItems="center" color="success.main">
                            <ArrowUpwardRounded sx={{ fontSize: 14, mr: 0.5 }} />
                            <Typography variant="caption" fontWeight={700}>{item.up}</Typography>
                        </Stack>
                    </Paper>
                ))}
            </Box>
        </Box>
    );
};

export default MuscleDistribution;

