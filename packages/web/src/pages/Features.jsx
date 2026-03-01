import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Dumbbell, TrendingUp, ListChecks, MessageSquare, BookOpen, BarChart2, ArrowRight } from 'lucide-react';
import PublicLayout from './PublicLayout';

/* ── Icon map ── */
const ICONS = [Dumbbell, TrendingUp, ListChecks, MessageSquare, BookOpen, BarChart2];
const COLORS = [
    'text-blue-500 bg-blue-500/10',
    'text-green-500 bg-green-500/10',
    'text-violet-500 bg-violet-500/10',
    'text-pink-500 bg-pink-500/10',
    'text-amber-500 bg-amber-500/10',
    'text-cyan-500 bg-cyan-500/10',
];

/* ── Feature Row (alternating) ── */
const FeatureRow = ({ features, index }) => {
    const { t } = useTranslation();
    const isReversed = index % 2 === 1;
    const Icon = ICONS[index];
    const colorCls = COLORS[index];
    const bullets = [
        t(`features_page.f${index + 1}_b1`),
        t(`features_page.f${index + 1}_b2`),
        t(`features_page.f${index + 1}_b3`),
        t(`features_page.f${index + 1}_b4`),
    ];

    /* Pretty "mock UI" panels for each feature */
    const fakeUIs = [
        /* 1 – Workout Logging */
        <div className="space-y-3 p-2">
            {[{ ex: 'Bench Press', done: true, val: '80 kg × 8' }, { ex: 'Squat', done: true, val: '100 kg × 5' }, { ex: 'Deadlift', done: false, val: '120 kg × 3' }].map((r, i) => (
                <div key={i} className={`rounded-xl px-4 py-3 flex items-center justify-between border ${r.done ? 'bg-green-500/10 border-green-500/20' : 'bg-[var(--bg-surface-light)] border-[var(--border-subtle)]'}`}>
                    <div>
                        <p className={`font-bold text-sm ${r.done ? 'text-green-400' : 'text-[var(--text-primary)]'}`}>{r.ex}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">Set {i + 1}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${r.done ? 'text-green-400' : 'text-[var(--text-secondary)]'}`}>{r.val}</span>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${r.done ? 'bg-green-500 border-green-500' : 'border-[var(--border-subtle)]'}`}>
                            {r.done && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                    </div>
                </div>
            ))}
            <div className="rounded-xl px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
                <span className="text-amber-400 text-[11px] font-bold">🏆 New PR — Bench Press 80 kg!</span>
            </div>
        </div>,
        /* 2 – Progress Tracking */
        <div className="p-2 space-y-3">
            <div className="flex items-end gap-1.5 h-24">
                {[40, 55, 50, 72, 65, 90, 85].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t-sm relative overflow-visible">
                        <div className="w-full rounded-t-sm bg-gradient-to-t from-blue-600 to-blue-400" style={{ height: `${h}%` }} />
                        {i === 5 && <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-amber-400 text-[9px] font-bold text-white px-1 py-0.5 rounded whitespace-nowrap">PR!</div>}
                    </div>
                ))}
            </div>
            <div className="flex justify-between text-[9px] text-[var(--text-muted)]">
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'].map(m => <span key={m}>{m}</span>)}
            </div>
            <div className="grid grid-cols-2 gap-2">
                {[{ l: 'Total Volume', v: '23,500 kg', c: 'text-blue-500' }, { l: 'Personal Record', v: '90 kg', c: 'text-amber-500' }].map(({ l, v, c }) => (
                    <div key={l} className="rounded-xl p-3 bg-[var(--bg-surface-light)] border border-[var(--border-subtle)]">
                        <p className="text-[10px] text-[var(--text-muted)]">{l}</p>
                        <p className={`font-extrabold text-sm ${c}`}>{v}</p>
                    </div>
                ))}
            </div>
        </div>,
        /* 3 – Routine Builder */
        <div className="p-2 space-y-2">
            {['Push Day A', 'Pull Day B', 'Leg Day C'].map((r, i) => (
                <div key={i} className="rounded-xl px-4 py-3 flex items-center gap-3 bg-[var(--bg-surface-light)] border border-[var(--border-subtle)]">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white ${['bg-blue-500', 'bg-violet-500', 'bg-green-500'][i]}`}>
                        {['P', 'P', 'L'][i]}
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-sm text-[var(--text-primary)]">{r}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">{[5, 4, 5][i]} exercises</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
                </div>
            ))}
            <button className="w-full rounded-xl py-2.5 text-sm font-bold text-[var(--accent-primary)] border-2 border-dashed border-[var(--accent-primary)]/30 hover:border-[var(--accent-primary)] transition">
                + Add Routine
            </button>
        </div>,
        /* 4 – Social Feed */
        <div className="p-2 space-y-3">
            {[{ name: 'Alex M.', workout: 'Push Day A', time: '1h 20m', vol: '12,400 kg', pr: true }, { name: 'Sara K.', workout: 'Leg Day', time: '55m', vol: '8,200 kg', pr: false }].map((p, i) => (
                <div key={i} className="rounded-xl p-3.5 bg-[var(--bg-surface-light)] border border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2.5 mb-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${['bg-blue-500', 'bg-pink-500'][i]}`}>{p.name[0]}</div>
                        <div>
                            <p className="font-bold text-sm text-[var(--text-primary)]">{p.name}</p>
                            {p.pr && <span className="text-[10px] font-bold text-amber-400">🏆 PR Crushed!</span>}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <span className="px-2 py-1 rounded-md bg-[var(--bg-surface)] text-[10px] font-bold text-[var(--text-muted)]">{p.workout}</span>
                        <span className="px-2 py-1 rounded-md bg-[var(--bg-surface)] text-[10px] font-bold text-[var(--text-muted)]">⏱ {p.time}</span>
                        <span className="px-2 py-1 rounded-md bg-[var(--bg-surface)] text-[10px] font-bold text-[var(--text-muted)]]">💪 {p.vol}</span>
                    </div>
                </div>
            ))}
        </div>,
        /* 5 – Exercise Library */
        <div className="p-2 space-y-2">
            <div className="flex gap-2 mb-3">
                {['All', 'Chest', 'Back', 'Legs'].map((f, i) => (
                    <button key={f} className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition ${i === 1 ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-surface-light)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'}`}>{f}</button>
                ))}
            </div>
            {[{ name: 'Bench Press', muscle: 'Chest', eq: 'Barbell' }, { name: 'Incline DB Press', muscle: 'Chest', eq: 'Dumbbell' }, { name: 'Cable Fly', muscle: 'Chest', eq: 'Cable' }].map((e, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-3 bg-[var(--bg-surface-light)] border border-[var(--border-subtle)]">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-500">
                        <Dumbbell className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-sm text-[var(--text-primary)]">{e.name}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">{e.muscle} · {e.eq}</p>
                    </div>
                </div>
            ))}
        </div>,
        /* 6 – Insights */
        <div className="p-2 space-y-3">
            <div className="grid grid-cols-2 gap-2">
                {[{ l: 'Weekly Workouts', v: '5', c: 'text-blue-500' }, { l: 'Avg Duration', v: '62 min', c: 'text-green-500' }, { l: 'Total Volume', v: '84,200 kg', c: 'text-violet-500' }, { l: 'Calories', v: '12,400 kcal', c: 'text-amber-500' }].map(({ l, v, c }) => (
                    <div key={l} className="rounded-xl p-3 bg-[var(--bg-surface-light)] border border-[var(--border-subtle)]">
                        <p className="text-[10px] text-[var(--text-muted)] mb-0.5">{l}</p>
                        <p className={`font-extrabold text-base ${c}`}>{v}</p>
                    </div>
                ))}
            </div>
            {/* Heatmap */}
            <div className="rounded-xl p-3 bg-[var(--bg-surface-light)] border border-[var(--border-subtle)]">
                <p className="text-[11px] font-bold text-[var(--text-muted)] mb-2">Weekly Activity</p>
                <div className="flex gap-1">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
                        <div key={d} className="flex-1 text-center">
                            <div className={`w-full aspect-square rounded-sm mb-1 ${[true, true, false, true, true, false, false][i] ? 'bg-blue-500' : 'bg-[var(--border-subtle)]'}`} />
                            <span className="text-[9px] text-[var(--text-muted)]">{d[0]}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>,
    ];

    const textContent = (
        <div className="flex-1 space-y-6">
            <div className={`inline-flex p-3 rounded-2xl ${colorCls}`}>
                <Icon className="w-7 h-7" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)] leading-tight">
                {t(`features_page.f${index + 1}_title`)}
            </h2>
            <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
                {t(`features_page.f${index + 1}_desc`)}
            </p>
            <ul className="space-y-3">
                {bullets.map((b, i) => (
                    <li key={i} className="flex items-center gap-3 text-[var(--text-secondary)]">
                        <CheckCircle2 className="w-5 h-5 text-[var(--accent-primary)] flex-shrink-0" />
                        <span className="font-medium">{b}</span>
                    </li>
                ))}
            </ul>
        </div>
    );

    const visualContent = (
        <div className="flex-1">
            <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xl shadow-black/5">
                {fakeUIs[index] || <div className="h-64 rounded-2xl bg-[var(--bg-surface-light)]" />}
            </div>
        </div>
    );

    return (
        <div className={`flex flex-col ${isReversed ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-12 lg:gap-16`}>
            {textContent}
            {visualContent}
        </div>
    );
};

/* ── Page ── */
const Features = () => {
    const { t } = useTranslation();

    return (
        <PublicLayout>
            {/* Hero */}
            <section className="relative overflow-hidden py-20 sm:py-28 px-4 sm:px-6 text-center">
                <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-blue-600/10 blur-3xl" />
                <div className="relative max-w-3xl mx-auto space-y-5">
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20">
                        {t('features_page.hero_badge')}
                    </span>
                    <h1 className="text-4xl sm:text-6xl font-extrabold text-[var(--text-primary)] leading-tight">
                        {t('features_page.hero_title')}
                    </h1>
                    <p className="text-lg sm:text-xl text-[var(--text-secondary)] leading-relaxed max-w-2xl mx-auto">
                        {t('features_page.hero_sub')}
                    </p>
                    <div className="pt-4">
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] transition shadow-lg shadow-blue-500/25"
                        >
                            {t('features_page.cta_btn')} <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Feature rows */}
            <section className="py-8 sm:py-12 px-4 sm:px-6">
                <div className="max-w-6xl mx-auto space-y-24 sm:space-y-32">
                    {[0, 1, 2, 3, 4, 5].map(i => (
                        <FeatureRow key={i} index={i} />
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="px-4 sm:px-6 py-20 sm:py-24">
                <div className="max-w-3xl mx-auto text-center rounded-3xl bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 p-12 text-white relative overflow-hidden">
                    <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-xl" />
                    <div className="relative">
                        <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">{t('features_page.cta_title')}</h2>
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-blue-600 bg-white hover:bg-blue-50 transition shadow-xl"
                        >
                            {t('features_page.cta_btn')} <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
};

export default Features;
