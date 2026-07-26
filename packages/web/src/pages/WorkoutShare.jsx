import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Share, CheckCircle2, X } from 'lucide-react';
import moment from 'moment';
import { Box, Typography, IconButton, Button, Stack, Paper, Chip } from '@mui/material';
import toast from 'react-hot-toast';

const WorkoutCompleteShare = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();

    const workout = location.state?.workout;
    const totalSets = workout?.exercises?.reduce(
        (sum, exercise) => sum + (exercise.sets?.length || 0),
        0
    ) || 0;

    const handleShare = async () => {
        const text = `${workout.name}: ${workout.durationMinutes || 0} min · ${(workout.volumeKg || 0).toLocaleString()} kg`;
        try {
            if (navigator.share) {
                await navigator.share({ title: 'MotionMeet workout', text });
            } else {
                await navigator.clipboard.writeText(text);
                toast.success(t('common.copied', 'Copied to clipboard'));
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                toast.error(t('common.share_failed', 'Could not share this workout.'));
            }
        }
    };

    if (!workout) {
        return (
            <Box sx={{ width: '100%', minHeight: '100dvh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 3, textAlign: 'center' }}>
                <Typography variant="h5" fontWeight="900" mb={2}>Paylaşılacak antrenman bulunamadı.</Typography>
                <Button variant="contained" onClick={() => navigate('/routines')} sx={{ mt: 2, borderRadius: 4, fontWeight: 'bold' }}>
                    {t('menu.routines', 'Rutinlere dön')}
                </Button>
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%', minHeight: '100dvh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column', alignItems: 'center', p: { xs: 2, lg: 4 } }}>
            {/* Header */}
            <Box sx={{ width: '100%', maxWidth: 'sm', display: 'flex', justifyContent: 'flex-end', mb: 4 }}>
                <IconButton onClick={() => navigate('/feed')} sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', '&:hover': { bgcolor: 'action.hover' } }}>
                    <X size={24} />
                </IconButton>
            </Box>

            <Box sx={{ flex: 1, width: '100%', maxWidth: 'sm', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* Title Section */}
                <Box sx={{ textAlign: 'center', mb: 6 }}>
                    <CheckCircle2 size={64} color="#10b981" style={{ margin: '0 auto', marginBottom: 16 }} />
                    <Typography variant="h3" fontWeight="900" gutterBottom>{t('workout_share.completed', 'Workout complete')}</Typography>
                    <Typography variant="subtitle1" color="text.secondary" fontWeight="bold">{t('workout_share.saved', 'Your workout and post were saved.')}</Typography>
                </Box>

                {/* Share Card to overlay onto Instagram */}
                <Box sx={{
                    width: '100%', aspectRatio: '4/5', borderRadius: 10, p: 0.5, mb: 6, position: 'relative', overflow: 'hidden',
                    background: 'linear-gradient(to bottom right, #6366f1, #a855f7, #ec4899)',
                    boxShadow: '0 25px 50px -12px rgba(168, 85, 247, 0.25)'
                }}>
                    {/* Glass Overlay */}
                    <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }} />

                    {/* Inner Content */}
                    <Box sx={{
                        position: 'relative', height: '100%', bgcolor: 'rgba(var(--mui-palette-background-defaultChannel), 0.9)',
                        backdropFilter: 'blur(40px)', borderRadius: 9.5, p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center'
                    }}>
                        <Box sx={{ width: 64, height: 64, bgcolor: 'primary.main', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 4, boxShadow: '0 20px 25px -5px rgba(var(--mui-palette-primary-mainChannel), 0.3)' }}>
                            <Typography variant="h4" fontWeight="900" color="primary.contrastText">M</Typography>
                        </Box>

                        <Typography variant="h5" fontWeight="900" mb={1}>{workout?.name}</Typography>
                        <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 2, mb: 4 }}>
                            {moment(workout?.endTime).format('DD MMM YYYY')}
                        </Typography>

                        <Stack direction="row" spacing={2} sx={{ width: '100%', mb: 4 }}>
                            <Paper variant="outlined" sx={{ flex: 1, bgcolor: 'action.hover', p: 2, borderRadius: 4, border: 1, borderColor: 'divider' }}>
                                <Typography variant="h4" fontWeight="900" mb={0.5}>{workout?.durationMinutes}</Typography>
                                <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>Süre (Dk)</Typography>
                            </Paper>
                            <Paper variant="outlined" sx={{ flex: 1, bgcolor: 'action.hover', p: 2, borderRadius: 4, border: 1, borderColor: 'divider' }}>
                                <Typography variant="h4" fontWeight="900" mb={0.5}>{workout?.volumeKg}</Typography>
                                <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>Hacim (Kg)</Typography>
                            </Paper>
                        </Stack>

                        <Chip label={`${totalSets} ${t('statistics.sets', 'sets')}`} size="small" sx={{ bgcolor: 'success.light', color: 'success.dark', fontWeight: 'bold' }} />
                    </Box>
                </Box>

                {/* Sharing Options */}
                <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Button
                        variant="contained"
                        fullWidth
                        size="large"
                        startIcon={<Share size={20} />}
                        onClick={handleShare}
                        sx={{ py: 1.5, borderRadius: 4, fontWeight: 'bold' }}
                    >
                        {t('monthly_report.share', 'Share')}
                    </Button>

                    <Button
                        variant="outlined"
                        fullWidth
                        size="large"
                        onClick={() => navigate('/feed')}
                        sx={{ py: 2, borderRadius: 4, fontWeight: 'bold', color: 'text.primary', borderColor: 'divider', '&:hover': { bgcolor: 'action.hover' } }}
                    >
                        {t('common.done', 'Bitti')}
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

export default WorkoutCompleteShare;
