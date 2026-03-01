import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Zap, Shield, Heart } from 'lucide-react';
import PublicLayout from './PublicLayout';
import motionmeetLogo from '../assets/motionmeet_logo.svg';

/* ── Value Card ── */
const ValueCard = ({ icon: Icon, title, desc, color }) => (
    <div className="p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col gap-4 hover:border-[var(--accent-primary)] transition-colors">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-6 h-6" />
        </div>
        <div>
            <h3 className="font-bold text-[var(--text-primary)] mb-1">{title}</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{desc}</p>
        </div>
    </div>
);

/* ── Team Card ── */
const TeamCard = ({ name, role, bio, initials, color }) => (
    <div className="p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col items-center text-center gap-4">
        <div className={`w-20 h-20 rounded-2xl ${color} flex items-center justify-center text-2xl font-extrabold text-white shadow-lg`}>
            {initials}
        </div>
        <div>
            <h3 className="font-extrabold text-[var(--text-primary)]">{name}</h3>
            <p className="text-sm font-semibold text-[var(--accent-primary)] mt-0.5">{role}</p>
            <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">{bio}</p>
        </div>
    </div>
);

const About = () => {
    const { t } = useTranslation();

    const values = [
        {
            icon: Zap,
            title: t('about_page.val1_title'),
            desc: t('about_page.val1_desc'),
            color: 'bg-amber-500/10 text-amber-500',
        },
        {
            icon: Shield,
            title: t('about_page.val2_title'),
            desc: t('about_page.val2_desc'),
            color: 'bg-blue-500/10 text-blue-500',
        },
        {
            icon: Heart,
            title: t('about_page.val3_title'),
            desc: t('about_page.val3_desc'),
            color: 'bg-pink-500/10 text-pink-500',
        },
    ];

    const team = [
        {
            name: t('about_page.team1_name'),
            role: t('about_page.team1_role'),
            bio: t('about_page.team1_bio'),
            initials: 'AC',
            color: 'bg-gradient-to-br from-blue-500 to-blue-700',
        },
        {
            name: t('about_page.team2_name'),
            role: t('about_page.team2_role'),
            bio: t('about_page.team2_bio'),
            initials: 'SJ',
            color: 'bg-gradient-to-br from-violet-500 to-violet-700',
        },
        {
            name: t('about_page.team3_name'),
            role: t('about_page.team3_role'),
            bio: t('about_page.team3_bio'),
            initials: 'MJ',
            color: 'bg-gradient-to-br from-emerald-500 to-emerald-700',
        },
    ];

    const stats = [
        { val: t('about_page.stats_users') },
        { val: t('about_page.stats_workouts') },
        { val: t('about_page.stats_rating') },
    ];

    return (
        <PublicLayout>
            {/* ── Hero ── */}
            <section className="relative overflow-hidden py-20 sm:py-28 px-4 sm:px-6 text-center">
                <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-emerald-600/10 blur-3xl" />
                <div className="relative max-w-3xl mx-auto space-y-6">
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20">
                        {t('about_page.hero_badge')}
                    </span>
                    <h1 className="text-4xl sm:text-6xl font-extrabold text-[var(--text-primary)] leading-tight">
                        {t('about_page.hero_title')}
                    </h1>
                    <p className="text-lg sm:text-xl text-[var(--text-secondary)] leading-relaxed max-w-2xl mx-auto">
                        {t('about_page.hero_sub')}
                    </p>
                    {/* Stats */}
                    <div className="flex flex-wrap justify-center gap-6 pt-4">
                        {stats.map(({ val }, i) => (
                            <div key={i} className="px-6 py-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-extrabold text-[var(--accent-primary)] text-lg">
                                {val}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Our Story ── */}
            <section className="py-16 sm:py-20 px-4 sm:px-6 bg-[var(--bg-surface)]">
                <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-14">
                    {/* Visual */}
                    <div className="flex-1 relative">
                        <div className="absolute inset-0 bg-[var(--accent-primary)]/5 rounded-3xl rotate-1 scale-105" />
                        <div className="relative bg-[var(--bg-base)] rounded-3xl p-8 space-y-5 border border-[var(--border-subtle)]">
                            {/* Logo + brand */}
                            <div className="flex items-center gap-3 mb-2">
                                <img src={motionmeetLogo} alt="MotionMeet" className="h-10 w-auto" />
                                <span className="font-extrabold text-2xl text-[var(--text-primary)]">MotionMeet</span>
                            </div>
                            {/* Quote */}
                            <blockquote className="border-l-4 border-[var(--accent-primary)] pl-5 py-1">
                                <p className="text-lg font-semibold italic text-[var(--text-secondary)] leading-relaxed">
                                    "{t('about_page.story_quote')}"
                                </p>
                            </blockquote>
                            {/* Timeline dots */}
                            <div className="space-y-4 pt-2">
                                {[
                                    { year: '2023', label: 'MotionMeet founded' },
                                    { year: '2024', label: '10k active users' },
                                    { year: '2025', label: '50k+ athletes worldwide' },
                                    { year: '2026', label: '1M+ workouts logged' },
                                ].map(({ year, label }) => (
                                    <div key={year} className="flex items-center gap-4">
                                        <div className="w-14 text-xs font-extrabold text-[var(--accent-primary)]">{year}</div>
                                        <div className="w-2 h-2 rounded-full bg-[var(--accent-primary)] flex-shrink-0" />
                                        <div className="text-sm text-[var(--text-secondary)]">{label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    {/* Text */}
                    <div className="flex-1 space-y-6">
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)]">
                            {t('about_page.story_title')}
                        </h2>
                        <p className="text-[var(--text-secondary)] leading-relaxed">{t('about_page.story_p1')}</p>
                        <p className="text-[var(--text-secondary)] leading-relaxed">{t('about_page.story_p2')}</p>
                        <p className="text-[var(--text-secondary)] leading-relaxed">{t('about_page.story_p3')}</p>
                    </div>
                </div>
            </section>

            {/* ── Team ── */}
            <section className="py-16 sm:py-20 px-4 sm:px-6">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-center text-[var(--text-primary)] mb-12">
                        {t('about_page.team_title')}
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        {team.map((m, i) => <TeamCard key={i} {...m} />)}
                    </div>
                </div>
            </section>

            {/* ── Values ── */}
            <section className="py-16 sm:py-20 px-4 sm:px-6 bg-[var(--bg-surface)]">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-center text-[var(--text-primary)] mb-12">
                        {t('about_page.values_title')}
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        {values.map((v, i) => <ValueCard key={i} {...v} />)}
                    </div>
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="px-4 sm:px-6 py-16 sm:py-20">
                <div className="max-w-3xl mx-auto text-center rounded-3xl bg-gradient-to-br from-emerald-600 via-blue-600 to-indigo-600 p-12 text-white relative overflow-hidden">
                    <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-xl" />
                    <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/10 blur-xl" />
                    <div className="relative space-y-5">
                        <h2 className="text-3xl sm:text-4xl font-extrabold">{t('about_page.cta_title')}</h2>
                        <p className="text-blue-100 text-lg max-w-md mx-auto">{t('about_page.cta_sub')}</p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Link
                                to="/login"
                                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-blue-700 bg-white hover:bg-blue-50 transition shadow-xl"
                            >
                                {t('about_page.cta_btn')} <ArrowRight className="w-4 h-4" />
                            </Link>
                            <a
                                href="mailto:support@motionmeet.app"
                                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-white border-2 border-white/30 hover:border-white hover:bg-white/10 transition"
                            >
                                {t('about_page.cta_btn2')}
                            </a>
                        </div>
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
};

export default About;
