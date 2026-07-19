import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Share, Instagram, Twitter, CheckCircle2, Download, X } from 'lucide-react';
import moment from 'moment';
import { Box, Typography, IconButton, Button, Stack, Paper, Chip } from '@mui/material';

const WorkoutCompleteShare = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();

    const workout = location.state?.workout;

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
                    <Typography variant="h3" fontWeight="900" gutterBottom>Güzeldi!</Typography>
                    <Typography variant="subtitle1" color="text.secondary" fontWeight="bold">Bu senin 34. antrenmanın oldu.</Typography>
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

                        <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap">
                            <Chip label="2 Yeni Kupa 🏆" size="small" sx={{ bgcolor: 'success.light', color: 'success.dark', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.65rem' }} />
                            <Chip label="Bacak Günü" size="small" sx={{ bgcolor: 'info.light', color: 'info.dark', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.65rem' }} />
                        </Stack>
                    </Box>
                </Box>

                {/* Sharing Options */}
                <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Typography variant="caption" fontWeight="bold" color="text.secondary" align="center" sx={{ textTransform: 'uppercase', letterSpacing: 2 }}>Spacelara Paylaş</Typography>

                    <Stack direction="row" spacing={3} justifyContent="center" mb={4}>
                        <Stack alignItems="center" spacing={1}>
                            <IconButton sx={{ width: 56, height: 56, background: 'linear-gradient(to top right, #facc15, #ef4444, #a855f7)', color: 'white', boxShadow: 3, transition: 'transform 0.2s', '&:hover': { transform: 'scale(1.1)' } }}>
                                <Instagram size={24} />
                            </IconButton>
                            <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase' }}>Hikaye</Typography>
                        </Stack>
                        <Stack alignItems="center" spacing={1}>
                            <IconButton sx={{ width: 56, height: 56, bgcolor: 'common.black', color: 'white', boxShadow: 3, transition: 'transform 0.2s', '&:hover': { bgcolor: 'grey.900', transform: 'scale(1.1)' } }}>
                                <Twitter size={24} />
                            </IconButton>
                            <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase' }}>Gönderi</Typography>
                        </Stack>
                        <Stack alignItems="center" spacing={1}>
                            <IconButton sx={{ width: 56, height: 56, bgcolor: 'info.main', color: 'white', boxShadow: 3, transition: 'transform 0.2s', '&:hover': { bgcolor: 'info.dark', transform: 'scale(1.1)' } }}>
                                <Share size={24} />
                            </IconButton>
                            <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase' }}>Diğer</Typography>
                        </Stack>
                        <Stack alignItems="center" spacing={1}>
                            <IconButton sx={{ width: 56, height: 56, bgcolor: 'background.paper', border: 1, borderColor: 'divider', color: 'text.primary', boxShadow: 3, transition: 'transform 0.2s', '&:hover': { transform: 'scale(1.1)' } }}>
                                <Download size={24} />
                            </IconButton>
                            <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase' }}>İndir</Typography>
                        </Stack>
                    </Stack>

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
