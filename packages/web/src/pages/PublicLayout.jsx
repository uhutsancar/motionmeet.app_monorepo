import React, { useState, useContext, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ThemeContext } from '../context/ThemeContext';
import { Sun, Moon, Globe, Menu, X, Dumbbell } from 'lucide-react';
import motionmeetLogo from '../assets/motionmeet_logo.svg';

/* ─── Navbar ─── */
const PublicNavbar = () => {
    const { t, i18n } = useTranslation();
    const { theme, toggleTheme } = useContext(ThemeContext);
    const [menuOpen, setMenuOpen] = useState(false);
    const location = useLocation();

    // Close mobile menu on route change
    useEffect(() => { setMenuOpen(false); }, [location]);

    const toggleLang = () => {
        const next = i18n.language.startsWith('tr') ? 'en' : 'tr';
        i18n.changeLanguage(next);
        localStorage.setItem('appLanguage', next);
    };

    const navLinks = [
        { to: '/features', label: t('nav.features') },
        { to: '/pricing', label: t('nav.pricing') },
        { to: '/about', label: t('nav.about') },
    ];

    const activeCls = 'text-[var(--accent-primary)] font-semibold';
    const linkCls = 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-200';

    return (
        <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-[var(--glass-bg)] border-b border-[var(--border-subtle)]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

                {/* Logo */}
                <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
                    <img src={motionmeetLogo} alt="MotionMeet" className="h-8 w-auto" />
                    <span className="font-bold text-lg text-[var(--text-primary)] hidden sm:block tracking-tight">
                        MotionMeet
                    </span>
                </Link>

                {/* Desktop Nav */}
                <nav className="hidden md:flex items-center gap-8">
                    {navLinks.map(({ to, label }) => (
                        <NavLink
                            key={to}
                            to={to}
                            className={({ isActive }) =>
                                `text-sm font-medium ${isActive ? activeCls : linkCls}`
                            }
                        >
                            {label}
                        </NavLink>
                    ))}
                </nav>

                {/* Desktop Actions */}
                <div className="hidden md:flex items-center gap-3">
                    {/* Lang */}
                    <button
                        onClick={toggleLang}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-light)] transition-all"
                        title={i18n.language.startsWith('tr') ? 'Switch to EN' : 'TR\'ye geç'}
                    >
                        <Globe className="w-4 h-4" />
                        {i18n.language.startsWith('tr') ? 'TR' : 'EN'}
                    </button>

                    {/* Theme */}
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-light)] transition-all"
                        title={theme === 'dark' ? t('nav.mode_light') : t('nav.mode_dark')}
                    >
                        {theme === 'dark'
                            ? <Sun className="w-4 h-4" />
                            : <Moon className="w-4 h-4" />
                        }
                    </button>

                    <div className="h-5 w-px bg-[var(--border-subtle)]" />

                    <Link
                        to="/login"
                        className="text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                        {t('nav.login')}
                    </Link>
                    <Link
                        to="/login"
                        className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
                    >
                        {t('nav.signup')}
                    </Link>
                </div>

                {/* Mobile Hamburger */}
                <div className="flex md:hidden items-center gap-2">
                    <button
                        onClick={toggleLang}
                        className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface-light)] transition font-bold text-xs"
                    >
                        {i18n.language.startsWith('tr') ? 'TR' : 'EN'}
                    </button>
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface-light)] transition"
                    >
                        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={() => setMenuOpen(v => !v)}
                        className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface-light)] transition"
                    >
                        {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu Drawer */}
            {menuOpen && (
                <div className="md:hidden border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-4 flex flex-col gap-3">
                    {navLinks.map(({ to, label }) => (
                        <NavLink
                            key={to}
                            to={to}
                            className={({ isActive }) =>
                                `py-2 text-base font-medium ${isActive ? activeCls : 'text-[var(--text-secondary)]'}`
                            }
                        >
                            {label}
                        </NavLink>
                    ))}
                    <div className="h-px bg-[var(--border-subtle)] my-1" />
                    <Link to="/login" className="py-2 text-base font-semibold text-[var(--text-secondary)]">
                        {t('nav.login')}
                    </Link>
                    <Link
                        to="/login"
                        className="py-2.5 text-center rounded-xl font-bold text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] transition"
                    >
                        {t('nav.signup')}
                    </Link>
                </div>
            )}
        </header>
    );
};

/* ─── Footer ─── */
const PublicFooter = () => {
    const { t } = useTranslation();

    const cols = [
        {
            label: t('footer.product'),
            links: [
                { label: t('footer.features'), to: '/features' },
                { label: t('footer.pricing'), to: '/pricing' },
                { label: t('footer.reviews'), to: '#' },
                { label: t('footer.help'), to: '#' },
            ],
        },
        {
            label: t('footer.company'),
            links: [
                { label: t('footer.about'), to: '/about' },
                { label: t('footer.contact'), to: '#' },
                { label: t('footer.careers'), to: '#' },
            ],
        },
        {
            label: t('footer.resources'),
            links: [
                { label: t('footer.blog'), to: '#' },
                { label: t('footer.guides'), to: '#' },
                { label: t('footer.exercise_lib'), to: '#' },
            ],
        },
    ];

    return (
        <footer className="bg-[var(--bg-surface)] border-t border-[var(--border-subtle)]">
            <div className="max-w-7xl mx-auto px-6 pt-16 pb-10">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">
                    {/* Brand col */}
                    <div className="col-span-2 space-y-4">
                        <div className="flex items-center gap-2">
                            <img src={motionmeetLogo} alt="MotionMeet" className="h-8 w-auto" />
                            <span className="font-bold text-lg text-[var(--text-primary)] tracking-tight">MotionMeet</span>
                        </div>
                        <p className="text-sm text-[var(--text-muted)] max-w-xs leading-relaxed">
                            {t('footer.tagline')}
                        </p>
                        {/* Socials */}
                        <div className="flex gap-3">
                            {[
                                /* Instagram */
                                <svg key="ig" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" /></svg>,
                                /* Twitter/X */
                                <svg key="tw" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" /></svg>,
                            ].map((icon, i) => (
                                <a
                                    key={i}
                                    href="#"
                                    className="w-9 h-9 rounded-full border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-all"
                                >
                                    {icon}
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Link columns */}
                    {cols.map(col => (
                        <div key={col.label} className="flex flex-col gap-3">
                            <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                                {col.label}
                            </span>
                            {col.links.map(({ label, to }) => (
                                <Link
                                    key={label}
                                    to={to}
                                    className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                >
                                    {label}
                                </Link>
                            ))}
                        </div>
                    ))}
                </div>

                <div className="pt-8 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
                        <a href="#" className="hover:text-[var(--text-primary)] transition-colors">{t('footer.terms')}</a>
                        <a href="#" className="hover:text-[var(--text-primary)] transition-colors">{t('footer.privacy')}</a>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] text-center">{t('footer.copyright')}</p>
                </div>
            </div>
        </footer>
    );
};

/* ─── PublicLayout ─── */
const PublicLayout = ({ children, noFooter = false }) => {
    return (
        <div className="min-h-screen flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)]">
            <PublicNavbar />
            <main className="flex-1 pt-16">
                {children}
            </main>
            {!noFooter && <PublicFooter />}
        </div>
    );
};

export default PublicLayout;
