import React, { useContext, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ThemeContext } from "../context/ThemeContext";
import {
    Moon, Sun, Globe, Monitor, LogOut, Bell, Lock, HelpCircle,
    ChevronRight, ChevronDown, ChevronUp, Mail, ExternalLink, User
} from "lucide-react";
import { useClerk, useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";

// ── Storage key helpers ───────────────────────────────────────────────────────
const getNotifPrefs = () => {
    try { return JSON.parse(localStorage.getItem('@mm_notif_prefs') || '{}'); } catch { return {}; }
};
const getPrivacyPrefs = () => {
    try { return JSON.parse(localStorage.getItem('@mm_privacy_prefs') || '{}'); } catch { return {}; }
};

// ── Reusable toggle switch ────────────────────────────────────────────────────
const Toggle = ({ value, onChange }) => (
    <button
        onClick={onChange}
        className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${value ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-color)]'}`}
    >
        <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform duration-200 ${value ? 'translate-x-6' : 'translate-x-0'}`}
        />
    </button>
);

// ── Section wrapper ───────────────────────────────────────────────────────────
const Section = ({ icon: Icon, title, children, delay = '0s' }) => (
    <section className="animate-in" style={{ animationDelay: delay }}>
        <div className="flex items-center gap-2 mb-4">
            <Icon className="w-5 h-5 text-[var(--accent-primary)]" />
            <h2 className="text-lg font-bold text-[var(--text-primary)]">{title}</h2>
        </div>
        <div className="bg-[var(--surface-color)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-sm divide-y divide-[var(--border-color)]">
            {children}
        </div>
    </section>
);

// ── Row with toggle ───────────────────────────────────────────────────────────
const ToggleRow = ({ label, subtitle, value, onChange }) => (
    <div className="p-4 flex items-center justify-between hover:bg-[var(--surface-light)] transition-colors">
        <div>
            <p className="font-semibold text-sm text-[var(--text-primary)]">{label}</p>
            {subtitle && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{subtitle}</p>}
        </div>
        <Toggle value={value} onChange={onChange} />
    </div>
);

// ── Row with chevron ──────────────────────────────────────────────────────────
const LinkRow = ({ label, subtitle, onClick, danger = false, external = false }) => (
    <button
        onClick={onClick}
        className={`w-full p-4 flex items-center justify-between hover:bg-[var(--surface-light)] transition-colors text-left ${danger ? 'text-red-500' : 'text-[var(--text-primary)]'}`}
    >
        <div>
            <p className={`font-semibold text-sm ${danger ? 'text-red-500' : 'text-[var(--text-primary)]'}`}>{label}</p>
            {subtitle && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{subtitle}</p>}
        </div>
        {external ? <ExternalLink size={16} className="text-[var(--text-secondary)]" /> : <ChevronRight size={16} className="text-[var(--text-secondary)]" />}
    </button>
);

// ── FAQ accordion item ────────────────────────────────────────────────────────
const FaqItem = ({ q, a }) => {
    const [open, setOpen] = useState(false);
    return (
        <div>
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full p-4 flex items-center justify-between hover:bg-[var(--surface-light)] transition-colors text-left"
            >
                <p className="font-semibold text-sm text-[var(--text-primary)] flex-1 pr-4">{q}</p>
                {open ? <ChevronUp size={16} className="text-[var(--text-secondary)] shrink-0" /> : <ChevronDown size={16} className="text-[var(--text-secondary)] shrink-0" />}
            </button>
            {open && (
                <div className="px-4 pb-4">
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{a}</p>
                </div>
            )}
        </div>
    );
};

// ── Main Settings Page ────────────────────────────────────────────────────────
const Settings = () => {
    const { t, i18n } = useTranslation();
    const { theme, toggleTheme } = useContext(ThemeContext);
    const { signOut } = useClerk();
    const { user } = useUser();
    const navigate = useNavigate();

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
        localStorage.setItem('appLanguage', lng);
    };
    const isTr = i18n.language.startsWith('tr');

    // Notification preferences
    const [notifPrefs, setNotifPrefs] = useState({
        pushEnabled: true, newFollower: true, postLike: true,
        postComment: true, newMessage: true, workoutReminder: false, weeklyReport: true,
        ...getNotifPrefs(),
    });
    const toggleNotif = (key) => {
        const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
        setNotifPrefs(updated);
        localStorage.setItem('@mm_notif_prefs', JSON.stringify(updated));
    };

    // Privacy preferences
    const [privacyPrefs, setPrivacyPrefs] = useState({
        publicProfile: true, showWorkoutsOnFeed: true,
        allowFollowers: true, showInSearch: true, allowMessages: true,
        ...getPrivacyPrefs(),
    });
    const togglePrivacy = (key) => {
        const updated = { ...privacyPrefs, [key]: !privacyPrefs[key] };
        setPrivacyPrefs(updated);
        localStorage.setItem('@mm_privacy_prefs', JSON.stringify(updated));
    };

    const handleDeleteAccount = () => {
        const confirmed = window.confirm(t('privacy.delete_confirm', 'Bu işlem geri alınamaz. Devam etmek istiyor musunuz?'));
        if (confirmed) {
            window.alert(t('privacy.contact_support', 'Hesap silmek için lütfen destek ile iletişime geçin: support@motionmeet.app'));
        }
    };

    const faqs = [
        { q: t('support.faq1_q', 'Antrenman verilerim nerede saklanıyor?'), a: t('support.faq1_a', 'Tüm verileriniz güvenli bulut sunucularımızda şifrelenmiş olarak saklanır.') },
        { q: t('support.faq2_q', 'Şifremi nasıl sıfırlarım?'), a: t('support.faq2_a', 'Giriş ekranındaki "Şifremi Unuttum" seçeneğini kullanabilirsiniz.') },
        { q: t('support.faq3_q', 'Verilerimi dışa aktarabilir miyim?'), a: t('support.faq3_a', 'Yakında gelecek güncellemede veri dışa aktarma özelliği eklenecektir.') },
        { q: t('support.faq4_q', 'Uygulama hangi platformlarda çalışıyor?'), a: t('support.faq4_a', 'MotionMeet iOS, Android ve Web üzerinde kullanılabilir.') },
        { q: t('support.faq5_q', 'Bildirimler gelmiyor, ne yapmalıyım?'), a: t('support.faq5_a', 'Ayarlar > Bildirimler bölümünden bildirimlerin açık olduğunu kontrol edin.') },
    ];

    return (
        <div className="w-full h-full min-h-screen pt-4 sm:pt-6 pb-20 sm:pb-8 text-[var(--text-primary)] bg-[var(--background)] overflow-y-auto no-scrollbar">
            <div className="max-w-3xl mx-auto px-4 sm:px-8 space-y-8">
                <h1 className="text-3xl font-black">{t('settings.title', 'Ayarlar')}</h1>

                {/* Account */}
                <Section icon={User} title={t('settings.account', 'Hesap')} delay="0s">
                    <div className="p-4 flex items-center gap-4 hover:bg-[var(--surface-light)] transition-colors cursor-pointer" onClick={() => navigate('/profile')}>
                        {user?.imageUrl ? (
                            <img src={user.imageUrl} alt="avatar" className="w-12 h-12 rounded-full object-cover border-2 border-[var(--border-color)]" />
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-[var(--accent-primary)]/20 flex items-center justify-center">
                                <User size={22} className="text-[var(--accent-primary)]" />
                            </div>
                        )}
                        <div className="flex-1">
                            <p className="font-bold text-sm text-[var(--text-primary)]">{user?.fullName || user?.username || '—'}</p>
                            <p className="text-xs text-[var(--text-secondary)]">{user?.primaryEmailAddress?.emailAddress || ''}</p>
                        </div>
                        <ChevronRight size={16} className="text-[var(--text-secondary)]" />
                    </div>
                </Section>

                {/* Appearance */}
                <Section icon={Monitor} title={t('settings.appearance', 'Görünüm')} delay="0.05s">
                    <div className="p-4 flex items-center justify-between hover:bg-[var(--surface-light)] transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-[var(--surface-color)] rounded-lg border border-[var(--border-color)]">
                                {theme === 'dark' ? <Moon className="w-5 h-5 text-[var(--text-primary)]" /> : <Sun className="w-5 h-5 text-[var(--text-primary)]" />}
                            </div>
                            <div>
                                <p className="font-bold text-sm text-[var(--text-primary)]">{t('settings.theme', 'Tema')}</p>
                                <p className="text-xs text-[var(--text-secondary)]">{theme === 'dark' ? t('settings.dark', 'Koyu') : t('settings.light', 'Açık')}</p>
                            </div>
                        </div>
                        <div className="flex bg-[var(--background)] p-1 rounded-xl border border-[var(--border-color)]">
                            <button
                                onClick={() => theme !== 'light' && toggleTheme()}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${theme === 'light' ? 'bg-[var(--surface-color)] text-[var(--accent-primary)] shadow-sm border border-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            >{t('settings.light', 'Açık')}</button>
                            <button
                                onClick={() => theme !== 'dark' && toggleTheme()}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${theme === 'dark' ? 'bg-[var(--surface-color)] text-[var(--accent-primary)] shadow-sm border border-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            >{t('settings.dark', 'Koyu')}</button>
                        </div>
                    </div>
                    <div className="p-4 flex items-center justify-between hover:bg-[var(--surface-light)] transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-[var(--surface-color)] rounded-lg border border-[var(--border-color)]">
                                <Globe className="w-5 h-5 text-[var(--text-primary)]" />
                            </div>
                            <div>
                                <p className="font-bold text-sm text-[var(--text-primary)]">{t('settings.language', 'Dil')}</p>
                                <p className="text-xs text-[var(--text-secondary)]">{isTr ? t('settings.turkish', 'Türkçe') : t('settings.english', 'İngilizce')}</p>
                            </div>
                        </div>
                        <div className="flex bg-[var(--background)] p-1 rounded-xl border border-[var(--border-color)]">
                            <button
                                onClick={() => changeLanguage('en')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${!isTr ? 'bg-[var(--surface-color)] text-[var(--accent-primary)] shadow-sm border border-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            >EN</button>
                            <button
                                onClick={() => changeLanguage('tr')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${isTr ? 'bg-[var(--surface-color)] text-[var(--accent-primary)] shadow-sm border border-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            >TR</button>
                        </div>
                    </div>
                </Section>

                {/* Notifications */}
                <Section icon={Bell} title={t('settings.notifications', 'Bildirimler')} delay="0.1s">
                    <ToggleRow
                        label={t('notifications.push', 'Anlık Bildirimler')}
                        subtitle={t('notifications.push_sub', 'Tüm bildirimleri aç veya kapat')}
                        value={notifPrefs.pushEnabled}
                        onChange={() => toggleNotif('pushEnabled')}
                    />
                    <ToggleRow label={t('notifications.new_follower', 'Yeni Takipçi')} value={notifPrefs.newFollower} onChange={() => toggleNotif('newFollower')} />
                    <ToggleRow label={t('notifications.post_like', 'Gönderi Beğenisi')} value={notifPrefs.postLike} onChange={() => toggleNotif('postLike')} />
                    <ToggleRow label={t('notifications.post_comment', 'Gönderi Yorumu')} value={notifPrefs.postComment} onChange={() => toggleNotif('postComment')} />
                    <ToggleRow label={t('notifications.new_message', 'Yeni Mesaj')} value={notifPrefs.newMessage} onChange={() => toggleNotif('newMessage')} />
                    <ToggleRow
                        label={t('notifications.workout_reminder', 'Antrenman Hatırlatıcısı')}
                        subtitle={t('notifications.reminder_sub', 'Günlük antrenman hatırlatması')}
                        value={notifPrefs.workoutReminder}
                        onChange={() => toggleNotif('workoutReminder')}
                    />
                    <ToggleRow
                        label={t('notifications.weekly_report', 'Haftalık Rapor')}
                        subtitle={t('notifications.weekly_sub', 'Her Pazartesi gönderilir')}
                        value={notifPrefs.weeklyReport}
                        onChange={() => toggleNotif('weeklyReport')}
                    />
                </Section>

                {/* Privacy */}
                <Section icon={Lock} title={t('settings.privacy', 'Gizlilik')} delay="0.15s">
                    <ToggleRow
                        label={t('privacy.public_profile', 'Genel Profil')}
                        subtitle={t('privacy.public_sub', 'Profiliniz herkes tarafından görülür')}
                        value={privacyPrefs.publicProfile}
                        onChange={() => togglePrivacy('publicProfile')}
                    />
                    <ToggleRow
                        label={t('privacy.show_in_search', 'Aramada Göster')}
                        value={privacyPrefs.showInSearch}
                        onChange={() => togglePrivacy('showInSearch')}
                    />
                    <ToggleRow
                        label={t('privacy.workouts_on_feed', 'Antrenmanları Akışta Göster')}
                        subtitle={t('privacy.feed_sub', 'Takipçileriniz antrenmanlarınızı görebilir')}
                        value={privacyPrefs.showWorkoutsOnFeed}
                        onChange={() => togglePrivacy('showWorkoutsOnFeed')}
                    />
                    <ToggleRow
                        label={t('privacy.allow_followers', 'Takipçilere İzin Ver')}
                        value={privacyPrefs.allowFollowers}
                        onChange={() => togglePrivacy('allowFollowers')}
                    />
                    <ToggleRow
                        label={t('privacy.allow_messages', 'Mesajlara İzin Ver')}
                        value={privacyPrefs.allowMessages}
                        onChange={() => togglePrivacy('allowMessages')}
                    />
                    <LinkRow label={t('privacy.privacy_policy', 'Gizlilik Politikası')} onClick={() => window.open('https://motionmeet.app/privacy', '_blank')} external />
                    <LinkRow label={t('privacy.terms', 'Kullanım Koşulları')} onClick={() => window.open('https://motionmeet.app/terms', '_blank')} external />
                    <LinkRow label={t('privacy.delete_account', 'Hesabı Sil')} onClick={handleDeleteAccount} danger />
                </Section>

                {/* Support */}
                <Section icon={HelpCircle} title={t('settings.support', 'Destek')} delay="0.2s">
                    <LinkRow
                        label={t('support.email', 'E-posta Desteği')}
                        subtitle="support@motionmeet.app"
                        onClick={() => window.open('mailto:support@motionmeet.app')}
                        external
                    />
                    <LinkRow
                        label={t('support.web', 'Web Sitesi')}
                        subtitle="motionmeet.app"
                        onClick={() => window.open('https://motionmeet.app', '_blank')}
                        external
                    />
                    <div className="divide-y divide-[var(--border-color)]">
                        {faqs.map((faq, i) => <FaqItem key={i} q={faq.q} a={faq.a} />)}
                    </div>
                </Section>

                {/* Danger / Sign Out */}
                <section className="animate-in pb-8" style={{ animationDelay: '0.25s' }}>
                    <div className="bg-[var(--surface-color)] rounded-2xl border border-red-500/20 overflow-hidden shadow-sm">
                        <button
                            onClick={signOut}
                            className="w-full p-4 flex items-center gap-3 hover:bg-red-500/5 transition-colors text-red-500"
                        >
                            <div className="p-2 bg-red-500/10 rounded-lg">
                                <LogOut className="w-5 h-5" />
                            </div>
                            <p className="font-bold text-sm">{t('settings.logout', 'Çıkış Yap')}</p>
                        </button>
                    </div>

                    <p className="text-center text-xs text-[var(--text-secondary)] mt-6">MotionMeet v1.0.0 · © 2026 MotionMeet Studios</p>
                </section>
            </div>
        </div>
    );
};

export default Settings;
