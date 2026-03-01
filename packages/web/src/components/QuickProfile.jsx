import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const QuickProfile = () => {
    const user = useSelector((state) => state.user.value);
    const navigate = useNavigate();
    const { t } = useTranslation();

    if (!user) return null;

    return (
        <div className="w-full bg-surface border border-border-subtle rounded-[2rem] p-8 shadow-xl animate-in">
            <div className="flex flex-col items-center text-center">
                <div className="relative mb-4">
                    <div className="w-20 h-20 rounded-full bg-surface-light flex items-center justify-center text-2xl font-bold text-text-primary shadow-lg border-2 border-border-subtle overflow-hidden">
                        {user.profile_picture ? (
                            <img src={user.profile_picture} alt={user.username} className="w-full h-full object-cover" />
                        ) : (
                            user.username.charAt(0).toUpperCase()
                        )}
                    </div>
                </div>

                <h2 className="text-xl font-black text-text-primary tracking-tight mb-6">@{user.username}</h2>

                <div className="flex w-full justify-between items-center mb-8 px-2">
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-wider mb-1">{t('feed.workouts')}</span>
                        <span className="text-lg font-black text-text-primary leading-none">{user.statistics?.totalWorkouts || 0}</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-wider mb-1">{t('feed.followers')}</span>
                        <span className="text-lg font-black text-text-primary leading-none">{user.followers?.length || 0}</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-wider mb-1">{t('feed.following')}</span>
                        <span className="text-lg font-black text-text-primary leading-none">{user.following?.length || 0}</span>
                    </div>
                </div>

                <button
                    onClick={() => navigate('/profile')}
                    className="w-full py-4 bg-surface-light hover:bg-border-subtle text-text-primary text-sm font-black rounded-2xl transition-all active:scale-95 shadow-sm border border-border-subtle"
                >
                    {t('feed.see_profile')}
                </button>
            </div>
        </div>
    );
};

export default QuickProfile;
