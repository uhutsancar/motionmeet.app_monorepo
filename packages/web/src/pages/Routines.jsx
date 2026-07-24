import { useCallback, useState, useEffect } from "react";
import { MoreHorizontal, Plus, FileText, Search, Dumbbell, PlayCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuthContext } from "../context/AuthProvider";
import api from "~/api/axios";
import { useNavigate } from "react-router-dom";
import RoutineBuilderModal from "../components/RoutineBuilderModal";
import { Box, Typography, Button, Paper, Stack, IconButton, Grid, Chip } from "@mui/material";

const Routines = () => {
    const { t } = useTranslation();
    const { getToken } = useAuthContext();
    const navigate = useNavigate();
    const [routines, setRoutines] = useState([]);
    const [showBuilder, setShowBuilder] = useState(false);
    const [nextCursor, setNextCursor] = useState(null);
    const [loadingMore, setLoadingMore] = useState(false);

    const fetchRoutines = useCallback(async (cursor = null) => {
        try {
            if (cursor) setLoadingMore(true);
            const token = await getToken();
            if (!token) return;
            const { data } = await api.get("/api/routine", {
                headers: { Authorization: `Bearer ${token}` },
                params: cursor ? { cursor } : undefined,
            });
            if (data.success) {
                setRoutines((currentRoutines) => {
                    if (!cursor) return data.routines || [];
                    const knownIds = new Set(currentRoutines.map((routine) => routine._id));
                    return [
                        ...currentRoutines,
                        ...(data.routines || []).filter((routine) => !knownIds.has(routine._id)),
                    ];
                });
                setNextCursor(data.nextCursor);
            }
        } catch (error) {
            console.error("Error fetching routines:", error);
        } finally {
            if (cursor) setLoadingMore(false);
        }
    }, [getToken]);

    useEffect(() => {
        fetchRoutines();
    }, [fetchRoutines]);

    return (
        <Box sx={{ width: '100%', minHeight: '100%', py: { xs: 2, md: 4 }, bgcolor: 'background.default', color: 'text.primary' }}>
            <Box sx={{ maxWidth: 1040, mx: 'auto', px: { xs: 1.5, sm: 3, md: 4 }, display: 'flex', flexDirection: 'column', gap: { xs: 2.5, md: 4 } }}>
                {/* Header */}
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" alignItems="center" spacing={2}>
                        <Box sx={{ p: 1.15, bgcolor: 'action.selected', borderRadius: 3, border: 1, borderColor: 'divider', display: { xs: 'none', sm: 'flex' }, alignItems: 'center', justifyContent: 'center' }}>
                            <Dumbbell size={24} style={{ color: 'var(--accent-primary)' }} />
                        </Box>
                        <Typography variant="h4" sx={{ fontSize: { xs: 28, sm: 34 } }}>
                            {t('routines.title', 'Rutinler')}
                        </Typography>
                    </Stack>
                    <Chip label={t('routines.pro_level', 'Pro level')} size="small" sx={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.65rem', background: 'linear-gradient(135deg, #F7C85C, #F08A3C)', color: '#20170A', border: 1, borderColor: 'rgba(255,255,255,0.3)', boxShadow: 2 }} />
                </Stack>

                {/* Main Action Area */}
                <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                        {/* Start Empty Workout Button */}
                        <Button
                            onClick={() => setShowBuilder(true)}
                            fullWidth
                            sx={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                background: 'linear-gradient(145deg, rgba(101,88,245,.14), rgba(18,168,138,.08))', border: 1, borderColor: 'divider', borderRadius: 5, p: { xs: 3, md: 4 },
                                height: '100%', textTransform: 'none', color: 'text.primary',
                                transition: 'all 0.2s', '&:hover': { bgcolor: 'action.hover', transform: 'translateY(-2px)', boxShadow: 3 }
                            }}
                        >
                            <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: 4, mb: 2, boxShadow: '0 10px 24px rgba(101,88,245,.24)' }}>
                                <Plus size={32} style={{ color: 'var(--accent-primary)' }} />
                            </Box>
                            <Typography variant="h6" fontWeight="bold">{t('routines.start_empty', 'Boş Başla')}</Typography>
                            <Typography variant="caption" color="text.secondary" fontWeight="medium" mt={1}>
                                {t('routines.start_empty_desc', 'Rutin olmadan hızlı bir seans başlat')}
                            </Typography>
                        </Button>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Stack spacing={2} height="100%">
                            <Button
                                onClick={() => setShowBuilder(true)}
                                fullWidth
                                sx={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 2,
                                    bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 5, p: { xs: 2.25, sm: 3 }, flex: 1,
                                    textTransform: 'none', color: 'text.primary', textAlign: 'left',
                                    transition: 'all 0.2s', '&:hover': { bgcolor: 'action.hover', transform: 'translateY(-2px)', boxShadow: 2 }
                                }}
                            >
                                <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 3, border: 1, borderColor: 'divider' }}>
                                    <FileText size={24} />
                                </Box>
                                <Box>
                                    <Typography variant="subtitle1" fontWeight="bold">{t('routines.new_routine', 'Yeni Rutin')}</Typography>
                                    <Typography variant="caption" color="text.secondary" fontWeight="medium">
                                        {t('routines.new_routine_desc', 'Kendi antrenman planını oluştur')}
                                    </Typography>
                                </Box>
                            </Button>
                            <Button
                                fullWidth
                                sx={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 2,
                                    bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 5, p: { xs: 2.25, sm: 3 }, flex: 1,
                                    textTransform: 'none', color: 'text.primary', textAlign: 'left',
                                    transition: 'all 0.2s', '&:hover': { bgcolor: 'action.hover', transform: 'translateY(-2px)', boxShadow: 2 }
                                }}
                            >
                                <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 3, border: 1, borderColor: 'divider' }}>
                                    <Search size={24} />
                                </Box>
                                <Box>
                                    <Typography variant="subtitle1" fontWeight="bold">{t('routines.discover', 'Keşfet')}</Typography>
                                    <Typography variant="caption" color="text.secondary" fontWeight="medium">
                                        {t('routines.discover_desc', 'Topluluğun favorilerini keşfet')}
                                    </Typography>
                                </Box>
                            </Button>
                        </Stack>
                    </Grid>
                </Grid>

                {/* Routines List */}
                <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" px={1}>
                        <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                            {t('routines.my_routines', 'Benim Rutinlerim')} ({routines.length})
                        </Typography>
                        <IconButton size="small" sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
                            <MoreHorizontal size={16} />
                        </IconButton>
                    </Stack>

                    {routines.length > 0 ? (
                        <Grid container spacing={2}>
                            {routines.map(routine => (
                                <Grid item xs={12} sm={6} key={routine._id}>
                                    <Paper variant="outlined" sx={{
                                        p: { xs: 2.25, sm: 3 }, borderRadius: 5, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%',
                                        transition: 'all 0.2s', '&:hover': { boxShadow: 4, borderColor: 'primary.main' }
                                    }}>
                                        <Box>
                                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
                                                <Box flex={1}>
                                                    <Typography variant="h6" fontWeight="bold" sx={{ mb: 1, transition: 'color 0.2s', '&:hover': { color: 'primary.main' } }}>
                                                        {routine.name}
                                                    </Typography>
                                                    <Stack direction="row" flexWrap="wrap" gap={0.5}>
                                                        {routine.exercises.slice(0, 3).map((e, idx) => (
                                                            <Chip key={idx} label={e.exerciseId?.name || 'Bilinmeyen'} size="small" sx={{ fontSize: '0.65rem', fontWeight: 'bold' }} />
                                                        ))}
                                                        {routine.exercises.length > 3 && (
                                                            <Typography variant="caption" fontWeight="bold" color="primary.main" sx={{ alignSelf: 'center', ml: 1 }}>
                                                                +{routine.exercises.length - 3} {t('profile.more_exercises', 'daha')}
                                                            </Typography>
                                                        )}
                                                    </Stack>
                                                </Box>
                                                <IconButton size="small">
                                                    <MoreHorizontal size={20} />
                                                </IconButton>
                                            </Stack>
                                        </Box>
                                        <Button
                                            variant="contained"
                                            fullWidth
                                            startIcon={<PlayCircle size={20} />}
                                            onClick={() => navigate('/active-workout', { state: { routine } })}
                                            sx={{ mt: 2, borderRadius: 4, py: 1.5, fontWeight: 'bold', textTransform: 'none' }}
                                        >
                                            {t('routines.start_routine', 'Rutini Başlat')}
                                        </Button>
                                    </Paper>
                                </Grid>
                            ))}
                        </Grid>
                    ) : (
                        <Paper variant="outlined" sx={{ p: { xs: 4, sm: 6 }, borderRadius: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: '50%', mb: 2 }}>
                                <FileText size={40} color="var(--text-muted)" />
                            </Box>
                            <Typography variant="h6" fontWeight="bold" mb={1}>{t('routines.no_routines', 'Henüz rutin yok')}</Typography>
                            <Typography variant="body2" color="text.secondary" mb={3} maxWidth={300}>
                                {t('routines.start_building', 'İlk antrenman planını oluşturmaya başla.')}
                            </Typography>
                            <Button variant="outlined" onClick={() => setShowBuilder(true)} sx={{ borderRadius: 4, px: 4, fontWeight: 'bold' }}>
                                {t('common.get_started', 'Hemen Başla')}
                            </Button>
                        </Paper>
                    )}
                    {nextCursor && (
                        <Button
                            variant="outlined"
                            onClick={() => fetchRoutines(nextCursor)}
                            disabled={loadingMore}
                            sx={{ alignSelf: 'center' }}
                        >
                            {loadingMore ? t('common.loading', 'Loading...') : t('common.load_more', 'Load more')}
                        </Button>
                    )}
                </Box>
            </Box>

            {showBuilder && (
                <RoutineBuilderModal
                    setShowModal={setShowBuilder}
                    onRoutineCreated={(r) => setRoutines(prev => [r, ...prev])}
                />
            )}
        </Box>
    );
};

export default Routines;
