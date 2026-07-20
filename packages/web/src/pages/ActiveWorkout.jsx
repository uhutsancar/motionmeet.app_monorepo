import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Box, Stack, Typography, IconButton, Button, Paper, TextField, Divider, CircularProgress
} from '@mui/material';
import {
    Check, CheckCircle2, ChevronRight,
    Dumbbell, Flame, Pause, Play, Plus, X
} from 'lucide-react';
const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};
import { useActiveWorkout } from '../hooks/useActiveWorkout';

import { BASEURL } from '~/config/env';

const getMediaUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${BASEURL}/dataset/${url.replace('.gif', '.jpg').replace('videos/', 'images/')}`;
};

const ActiveWorkout = () => {
    const { t } = useTranslation();
    const location = useLocation();

    const { routine } = location.state || {};
    
    const {
        elapsed, paused, saving, exercises,
        togglePause, toggleSet, updateSet, addSet, removeSet,
        totalVolume, totalSetsCompleted, finishWorkout
    } = useActiveWorkout(routine);

    if (!routine) return null;

    return (
        <Box sx={{ width: '100%', minHeight: '100dvh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>

            {/* Top Fixed Header with Live Stats */}
            <Box sx={{
                position: 'sticky', top: 0, zIndex: 50,
                bgcolor: 'background.paper', backdropFilter: 'blur(10px)',
                borderBottom: 1, borderColor: 'divider', p: 2, px: { lg: 4 }, boxShadow: 1
            }}>
                <Box sx={{ maxWidth: 'md', mx: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Stack direction="row" alignItems="center" spacing={2}>
                        <IconButton
                            onClick={togglePause}
                            color="primary"
                            sx={{ width: 48, height: 48, bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } }}
                        >
                            {paused ? <Play size={20} /> : <Pause size={20} />}
                        </IconButton>
                        <Stack>
                            <Typography variant="overline" sx={{ fontSize: '0.65rem', fontWeight: 900, color: 'text.secondary', lineHeight: 1 }}>
                                {paused ? t('active_workout.paused', 'Duraklatıldı') : t('active_workout.active', 'Aktif')}
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 900, color: paused ? 'primary.main' : 'text.primary', fontFamily: 'monospace' }}>
                                {formatTime(elapsed)}
                            </Typography>
                        </Stack>
                    </Stack>

                    <Stack direction="row" spacing={{ xs: 2, sm: 4 }} alignItems="center" sx={{ overflowX: 'auto', px: 1 }}>
                        <Stack alignItems="center">
                            <Typography variant="overline" sx={{ fontSize: '0.65rem', fontWeight: 900, color: 'text.secondary', lineHeight: 1 }}>
                                {t('statistics.volume', 'Hacim')}
                            </Typography>
                            <Typography variant="subtitle1" fontWeight="bold">
                                {totalVolume} <Typography component="span" variant="caption" color="text.secondary">kg</Typography>
                            </Typography>
                        </Stack>
                        <Divider orientation="vertical" flexItem sx={{ height: 32, alignSelf: 'center' }} />
                        <Stack alignItems="center">
                            <Typography variant="overline" sx={{ fontSize: '0.65rem', fontWeight: 900, color: 'text.secondary', lineHeight: 1 }}>
                                {t('statistics.sets', 'Set')}
                            </Typography>
                            <Typography variant="subtitle1" fontWeight="bold">{totalSetsCompleted}</Typography>
                        </Stack>
                        <Divider orientation="vertical" flexItem sx={{ height: 32, alignSelf: 'center' }} />
                        <IconButton color="warning">
                            <Flame size={20} />
                        </IconButton>
                    </Stack>
                </Box>
            </Box>

            {/* Main Content Area */}
            <Box sx={{ flex: 1, width: '100%', maxWidth: 'md', mx: 'auto', p: 2, py: { lg: 4 }, pb: { xs: 16, lg: 16 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Typography variant="h5" fontWeight="900" sx={{ px: 1 }}>{routine.name}</Typography>

                {exercises.map((ex, exIdx) => {
                    const mediaUrl = getMediaUrl(ex.exerciseId?.video_url);

                    return (
                        <Paper key={exIdx} variant="outlined" sx={{ borderRadius: 4, overflow: 'hidden' }}>
                            {/* Exercise Header */}
                            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'action.hover' }}>
                                <Stack direction="row" alignItems="center" spacing={2}>
                                    {mediaUrl ? (
                                        <Box component="img" src={mediaUrl} sx={{ width: 48, height: 48, borderRadius: 2, objectFit: 'cover' }} />
                                    ) : (
                                        <Box sx={{ p: 1.5, bgcolor: 'background.paper', borderRadius: 2, border: 1, borderColor: 'divider' }}>
                                            <Dumbbell size={20} color="var(--accent-primary)" />
                                        </Box>
                                    )}
                                    <Typography variant="subtitle1" fontWeight="bold">
                                        {ex.exerciseId?.name || 'Unknown Exercise'}
                                    </Typography>
                                </Stack>
                                <IconButton size="small">
                                    <ChevronRight size={20} />
                                </IconButton>
                            </Box>

                            {/* Sets List */}
                            <Box sx={{ p: { xs: 1, sm: 2 } }}>
                                {/* Columns Header */}
                                <Stack direction="row" alignItems="center" sx={{ px: 1, py: 1, mb: 1 }}>
                                    <Typography variant="overline" sx={{ width: 40, textAlign: 'center', fontSize: '0.65rem', fontWeight: 900 }}>Set</Typography>
                                    <Typography variant="overline" sx={{ flex: 1, minWidth: 60, textAlign: 'center', fontSize: '0.65rem', fontWeight: 900, display: { xs: 'none', sm: 'block' } }}>Önceki</Typography>
                                    <Typography variant="overline" sx={{ flex: 1, textAlign: 'center', fontSize: '0.65rem', fontWeight: 900 }}>kg</Typography>
                                    <Typography variant="overline" sx={{ flex: 1, textAlign: 'center', fontSize: '0.65rem', fontWeight: 900 }}>Tekrar</Typography>
                                    <Box sx={{ width: 48, display: 'flex', justifyContent: 'center' }}><CheckCircle2 size={16} opacity={0.5} /></Box>
                                </Stack>

                                {/* Set Rows */}
                                {ex.sets.map((set, setIdx) => (
                                    <Stack
                                        key={setIdx}
                                        direction="row"
                                        alignItems="center"
                                        spacing={{ xs: 1, sm: 2 }}
                                        sx={{
                                            px: { xs: 0.5, sm: 1 }, py: 1, mb: 1, borderRadius: 2,
                                            bgcolor: set.completed ? 'success.light' : 'transparent',
                                            transition: 'background-color 0.2s'
                                        }}
                                    >
                                        {/* Set Number */}
                                        <Box sx={{ width: { xs: 32, sm: 40 }, display: 'flex', justifyContent: 'center' }}>
                                            <Box sx={{
                                                width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                bgcolor: set.completed ? 'success.main' : 'action.hover',
                                                color: set.completed ? 'success.contrastText' : 'text.secondary',
                                                border: 1, borderColor: set.completed ? 'success.main' : 'divider',
                                                fontWeight: 'bold', fontSize: '0.75rem'
                                            }}>
                                                {setIdx + 1}
                                            </Box>
                                        </Box>

                                        {/* Previous Status */}
                                        <Box sx={{ flex: 1, minWidth: 60, textAlign: 'center', display: { xs: 'none', sm: 'block' } }}>
                                            <Typography variant="caption" fontWeight="bold" color="text.secondary">-</Typography>
                                        </Box>

                                        {/* Weight Input */}
                                        <Box sx={{ flex: 1 }}>
                                            <TextField
                                                variant="outlined"
                                                size="small"
                                                type="number"
                                                placeholder="0"
                                                value={set.weight || ''}
                                                onChange={(e) => updateSet(exIdx, setIdx, 'weight', e.target.value)}
                                                disabled={set.completed}
                                                inputProps={{ style: { textAlign: 'center', fontWeight: 'bold' } }}
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: 2,
                                                        bgcolor: 'action.hover',
                                                        '& fieldset': { borderColor: 'transparent' },
                                                        '&:hover fieldset': { borderColor: 'transparent' },
                                                        '&.Mui-focused fieldset': { borderColor: 'primary.main' },
                                                        '&.Mui-disabled': { opacity: 0.5 }
                                                    }
                                                }}
                                            />
                                        </Box>

                                        {/* Reps Input */}
                                        <Box sx={{ flex: 1 }}>
                                            <TextField
                                                variant="outlined"
                                                size="small"
                                                type="number"
                                                placeholder="0"
                                                value={set.reps || ''}
                                                onChange={(e) => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                                                disabled={set.completed}
                                                inputProps={{ style: { textAlign: 'center', fontWeight: 'bold' } }}
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: 2,
                                                        bgcolor: 'action.hover',
                                                        '& fieldset': { borderColor: 'transparent' },
                                                        '&:hover fieldset': { borderColor: 'transparent' },
                                                        '&.Mui-focused fieldset': { borderColor: 'primary.main' },
                                                        '&.Mui-disabled': { opacity: 0.5 }
                                                    }
                                                }}
                                            />
                                        </Box>

                                        {/* Complete Checkbox */}
                                        <Box sx={{ width: { xs: 40, sm: 48 }, display: 'flex', justifyContent: 'center' }}>
                                            <IconButton
                                                onClick={() => toggleSet(exIdx, setIdx)}
                                                sx={{
                                                    width: 40, height: 40, borderRadius: 2,
                                                    bgcolor: set.completed ? 'success.main' : 'action.hover',
                                                    color: set.completed ? 'success.contrastText' : 'text.secondary',
                                                    border: 1, borderColor: set.completed ? 'success.main' : 'divider',
                                                    '&:hover': { bgcolor: set.completed ? 'success.dark' : 'action.selected' },
                                                    boxShadow: set.completed ? 2 : 0
                                                }}
                                            >
                                                <Check size={20} strokeWidth={3} />
                                            </IconButton>
                                        </Box>

                                        {/* Delete Set Button */}
                                        {!set.completed && (
                                            <IconButton
                                                onClick={() => removeSet(exIdx, setIdx)}
                                                color="error"
                                                size="small"
                                                sx={{ ml: 0.5 }}
                                            >
                                                <X size={16} />
                                            </IconButton>
                                        )}
                                    </Stack>
                                ))}

                                {/* Add Set Button */}
                                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                                    <Button
                                        onClick={() => addSet(exIdx)}
                                        startIcon={<Plus size={16} />}
                                        size="small"
                                        color="inherit"
                                        sx={{ borderRadius: 2, color: 'text.secondary', fontWeight: 'bold' }}
                                    >
                                        {t('active_workout.add_set', '+ Set Ekle')}
                                    </Button>
                                </Box>
                            </Box>
                        </Paper>
                    );
                })}

                {/* Add Exercise Floating Row */}
                <Button
                    variant="outlined"
                    startIcon={<Plus size={20} />}
                    sx={{
                        py: 2, borderRadius: 4, borderStyle: 'dashed', borderWidth: 2,
                        fontWeight: 'bold', textTransform: 'none', fontSize: '1rem'
                    }}
                >
                    {t('active_workout.add_exercise', 'Egzersiz Ekle')}
                </Button>
            </Box>

            {/* Floating Finish Button Area */}
            <Box sx={{
                position: 'fixed', bottom: 0, left: 0, width: '100%',
                bgcolor: 'background.paper', backdropFilter: 'blur(10px)',
                borderTop: 1, borderColor: 'divider', p: 2, pb: { xs: 4, lg: 4 },
                display: 'flex', justifyContent: 'center', zIndex: 50,
                boxShadow: '0 -10px 40px rgba(0,0,0,0.05)'
            }}>
                <Button
                    variant="contained"
                    color="success"
                    disabled={saving}
                    onClick={finishWorkout}
                    sx={{
                        width: '100%', maxWidth: 'sm', py: 2, borderRadius: 4,
                        fontWeight: 900, fontSize: '1rem', textTransform: 'uppercase',
                        boxShadow: 3
                    }}
                >
                    {saving ? (
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <CircularProgress size={20} color="inherit" />
                            <Typography fontWeight="bold">{t('common.saving', 'Kaydediliyor...')}</Typography>
                        </Stack>
                    ) : (
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography fontWeight="bold">{t('active_workout.finish_workout', 'Antrenmanı Bitir')}</Typography>
                            <CheckCircle2 size={20} />
                        </Stack>
                    )}
                </Button>
            </Box>
        </Box>
    );
};

export default ActiveWorkout;
