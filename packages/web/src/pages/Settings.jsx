import React, { useContext } from "react";
import { useTranslation } from "react-i18next";
import { ThemeContext } from "../context/ThemeContext";
import { Moon, Sun, Globe, Monitor, LogOut } from "lucide-react";
import { useClerk } from "@clerk/clerk-react";

const Settings = () => {
    const { t, i18n } = useTranslation();
    const { theme, toggleTheme } = useContext(ThemeContext);
    const { signOut } = useClerk();

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
        localStorage.setItem('appLanguage', lng);
    };

    const isTr = i18n.language.startsWith('tr');

    return (
        <div className="w-full h-full min-h-screen pt-4 sm:pt-6 pb-20 sm:pb-0 text-text-primary bg-background overflow-y-auto no-scrollbar">
            <div className="max-w-3xl mx-auto px-4 sm:px-8">
                <h1 className="text-3xl font-bold mb-8">{t('settings.title')}</h1>

                <div className="space-y-6">
                    {/* Appearance Section */}
                    <section className="animate-in" style={{ animationDelay: '0.05s' }}>
                        <div className="flex items-center gap-2 mb-4">
                            <Monitor className="w-5 h-5 text-accent-primary" />
                            <h2 className="text-lg font-bold">{t('settings.appearance')}</h2>
                        </div>
                        <div className="glass rounded-2xl border border-border-subtle overflow-hidden shadow-sm">
                            <div className="p-4 flex items-center justify-between hover:bg-surface-light transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-surface rounded-lg border border-border-subtle group-hover:bg-background transition-colors">
                                        {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm tracking-tight">{t('settings.theme')}</p>
                                        <p className="text-xs text-text-muted">{theme === 'dark' ? t('settings.dark') : t('settings.light')}</p>
                                    </div>
                                </div>
                                <div className="flex bg-background p-1 rounded-xl border border-border-subtle">
                                    <button
                                        onClick={() => theme !== 'light' && toggleTheme()}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${theme === 'light' ? 'bg-surface text-accent-primary shadow-sm border border-border-subtle' : 'text-text-muted hover:text-text-primary'}`}
                                    >
                                        {t('settings.light')}
                                    </button>
                                    <button
                                        onClick={() => theme !== 'dark' && toggleTheme()}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${theme === 'dark' ? 'bg-surface text-accent-primary shadow-sm border border-border-subtle' : 'text-text-muted hover:text-text-primary'}`}
                                    >
                                        {t('settings.dark')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Language Section */}
                    <section className="animate-in" style={{ animationDelay: '0.1s' }}>
                        <div className="flex items-center gap-2 mb-4">
                            <Globe className="w-5 h-5 text-accent-primary" />
                            <h2 className="text-lg font-bold">{t('settings.language')}</h2>
                        </div>
                        <div className="glass rounded-2xl border border-border-subtle overflow-hidden shadow-sm">
                            <div className="p-4 flex items-center justify-between hover:bg-surface-light transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-surface rounded-lg border border-border-subtle group-hover:bg-background transition-colors">
                                        <Globe className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm tracking-tight">{t('settings.language')}</p>
                                        <p className="text-xs text-text-muted">{isTr ? t('settings.turkish') : t('settings.english')}</p>
                                    </div>
                                </div>
                                <div className="flex bg-background p-1 rounded-xl border border-border-subtle">
                                    <button
                                        onClick={() => changeLanguage('en')}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${!isTr ? 'bg-surface text-accent-primary shadow-sm border border-border-subtle' : 'text-text-muted hover:text-text-primary'}`}
                                    >
                                        EN
                                    </button>
                                    <button
                                        onClick={() => changeLanguage('tr')}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${isTr ? 'bg-surface text-accent-primary shadow-sm border border-border-subtle' : 'text-text-muted hover:text-text-primary'}`}
                                    >
                                        TR
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Danger Zone */}
                    <section className="animate-in pt-4" style={{ animationDelay: '0.15s' }}>
                        <div className="glass rounded-2xl border border-red-500/20 overflow-hidden shadow-sm">
                            <button
                                onClick={signOut}
                                className="w-full p-4 flex items-center gap-3 hover:bg-red-500/5 transition-colors text-red-500"
                            >
                                <div className="p-2 bg-red-500/10 rounded-lg">
                                    <LogOut className="w-5 h-5" />
                                </div>
                                <p className="font-bold text-sm tracking-tight">{t('settings.logout')}</p>
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default Settings;
