import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Share, Instagram, Twitter, CheckCircle2, ChevronRight, Download, X } from 'lucide-react';
import moment from 'moment';

const WorkoutCompleteShare = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();

    // In a real app, this would come from location.state after finishing a workout
    const { workout } = location.state || {
        workout: {
            name: "Upper Body Power",
            endTime: new Date(),
            durationMinutes: 45,
            volumeKg: 4200,
            exercises: [
                { exerciseId: { name: 'Bench Press' }, sets: [{ weight: 80, reps: 10 }, { weight: 85, reps: 8 }] },
                { exerciseId: { name: 'Incline Dumbbell Press' }, sets: [{ weight: 30, reps: 12 }, { weight: 30, reps: 10 }] }
            ]
        }
    };

    return (
        <div className="w-full min-h-[100dvh] bg-background text-text-primary p-4 lg:p-8 flex flex-col items-center">

            {/* Header */}
            <div className="w-full justify-between flex items-center max-w-md mb-6">
                <div /> {/* spacing element */}
                <button onClick={() => navigate('/feed')} className="p-2 bg-surface rounded-full hover:bg-surface-light border border-border-subtle transition-colors">
                    <X className="w-6 h-6 text-text-muted" />
                </button>
            </div>

            <div className="flex-1 w-full max-w-md flex flex-col items-center">
                {/* Title Section */}
                <div className="text-center mb-8">
                    <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                    <h1 className="text-4xl font-black tracking-tight mb-2">Güzeldi!</h1>
                    <p className="text-text-muted font-medium">Bu senin 34. antrenmanın oldu.</p>
                </div>

                {/* Share Card to overlay onto Instagram */}
                <div className="w-full aspect-[4/5] bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-[2.5rem] p-1 shadow-2xl shadow-purple-500/20 mb-8 relative overflow-hidden group">
                    {/* Glass Overlay */}
                    <div className="absolute inset-0 bg-white/10 backdrop-blur-md"></div>

                    {/* Inner Content */}
                    <div className="relative h-full bg-background/90 backdrop-blur-3xl rounded-[2.25rem] p-8 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 bg-accent-primary rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-accent-primary/30">
                            <span className="text-white font-black text-2xl">M</span>
                        </div>

                        <h2 className="text-2xl font-black mb-1 text-text-primary">{workout?.name}</h2>
                        <p className="text-sm font-bold text-text-muted uppercase tracking-widest mb-8">
                            {moment(workout?.endTime).format('DD MMM YYYY')}
                        </p>

                        <div className="w-full grid grid-cols-2 gap-4">
                            <div className="bg-surface/50 border border-border-subtle/50 rounded-2xl p-4">
                                <span className="block text-3xl font-black text-text-primary mb-1">{workout?.durationMinutes}</span>
                                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Süre (Dk)</span>
                            </div>
                            <div className="bg-surface/50 border border-border-subtle/50 rounded-2xl p-4">
                                <span className="block text-3xl font-black text-text-primary mb-1">{workout?.volumeKg}</span>
                                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Hacim (Kg)</span>
                            </div>
                        </div>

                        <div className="mt-8 flex flex-wrap justify-center gap-2">
                            <span className="bg-emerald-500/10 text-emerald-500 font-bold text-[10px] px-3 py-1.5 rounded-full uppercase tracking-widest">
                                2 Yeni Kupa 🏆
                            </span>
                            <span className="bg-blue-500/10 text-blue-500 font-bold text-[10px] px-3 py-1.5 rounded-full uppercase tracking-widest">
                                Bacak Günü
                            </span>
                        </div>
                    </div>
                </div>

                {/* Sharing Options */}
                <div className="w-full space-y-4">
                    <h3 className="font-bold text-sm text-text-muted uppercase tracking-widest ml-2 mb-2 p-0 text-center">Spacelara Paylaş</h3>

                    <div className="flex justify-center gap-4 mb-8">
                        <button className="flex flex-col items-center gap-2 group">
                            <div className="w-14 h-14 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                <Instagram className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-[10px] font-bold text-text-muted uppercase">Hikaye</span>
                        </button>

                        <button className="flex flex-col items-center gap-2 group">
                            <div className="w-14 h-14 bg-black rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                <Twitter className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-[10px] font-bold text-text-muted uppercase">Gönderi</span>
                        </button>

                        <button className="flex flex-col items-center gap-2 group">
                            <div className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                <Share className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-[10px] font-bold text-text-muted uppercase">Diğer</span>
                        </button>

                        <button className="flex flex-col items-center gap-2 group">
                            <div className="w-14 h-14 bg-surface rounded-full flex items-center justify-center shadow-lg border border-border-subtle group-hover:scale-110 transition-transform">
                                <Download className="w-6 h-6 text-text-primary" />
                            </div>
                            <span className="text-[10px] font-bold text-text-muted uppercase">İndir</span>
                        </button>
                    </div>

                    <button
                        onClick={() => navigate('/feed')}
                        className="w-full bg-surface-light border border-border-subtle py-4 rounded-2xl font-bold text-text-primary hover:bg-surface transition-colors"
                    >
                        {t('common.done', 'Bitti')}
                    </button>
                </div>

            </div>

        </div>
    );
};

export default WorkoutCompleteShare;
