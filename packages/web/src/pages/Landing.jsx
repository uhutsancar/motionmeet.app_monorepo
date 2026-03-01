import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, BarChart3, Users, Zap, ArrowRight, Star } from 'lucide-react';
import PublicLayout from './PublicLayout';
import motionmeetLogo from '../assets/motionmeet_logo.svg';

/* ── Inline Stat Card ── */
const StatCard = ({ value, label }) => (
    <div className="flex flex-col items-center gap-1">
        <span className="text-3xl sm:text-4xl font-extrabold text-[var(--accent-primary)]">{value}</span>
        <span className="text-xs sm:text-sm text-[var(--text-muted)] font-medium uppercase tracking-wider">{label}</span>
    </div>
);

/* ── Mini Feature Card ── */
const MiniFeature = ({ icon: Icon, title, desc }) => (
    <div className="group relative flex flex-col gap-4 p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--accent-primary)] transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/5">
        <div className="w-12 h-12 rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)]">
            <Icon className="w-6 h-6" />
        </div>
        <div>
            <h3 className="font-bold text-[var(--text-primary)] mb-1.5">{title}</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{desc}</p>
        </div>
    </div>
);

/* ── Testimonial Card ── */
const TestimonialCard = ({ name, role, text }) => (
    <div className="p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col gap-4">
        <div className="flex gap-0.5 text-amber-400">
            {Array(5).fill(0).map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
        </div>
        <p className="text-[var(--text-secondary)] leading-relaxed text-sm flex-1">"{text}"</p>
        <div>
            <p className="font-bold text-sm text-[var(--text-primary)]">{name}</p>
            <p className="text-xs text-[var(--text-muted)]">{role}</p>
        </div>
    </div>
);

/* ── Phone Mockup ── */
const PhoneMockup = () => {
    const sets = [
        { name: 'Bench Press', set: 'Set 1', value: '80 kg × 8', done: true },
        { name: 'Bench Press', set: 'Set 2', value: '85 kg × 6', done: true },
        { name: 'Overhead Press', set: 'Set 1', value: '50 kg × 10', done: false },
        { name: 'Squat', set: 'Set 1', value: '100 kg × 5', done: false },
    ];
    return (
        <div className="relative mx-auto w-[260px] sm:w-[290px]">
            {/* Glow */}
            <div className="absolute inset-0 bg-blue-500 blur-[60px] opacity-20 rounded-full scale-90 -z-10" />
            {/* Phone frame */}
            <div className="relative w-full rounded-[36px] border-4 border-[#1a1a2e] bg-[#0d0d1a] shadow-2xl overflow-hidden">
                {/* Notch */}
                <div className="w-full h-7 bg-[#0d0d1a] flex justify-center items-start pt-1">
                    <div className="w-20 h-4 bg-[#1a1a2e] rounded-b-xl" />
                </div>
                {/* Screen content */}
                <div className="p-4 pb-6 space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-1">
                        <div>
                            <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-widest">Active Workout</p>
                            <p className="text-white font-bold text-sm">Push Day A</p>
                        </div>
                        <div className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full">Finish</div>
                    </div>
                    {/* Timer badge */}
                    <div className="bg-white/5 rounded-xl px-3 py-2 flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        <span className="text-green-400 text-xs font-mono font-bold">01:24:08</span>
                    </div>
                    {/* Sets */}
                    {sets.map((s, i) => (
                        <div key={i} className={`rounded-xl px-3 py-2.5 flex items-center justify-between ${s.done ? 'bg-green-500/15 border border-green-500/30' : 'bg-white/5 border border-white/10'}`}>
                            <div>
                                <p className={`text-[11px] font-bold ${s.done ? 'text-green-400' : 'text-white/70'}`}>{s.name}</p>
                                <p className={`text-[10px] ${s.done ? 'text-green-300/70' : 'text-white/40'}`}>{s.set}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-[11px] font-bold ${s.done ? 'text-green-300' : 'text-white/60'}`}>{s.value}</span>
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${s.done ? 'bg-green-500 border-green-500' : 'border-white/30'}`}>
                                    {s.done && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                </div>
                            </div>
                        </div>
                    ))}
                    {/* PR Badge */}
                    <div className="bg-amber-500/15 border border-amber-500/30 rounded-xl px-3 py-2 flex items-center gap-2">
                        <span className="text-amber-400 text-[10px] font-bold">🏆 NEW PERSONAL RECORD — Bench Press 85 kg</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Landing = () => {
    const { t } = useTranslation();

    const featureCards = [
        { icon: Zap, title: t('landing.feature1_title'), desc: t('landing.feature1_desc') },
        { icon: BarChart3, title: t('landing.feature2_title'), desc: t('landing.feature2_desc') },
        { icon: Users, title: t('landing.feature3_title'), desc: t('landing.feature3_desc') },
    ];

    const testimonials = [
        { name: t('landing.testimonial1_name'), role: t('landing.testimonial1_role'), text: t('landing.testimonial1_text') },
        { name: t('landing.testimonial2_name'), role: t('landing.testimonial2_role'), text: t('landing.testimonial2_text') },
        { name: t('landing.testimonial3_name'), role: t('landing.testimonial3_role'), text: t('landing.testimonial3_text') },
    ];

    const showcaseFeats = [
        t('landing.showcase_feat1'),
        t('landing.showcase_feat2'),
        t('landing.showcase_feat3'),
        t('landing.showcase_feat4'),
        t('landing.showcase_feat5'),
    ];

    return (
        <PublicLayout>
            {/* ── HERO ──────────────────────────────────────────── */}
            <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28 px-4 sm:px-6">
                {/* Background blobs */}
                <div className="pointer-events-none absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-indigo-600/10 blur-3xl" />

                <div className="relative max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-14 lg:gap-20">
                    {/* Left */}
                    <div className="flex-1 text-center lg:text-left space-y-7">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 text-[var(--accent-primary)] text-sm font-semibold">
                            {t('landing.hero_badge')}
                        </div>

                        {/* Headline */}
                        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight text-[var(--text-primary)]">
                            {t('landing.hero_headline')}<br />
                            <span className="text-[var(--accent-primary)]">{t('landing.hero_headline2')}</span>
                        </h1>

                        <p className="text-lg sm:text-xl text-[var(--text-secondary)] max-w-xl mx-auto lg:mx-0 leading-relaxed">
                            {t('landing.hero_sub')}
                        </p>

                        {/* CTAs */}
                        <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                            <Link
                                to="/login"
                                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-bold text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] transition-all shadow-lg shadow-blue-500/25 hover:scale-[1.02] active:scale-100"
                            >
                                {t('landing.hero_cta_primary')}
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                            <Link
                                to="/features"
                                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-bold text-[var(--text-primary)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--accent-primary)] transition-all hover:scale-[1.02] active:scale-100"
                            >
                                {t('landing.hero_cta_secondary')}
                            </Link>
                        </div>

                        {/* Trust */}
                        <div className="flex items-center justify-center lg:justify-start gap-3 pt-2">
                            <div className="flex -space-x-2">
                                {['bg-blue-400', 'bg-violet-400', 'bg-pink-400', 'bg-amber-400'].map((c, i) => (
                                    <div key={i} className={`w-8 h-8 rounded-full ${c} border-2 border-[var(--bg-base)] flex items-center justify-center text-[10px] font-bold text-white`}>
                                        {['A', 'S', 'M', 'J'][i]}
                                    </div>
                                ))}
                            </div>
                            <div>
                                <div className="flex items-center gap-1 text-amber-400 text-sm">
                                    {Array(5).fill(0).map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}
                                    <span className="ml-1 text-xs text-[var(--text-muted)] font-medium">4.9</span>
                                </div>
                                <p className="text-xs text-[var(--text-muted)]">{t('landing.hero_trust')}</p>
                            </div>
                        </div>
                    </div>

                    {/* Right – Phone Mockup */}
                    <div className="flex-shrink-0 w-full max-w-xs lg:max-w-sm">
                        <PhoneMockup />
                    </div>
                </div>
            </section>

            {/* ── STATS BAR ─────────────────────────────────────── */}
            <section className="border-y border-[var(--border-subtle)] py-10 bg-[var(--bg-surface)]">
                <div className="max-w-3xl mx-auto px-6 grid grid-cols-3 gap-6 divide-x divide-[var(--border-subtle)]">
                    <StatCard value="50k+" label={t('landing.stat_users')} />
                    <StatCard value="1M+" label={t('landing.stat_workouts')} />
                    <StatCard value="4.9★" label={t('landing.stat_rating')} />
                </div>
            </section>

            {/* ── MINI FEATURES ─────────────────────────────────── */}
            <section className="py-20 sm:py-24 px-4 sm:px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                        {featureCards.map((f, i) => <MiniFeature key={i} {...f} />)}
                    </div>
                </div>
            </section>

            {/* ── APP SHOWCASE ──────────────────────────────────── */}
            <section className="py-20 sm:py-24 px-4 sm:px-6 bg-[var(--bg-surface)]">
                <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
                    {/* Left: visual */}
                    <div className="flex-1 relative">
                        <div className="absolute inset-0 bg-[var(--accent-primary)]/5 rounded-3xl -rotate-1 scale-105" />
                        <div className="relative bg-[var(--bg-surface-light)] rounded-3xl p-8 sm:p-10">
                            {/* Fake progress chart */}
                            <div className="mb-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="text-xs font-bold text-[var(--accent-primary)] uppercase tracking-widest px-2 py-1 rounded-md bg-[var(--accent-primary)]/10">
                                        {t('landing.showcase_badge')}
                                    </span>
                                </div>
                                {/* Chart bars */}
                                <div className="flex items-end gap-2 h-32 mb-3">
                                    {[40, 55, 42, 70, 62, 85, 78].map((h, i) => (
                                        <div key={i} className="flex-1 relative rounded-t-md" style={{ height: `${h}%` }}>
                                            <div className="absolute inset-0 rounded-t-md bg-gradient-to-t from-blue-600 to-blue-400 opacity-80" />
                                            {i === 5 && (
                                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-amber-400 text-[9px] font-bold text-white px-1.5 py-0.5 rounded whitespace-nowrap">
                                                    PR!
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                                        <span key={d}>{d}</span>
                                    ))}
                                </div>
                            </div>
                            {/* Stat tiles */}
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: 'Total Volume', value: '23,500 kg', color: 'text-blue-500' },
                                    { label: 'Calories Burned', value: '18,400 kcal', color: 'text-green-500' },
                                ].map(({ label, value, color }) => (
                                    <div key={label} className="bg-[var(--bg-surface)] rounded-xl p-3 border border-[var(--border-subtle)]">
                                        <p className="text-xs text-[var(--text-muted)]">{label}</p>
                                        <p className={`text-base font-extrabold ${color}`}>{value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: text */}
                    <div className="flex-1 space-y-6">
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[var(--text-primary)] leading-tight">
                            {t('landing.showcase_title')}
                        </h2>
                        <ul className="space-y-3">
                            {showcaseFeats.map((f, i) => (
                                <li key={i} className="flex items-center gap-3 text-[var(--text-secondary)]">
                                    <CheckCircle2 className="w-5 h-5 text-[var(--accent-primary)] flex-shrink-0" />
                                    <span className="font-medium">{f}</span>
                                </li>
                            ))}
                        </ul>
                        <Link
                            to="/features"
                            className="inline-flex items-center gap-2 text-sm font-bold text-[var(--accent-primary)] hover:gap-3 transition-all"
                        >
                            {t('landing.hero_cta_secondary')} <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── TESTIMONIALS ──────────────────────────────────── */}
            <section className="py-20 sm:py-24 px-4 sm:px-6">
                <div className="max-w-7xl mx-auto">
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-center text-[var(--text-primary)] mb-12">
                        {t('landing.testimonial_title')}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {testimonials.map((t, i) => <TestimonialCard key={i} {...t} />)}
                    </div>
                </div>
            </section>

            {/* ── CTA BANNER ────────────────────────────────────── */}
            <section className="px-4 sm:px-6 pb-20 sm:pb-24">
                <div className="max-w-4xl mx-auto rounded-3xl bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 p-10 sm:p-14 text-center relative overflow-hidden">
                    {/* Decorative circles */}
                    <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
                    <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
                    <div className="relative">
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
                            {t('landing.cta_title')}
                        </h2>
                        <p className="text-blue-100 text-lg mb-8 max-w-xl mx-auto">
                            {t('landing.cta_sub')}
                        </p>
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-blue-600 bg-white hover:bg-blue-50 transition-all shadow-xl hover:scale-[1.02] active:scale-100"
                        >
                            {t('landing.cta_btn')} <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
};

export default Landing;
