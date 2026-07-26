import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
    Activity, ArrowLeft, Camera, Dumbbell, PlayCircle,
    Zap, Eye, Lock, X, Users
} from 'lucide-react';

import { createWorkout, createPost } from '~/api/endpoints';
import { useAuthContext } from "../context/AuthProvider.jsx";
import toast from 'react-hot-toast';
import {
    Box, Stack, Typography, IconButton, Button, Paper, TextField,
    Divider, CircularProgress, Select, MenuItem, InputLabel, FormControl
} from '@mui/material';
import { uploadMedia } from '~/api/mediaUpload';
const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const VISIBILITY_OPTIONS = [
    { value: 'public', label: 'Herkes', icon: <Eye size={16} /> },
    { value: 'followers', label: 'Takipçiler', icon: <Users size={16} /> },
    { value: 'private', label: 'Sadece Ben', icon: <Lock size={16} /> },
];

const WorkoutSummary = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const { getToken } = useAuthContext();

    const workout = location.state?.workout;
    const workoutId = location.state?.workoutId || workout?._id;

    const [note, setNote] = useState('');
    const [visibility, setVisibility] = useState('public');
    const [saving, setSaving] = useState(false);
    const [mediaFile, setMediaFile] = useState(null);
    const [mediaPreview, setMediaPreview] = useState(null);
    const fileInputRef = useRef(null);
    const savedWorkoutIdRef = useRef(workoutId);

    const totalSets = workout?.exercises?.reduce((acc, ex) => acc + ex.sets.length, 0) || 0;
    const exerciseSummary = useMemo(
        () => (workout?.exercises || []).map((exercise) => ({
            name: exercise.exerciseId?.name || exercise.name || t('workout.exercise', 'Exercise'),
            sets: exercise.sets?.length || 0,
            volume: Math.round(
                (exercise.sets || []).reduce(
                    (sum, set) => sum + (Number(set.weight) || 0) * (Number(set.reps) || 0),
                    0
                )
            ),
        })),
        [t, workout?.exercises]
    );

    useEffect(() => {
        return () => {
            if (mediaPreview) URL.revokeObjectURL(mediaPreview);
        };
    }, [mediaPreview]);

    // ── Media Picker ───────────────────────────────────────────────
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (mediaPreview) URL.revokeObjectURL(mediaPreview);
        setMediaFile(file);
        setMediaPreview(URL.createObjectURL(file));
    };

    const removeMedia = () => {
        if (mediaPreview) URL.revokeObjectURL(mediaPreview);
        setMediaFile(null);
        setMediaPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ── Save & Post ────────────────────────────────────────────────
    const handleSave = async () => {
        if (!workout) {
            toast.error(t('workout_summary.missing_workout', 'Antrenman bilgisi bulunamadı.'));
            return;
        }
        setSaving(true);
        try {
            const token = await getToken();

            // 1. Save workout to DB (if not already saved from ActiveWorkout)
            let savedWorkoutId = savedWorkoutIdRef.current;
            if (!savedWorkoutId) {
                const workoutData = {
                    name: workout.name,
                    durationMinutes: workout.durationMinutes || 0,
                    volumeKg: workout.volumeKg || 0,
                    startTime: new Date(Date.now() - (workout.durationMinutes || 0) * 60000),
                    endTime: new Date(),
                    exercises: workout.exercises || [],
                };
                const workoutRes = await createWorkout(workoutData, token);

                if (!workoutRes.success) {
                    toast.error(workoutRes.message || 'Antrenman kaydedilemedi');
                    return;
                }
                savedWorkoutId = workoutRes.workout?._id;
                savedWorkoutIdRef.current = savedWorkoutId;
            }

            // 2. Create workout post (ALWAYS, visibility controls who sees it)
            if (mediaFile) {
                const uploadedKey = await uploadMedia(mediaFile, 'posts', token);
                const postRes = await createPost({
                    content: note.trim() || '',
                    post_type: 'workout',
                    visibility,
                    workout: savedWorkoutId,
                    uploadedKeys: [uploadedKey],
                }, token);
                if (!postRes.success) throw new Error(postRes.message);
            } else {
                // No photo → JSON
                const postRes = await createPost({
                    content: note.trim() || '',
                    post_type: 'workout',
                    visibility,
                    workout: savedWorkoutId,
                }, token);
                if (!postRes.success) throw new Error(postRes.message);
            }

            toast.success('Antrenman kaydedildi ve paylaşıldı! 🎉');
            navigate('/workout-share', { replace: true, state: { workout: { ...workout, _id: savedWorkoutId } } });
        } catch (error) {
            console.error('WorkoutSummary save error:', error);
            toast.error(error.message || 'Bir hata oluştu');
        } finally {
            setSaving(false);
        }
    };

    const handleDiscard = () => {
        if (window.confirm('Paylaşmadan çıkmak istediğinize emin misiniz? Antrenman kaydınız korunacak.')) {
            navigate('/routines');
        }
    };

    if (!workout) {
        return (
            <Box sx={{ width: '100%', minHeight: '100dvh', bgcolor: 'background.default', color: 'text.primary', display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3, justifyContent: 'center', textAlign: 'center' }}>
                <Dumbbell size={64} style={{ marginBottom: 16, color: 'var(--border-subtle)' }} />
                <Typography variant="h5" fontWeight="900" gutterBottom>
                    {t('workout_summary.not_found_title', 'Antrenman Bulunamadı')}
                </Typography>
                <Typography color="text.secondary" mb={4}>
                    {t('workout_summary.not_found_desc', 'Görüntülenecek bir antrenman özeti yok.')}
                </Typography>
                <Button variant="contained" onClick={() => navigate('/routines')}>
                    {t('workout_summary.go_to_routines', 'Rutinlere Dön')}
                </Button>
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%', minHeight: '100dvh', bgcolor: 'background.default', pb: { xs: 16, lg: 4 } }}>
            {/* Header */}
            <Box sx={{ position: 'sticky', top: 0, zIndex: 50, bgcolor: 'background.paper', backdropFilter: 'blur(10px)', borderBottom: 1, borderColor: 'divider', p: 2 }}>
                <Box sx={{ maxWidth: 'md', mx: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Stack direction="row" alignItems="center" spacing={2}>
                        <IconButton onClick={handleDiscard}>
                            <ArrowLeft size={24} />
                        </IconButton>
                        <Stack>
                            <Typography variant="overline" sx={{ fontSize: '0.65rem', fontWeight: 900, color: 'text.secondary', lineHeight: 1 }}>
                                {t('workout_summary.title', 'ANTRENMAN ÖZETİ')}
                            </Typography>
                            <Typography variant="subtitle1" fontWeight="bold">
                                {workout.name || 'İsimsiz Antrenman'}
                            </Typography>
                        </Stack>
                    </Stack>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSave}
                        disabled={saving}
                        sx={{ borderRadius: 4, fontWeight: 'bold' }}
                    >
                        {saving ? <CircularProgress size={20} color="inherit" /> : t('common.save', 'Kaydet')}
                    </Button>
                </Box>
            </Box>

            <Box sx={{ maxWidth: 'md', mx: 'auto', p: { xs: 2, lg: 4 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Stats Grid */}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 4, textAlign: 'center', bgcolor: 'background.paper' }}>
                        <PlayCircle size={24} style={{ color: '#60A5FA', margin: '0 auto 8px auto' }} />
                        <Typography variant="h5" fontWeight="900">
                            {workout.durationSeconds ? formatTime(workout.durationSeconds) : `${workout.durationMinutes || 0}m`}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ textTransform: 'uppercase' }}>
                            {t('statistics.duration', 'Süre')}
                        </Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 4, textAlign: 'center', bgcolor: 'background.paper' }}>
                        <Zap size={24} style={{ color: '#f97316', margin: '0 auto 8px auto' }} />
                        <Typography variant="h5" fontWeight="900">{workout.volumeKg || 0}kg</Typography>
                        <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ textTransform: 'uppercase' }}>
                            {t('statistics.volume', 'Hacim')}
                        </Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 4, textAlign: 'center', bgcolor: 'background.paper' }}>
                        <Activity size={24} style={{ color: '#10b981', margin: '0 auto 8px auto' }} />
                        <Typography variant="h5" fontWeight="900">{totalSets}</Typography>
                        <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ textTransform: 'uppercase' }}>
                            {t('statistics.sets', 'Set')}
                        </Typography>
                    </Paper>
                </Box>

                {/* Media Upload */}
                <Box>
                    <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                    />
                    {mediaPreview ? (
                        <Box sx={{ position: 'relative', borderRadius: 4, overflow: 'hidden', height: 240, border: 1, borderColor: 'divider' }}>
                            <Box component="img" src={mediaPreview} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <IconButton
                                onClick={removeMedia}
                                sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'background.paper', '&:hover': { bgcolor: 'error.light', color: 'error.main' } }}
                            >
                                <X size={20} />
                            </IconButton>
                        </Box>
                    ) : (
                        <Button
                            variant="outlined"
                            fullWidth
                            onClick={() => fileInputRef.current?.click()}
                            sx={{
                                py: 4, borderRadius: 4, borderStyle: 'dashed', borderWidth: 2,
                                display: 'flex', flexDirection: 'column', gap: 1, color: 'text.secondary'
                            }}
                        >
                            <Camera size={32} />
                            <Typography fontWeight="bold">{t('workout_summary.add_photo', 'Fotoğraf Ekle')}</Typography>
                        </Button>
                    )}
                </Box>

                {/* Note */}
                <Box>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>{t('workout_summary.note', 'Not')}</Typography>
                    <TextField
                        multiline
                        rows={3}
                        fullWidth
                        placeholder={t('workout_summary.note_placeholder', 'Nasıl hissettin?')}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        variant="outlined"
                        sx={{ bgcolor: 'background.paper', borderRadius: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                </Box>

                {/* Visibility */}
                <FormControl fullWidth>
                    <InputLabel id="visibility-label">{t('settings.visibility', 'Görünürlük')}</InputLabel>
                    <Select
                        labelId="visibility-label"
                        value={visibility}
                        label={t('settings.visibility', 'Görünürlük')}
                        onChange={(e) => setVisibility(e.target.value)}
                        sx={{ bgcolor: 'background.paper', borderRadius: 2 }}
                    >
                        {VISIBILITY_OPTIONS.map(opt => (
                            <MenuItem key={opt.value} value={opt.value}>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    {opt.icon}
                                    <Typography>{opt.label}</Typography>
                                </Stack>
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Divider sx={{ my: 1 }} />

                {/* Exercise summary */}
                <Paper variant="outlined" sx={{ borderRadius: 4, p: 3, bgcolor: 'background.paper' }}>
                    <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                        {t('workout_summary.exercise_summary', 'Exercise summary')}
                    </Typography>
                    <Stack spacing={1.25}>
                        {exerciseSummary.map((exercise, index) => (
                            <Stack key={`${exercise.name}-${index}`} direction="row" justifyContent="space-between" spacing={2}>
                                <Typography variant="body2" fontWeight={700}>{exercise.name}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {exercise.sets} {t('statistics.sets', 'sets')} · {exercise.volume.toLocaleString()} kg
                                </Typography>
                            </Stack>
                        ))}
                    </Stack>
                </Paper>
            </Box>
        </Box>
    );
};

export default WorkoutSummary;
