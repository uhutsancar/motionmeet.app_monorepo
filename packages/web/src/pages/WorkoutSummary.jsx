import React, { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import {
    Activity, ArrowLeft, Camera, Check, Dumbbell, PlayCircle, Star,
    TrendingUp, Zap, MapPin, Eye, Lock, X, Users
} from 'lucide-react';
import moment from 'moment';
import api from '~/api/axios';
import { useAuth } from '@clerk/clerk-react';
import toast from 'react-hot-toast';

const VISIBILITY_OPTIONS = [
    { value: 'public', label: 'Herkes', icon: <Eye className="w-4 h-4" /> },
    { value: 'followers', label: 'Takipçiler', icon: <Users className="w-4 h-4" /> },
    { value: 'private', label: 'Sadece Ben', icon: <Lock className="w-4 h-4" /> },
];

const WorkoutSummary = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const { getToken } = useAuth();

    // Comes from ActiveWorkout page via navigate('/workout-summary', { state: { workout, workoutId } })
    const { workout, workoutId } = location.state || {
        workout: {
            name: "Upper Body Power",
            endTime: new Date(),
            durationMinutes: 45,
            volumeKg: 4200,
            exercises: [
                { exerciseId: { name: 'Bench Press' }, sets: [{ weight: 80, reps: 10 }, { weight: 85, reps: 8 }] },
                { exerciseId: { name: 'Incline Dumbbell Press' }, sets: [{ weight: 30, reps: 12 }, { weight: 30, reps: 10 }] }
            ]
        },
        workoutId: null
    };

    const [note, setNote] = useState('');
    const [visibility, setVisibility] = useState('public');
    const [saving, setSaving] = useState(false);
    const [mediaFile, setMediaFile] = useState(null);
    const [mediaPreview, setMediaPreview] = useState(null);
    const fileInputRef = useRef(null);

    const chartData = Array.from({ length: 10 }, (_, i) => ({
        time: i,
        hr: 100 + Math.random() * 50
    }));

    const totalSets = workout?.exercises?.reduce((acc, ex) => acc + ex.sets.length, 0) || 0;

    // ── Media Picker ───────────────────────────────────────────────
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setMediaFile(file);
        setMediaPreview(URL.createObjectURL(file));
    };

    const removeMedia = () => {
        setMediaFile(null);
        setMediaPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ── Save & Post ────────────────────────────────────────────────
    const handleSave = async () => {
        setSaving(true);
        try {
            const token = await getToken();
            const authHeaders = { Authorization: `Bearer ${token}` };

            // 1. Save workout to DB (if not already saved from ActiveWorkout)
            let savedWorkoutId = workoutId;
            if (!savedWorkoutId) {
                const { data: workoutRes } = await api.post('/api/workout', {
                    name: workout.name,
                    durationMinutes: workout.durationMinutes || 0,
                    volumeKg: workout.volumeKg || 0,
                    startTime: new Date(Date.now() - (workout.durationMinutes || 0) * 60000),
                    endTime: new Date(),
                    exercises: workout.exercises || [],
                }, { headers: authHeaders });

                if (!workoutRes.success) {
                    toast.error(workoutRes.message || 'Antrenman kaydedilemedi');
                    return;
                }
                savedWorkoutId = workoutRes.workout?._id;
            }

            // 2. Create workout post (ALWAYS, visibility controls who sees it)
            if (mediaFile) {
                // With photo → multipart
                const formData = new FormData();
                formData.append('content', note.trim() || '');
                formData.append('post_type', 'workout');
                formData.append('visibility', visibility);
                if (savedWorkoutId) formData.append('workout', savedWorkoutId);
                formData.append('images', mediaFile);

                const { data: postRes } = await api.post('/api/post/add', formData, {
                    headers: { ...authHeaders, 'Content-Type': 'multipart/form-data' }
                });
                if (!postRes.success) throw new Error(postRes.message);
            } else {
                // No photo → JSON
                const { data: postRes } = await api.post('/api/post/add', {
                    content: note.trim() || '',
                    post_type: 'workout',
                    visibility,
                    workout: savedWorkoutId,
                }, { headers: authHeaders });
                if (!postRes.success) throw new Error(postRes.message);
            }

            toast.success('Antrenman kaydedildi ve paylaşıldı! 🎉');
            navigate('/');
        } catch (error) {
            console.error('WorkoutSummary save error:', error);
            toast.error(error.message || 'Bir hata oluştu');
        } finally {
            setSaving(false);
        }
    };

    const handleDiscard = () => {
        if (window.confirm('Antrenman silinsin mi? Bu işlem geri alınamaz.')) {
            navigate('/');
        }
    };

    return (
        <div className="w-full min-h-[100dvh] bg-background text-text-primary p-4 lg:p-8 flex flex-col items-center">

            {/* Header */}
            <div className="w-full max-w-2xl flex items-center justify-between mb-8">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-surface rounded-full transition-colors">
                    <ArrowLeft className="w-6 h-6 text-text-primary" />
                </button>
                <h1 className="text-xl font-bold">{t('workout_summary.save_workout', 'Antrenmanı Kaydet')}</h1>
                <button onClick={handleDiscard} className="p-2 hover:bg-red-500/10 rounded-full transition-colors">
                    <X className="w-5 h-5 text-red-400" />
                </button>
            </div>

            <div className="w-full max-w-2xl space-y-6 pb-32">

                {/* Media Upload */}
                <div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                    {mediaPreview ? (
                        <div className="relative rounded-3xl overflow-hidden">
                            <img src={mediaPreview} alt="preview" className="w-full max-h-80 object-cover rounded-3xl" />
                            <button
                                onClick={removeMedia}
                                className="absolute top-3 right-3 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center hover:bg-red-500/80 transition-colors"
                            >
                                <X className="w-4 h-4 text-white" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full bg-surface border border-border-subtle rounded-3xl p-6 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-surface-light transition-colors group"
                        >
                            <div className="w-16 h-16 bg-accent-primary/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Camera className="w-8 h-8 text-accent-primary" />
                            </div>
                            <div className="text-center">
                                <h3 className="font-bold text-text-primary mb-1">{t('workout_summary.add_media', 'Fotoğraf Ekle')}</h3>
                                <p className="text-xs text-text-secondary">Antrenman anını ölümsüzleştir</p>
                            </div>
                        </button>
                    )}
                </div>

                {/* Workout Details */}
                <div className="bg-surface border border-border-subtle rounded-3xl p-6 space-y-4">
                    <div>
                        <input
                            type="text"
                            value={workout?.name || ''}
                            readOnly
                            className="w-full text-xl font-black bg-transparent border-none outline-none text-text-primary mb-2"
                        />
                        <div className="flex items-center gap-2 text-text-muted text-sm font-medium">
                            <MapPin className="w-4 h-4" />
                            <span>{moment().format('D MMM YYYY, HH:mm')}</span>
                        </div>
                    </div>

                    <div className="w-full h-px bg-border-subtle" />

                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={t('workout_summary.note_placeholder', 'Antrenman nasıldı? Bir not ekle...')}
                        className="w-full h-24 bg-background rounded-2xl p-4 text-sm resize-none outline-none border border-transparent focus:border-accent-primary transition-colors text-text-primary placeholder:text-text-muted"
                    />
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-surface rounded-2xl p-4 border border-border-subtle flex flex-col items-center justify-center gap-1">
                        <div className="flex items-center gap-1 text-text-muted mb-1">
                            <Activity className="w-4 h-4 text-accent-primary" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Süre</span>
                        </div>
                        <span className="text-xl font-black">{workout?.durationMinutes} <span className="text-xs font-medium">dk</span></span>
                    </div>
                    <div className="bg-surface rounded-2xl p-4 border border-border-subtle flex flex-col items-center justify-center gap-1">
                        <div className="flex items-center gap-1 text-text-muted mb-1">
                            <Dumbbell className="w-4 h-4 text-emerald-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Hacim</span>
                        </div>
                        <span className="text-xl font-black">{workout?.volumeKg} <span className="text-xs font-medium">kg</span></span>
                    </div>
                    <div className="bg-surface rounded-2xl p-4 border border-border-subtle flex flex-col items-center justify-center gap-1">
                        <div className="flex items-center gap-1 text-text-muted mb-1">
                            <PlayCircle className="w-4 h-4 text-orange-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Set</span>
                        </div>
                        <span className="text-xl font-black">{totalSets}</span>
                    </div>
                    <div className="bg-surface rounded-2xl p-4 border border-border-subtle flex flex-col items-center justify-center gap-1">
                        <div className="flex items-center gap-1 text-text-muted mb-1">
                            <TrendingUp className="w-4 h-4 text-blue-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Egzersiz</span>
                        </div>
                        <span className="text-xl font-black">{workout?.exercises?.length || 0}</span>
                    </div>
                </div>

                {/* Intensity Chart */}
                <div className="bg-surface border border-border-subtle rounded-3xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Zap className="w-5 h-5 text-amber-500" />
                            <span className="font-bold">Yoğunluk</span>
                        </div>
                        <span className="text-xs font-bold text-text-muted bg-surface-light px-2 py-1 rounded-md">~{Math.floor(120 + Math.random() * 40)} BPM AVG</span>
                    </div>
                    <div className="h-24 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="hr" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorHr)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Exercises Summary */}
                <div className="bg-surface border border-border-subtle rounded-3xl p-6 space-y-4">
                    <h3 className="font-bold text-text-primary px-1">Egzersizler</h3>
                    <div className="space-y-3">
                        {workout?.exercises?.map((ex, idx) => (
                            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-surface-light rounded-2xl border border-border-subtle">
                                <span className="font-bold text-sm mb-2 sm:mb-0">{ex.exerciseId?.name}</span>
                                <div className="flex items-center gap-4">
                                    <span className="text-xs font-bold text-text-muted">{ex.sets.length} Set</span>
                                    <span className="text-xs font-bold text-text-muted">
                                        Max: {Math.max(...ex.sets.map(s => s.weight || 0))} kg
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Visibility Settings */}
                <div className="bg-surface border border-border-subtle rounded-3xl p-6">
                    <h3 className="font-bold text-text-primary mb-4">Kimler Görebilir?</h3>
                    <div className="flex gap-3">
                        {VISIBILITY_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setVisibility(opt.value)}
                                className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${visibility === opt.value
                                        ? 'border-accent-primary bg-accent-primary/10'
                                        : 'border-border-subtle bg-background hover:bg-surface-light'
                                    }`}
                            >
                                <div className={visibility === opt.value ? 'text-accent-primary' : 'text-text-muted'}>
                                    {opt.icon}
                                </div>
                                <span className={`text-xs font-bold ${visibility === opt.value ? 'text-accent-primary' : 'text-text-muted'}`}>
                                    {opt.label}
                                </span>
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-text-muted mt-3 px-1">
                        {visibility === 'private' && '🔒 Sadece senin profilinde görünür'}
                        {visibility === 'followers' && '👥 Sadece bağlantıda olduğun kişiler görebilir'}
                        {visibility === 'public' && '🌍 Herkes keşfet sayfasında görebilir'}
                    </p>
                </div>

                {/* Discard */}
                <button
                    onClick={handleDiscard}
                    className="w-full py-3 text-red-400 text-sm font-bold hover:text-red-500 transition-colors"
                >
                    Antrenmanı Sil
                </button>
            </div>

            {/* Bottom Save Button */}
            <div className="fixed bottom-0 left-0 w-full bg-background/90 backdrop-blur-md border-t border-border-subtle p-4 lg:p-6 pb-8 flex justify-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full max-w-2xl bg-accent-primary text-white font-black uppercase tracking-widest py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-accent-hover transition-colors shadow-xl shadow-accent-primary/20 active:scale-[0.98] disabled:opacity-50"
                >
                    {saving ? (
                        <Activity className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            {t('common.save', 'Kaydet & Paylaş')}
                            <Check className="w-5 h-5" />
                        </>
                    )}
                </button>
            </div>

        </div>
    );
};

export default WorkoutSummary;
