import React, { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';
import api from '~/api/axios';
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { fetchUser } from '~/features/user/userSlice';
import { useNavigate } from 'react-router-dom';

const SuggestedAthletes = () => {
    const { t } = useTranslation();
    const { getToken } = useAuth();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const currentUser = useSelector((state) => state.user.value);

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchSuggested = async () => {
        try {
            const { data } = await api.get('/api/user/suggested', {
                headers: {
                    Authorization: `Bearer ${await getToken()}`,
                },
            });
            if (data.success) {
                setUsers(data.users);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleFollow = async (userId) => {
        try {
            const { data } = await api.post(
                "/api/user/follow",
                { id: userId },
                {
                    headers: { Authorization: `Bearer ${await getToken()}` },
                }
            );
            if (data.success) {
                toast.success(data.message);
                dispatch(fetchUser(await getToken()));
                // Remove from suggested list locally
                setUsers(prev => prev.filter(u => u._id !== userId));
            }
        } catch (error) {
            toast.error(error.message);
        }
    };

    useEffect(() => {
        fetchSuggested();
    }, []);

    if (loading) return null;
    if (users.length === 0) return null;

    return (
        <div className="w-full bg-surface border border-border-subtle rounded-[2rem] p-8 shadow-xl animate-in" style={{ animationDelay: '0.1s' }}>
            <h3 className="text-text-primary font-black text-lg tracking-tight mb-6">{t('feed.suggested_athletes')}</h3>
            <div className="space-y-6">
                {users.map((user) => (
                    <div key={user._id} className="flex items-center justify-between group">
                        <div
                            className="flex items-center gap-4 cursor-pointer"
                            onClick={() => navigate('/profile/' + user.username)}
                        >
                            <img
                                src={user.profile_picture}
                                alt={user.full_name}
                                className="w-12 h-12 rounded-full object-cover border-2 border-border-subtle shadow-md"
                            />
                            <div className="flex flex-col">
                                <span className="text-sm font-black text-text-primary leading-tight group-hover:text-accent-primary transition-colors">{user.username}</span>
                                <span className="text-xs font-bold text-text-muted line-clamp-1">{user.full_name}</span>
                            </div>
                        </div>
                        <button
                            onClick={() => handleFollow(user._id)}
                            className="text-xs font-black text-accent-primary hover:text-accent-hover transition-colors px-2 py-1"
                        >
                            {t('feed.follow')}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SuggestedAthletes;
