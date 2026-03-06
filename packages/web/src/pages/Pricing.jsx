import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, X, ArrowRight, ChevronDown, ChevronUp, Zap, Loader2 } from 'lucide-react';
import PublicLayout from './PublicLayout';
import api from '~/api/axios.js';
import { useAuth } from '@clerk/clerk-react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchUser } from '../features/user/userSlice';
import toast from 'react-hot-toast';

/* ── FAQ Item ── */
const FAQItem = ({ q, a }) => {
    const [open, setOpen] = useState(false);
    return (
        <div
            className="border border-[var(--border-subtle)] rounded-2xl overflow-hidden cursor-pointer"
            onClick={() => setOpen(v => !v)}
        >
            <div className="flex items-center justify-between px-6 py-4 bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-light)] transition">
                <span className="font-semibold text-[var(--text-primary)]">{q}</span>
                {open
                    ? <ChevronUp className="w-5 h-5 text-[var(--accent-primary)] flex-shrink-0" />
                    : <ChevronDown className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0" />
                }
            </div>
            {open && (
                <div className="px-6 py-4 text-[var(--text-secondary)] text-sm leading-relaxed bg-[var(--bg-surface)]">
                    {a}
                </div>
            )}
        </div>
    );
};

/* ── Table check/x ── */
const TC = ({ v }) => v
    ? <Check className="w-5 h-5 text-green-500 mx-auto" />
    : <X className="w-4 h-4 text-[var(--text-muted)] mx-auto" />;

const Pricing = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [yearly, setYearly] = useState(false);

    // API State
    const { getToken } = useAuth();
    const { value: currentUser } = useSelector(state => state.user);
    const dispatch = useDispatch();
    const [dbPlans, setDbPlans] = useState([]);
    const [loadingPlan, setLoadingPlan] = useState(null);

    useEffect(() => {
        api.get('/api/plans')
            .then(res => {
                if (res.data.success) setDbPlans(res.data.plans);
            })
            .catch(console.error);
    }, []);

    const handleUpgrade = async (planId) => {
        if (!currentUser) {
            navigate('/login');
            return;
        }
        setLoadingPlan(planId);
        try {
            const token = await getToken();
            const res = await api.post('/api/plans/update', { planId }, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) {
                toast.success(t('pricing_page.upgrade_success') || "Plan updated successfully!");
                dispatch(fetchUser(token));
            } else {
                toast.error(res.data.message);
            }
        } catch (err) {
            toast.error(t('pricing_page.upgrade_err') || "Failed to upgrade plan.");
        } finally {
            setLoadingPlan(null);
        }
    };

    const getDbPlan = (name) => dbPlans.find(p => p.name.toLowerCase() === name.toLowerCase());

    const plans = [
        {
            key: 'free',
            name: t('pricing_page.free_name'),
            price: t('pricing_page.free_price'),
            period: t('pricing_page.free_period'),
            desc: t('pricing_page.free_desc'),
            cta: t('pricing_page.free_cta'),
            popular: false,
            gradient: 'from-slate-500 to-slate-600',
            features: [true, true, true, true, false, false, false, false, false, false],
        },
        {
            key: 'pro',
            name: t('pricing_page.pro_name'),
            price: yearly ? t('pricing_page.pro_price_yearly') : t('pricing_page.pro_price_monthly'),
            period: yearly ? t('pricing_page.pro_period_yearly') : t('pricing_page.pro_period_monthly'),
            desc: t('pricing_page.pro_desc'),
            cta: t('pricing_page.pro_cta'),
            popular: true,
            gradient: 'from-blue-500 to-blue-600',
            features: [true, true, true, true, true, true, true, true, false, false],
        },
        {
            key: 'elite',
            name: t('pricing_page.elite_name'),
            price: yearly ? t('pricing_page.elite_price_yearly') : t('pricing_page.elite_price_monthly'),
            period: yearly ? t('pricing_page.elite_period_yearly') : t('pricing_page.elite_period_monthly'),
            desc: t('pricing_page.elite_desc'),
            cta: t('pricing_page.elite_cta'),
            popular: false,
            gradient: 'from-violet-500 to-violet-600',
            features: [true, true, true, true, true, true, true, true, true, true],
        },
    ];

    const tableRows = [
        t('pricing_page.row_logging'),
        t('pricing_page.row_routines'),
        t('pricing_page.row_library'),
        t('pricing_page.row_social'),
        t('pricing_page.row_charts'),
        t('pricing_page.row_pr'),
        t('pricing_page.row_analytics'),
        t('pricing_page.row_custom'),
        t('pricing_page.row_coach'),
        t('pricing_page.row_priority'),
    ];

    const faqs = [
        { q: t('pricing_page.faq1_q'), a: t('pricing_page.faq1_a') },
        { q: t('pricing_page.faq2_q'), a: t('pricing_page.faq2_a') },
        { q: t('pricing_page.faq3_q'), a: t('pricing_page.faq3_a') },
        { q: t('pricing_page.faq4_q'), a: t('pricing_page.faq4_a') },
    ];

    return (
        <PublicLayout>
            {/* ── Hero ── */}
            <section className="relative overflow-hidden py-20 sm:py-28 px-4 sm:px-6 text-center">
                <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-violet-600/10 blur-3xl" />
                <div className="relative max-w-2xl mx-auto space-y-5">
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20">
                        {t('pricing_page.hero_badge')}
                    </span>
                    <h1 className="text-4xl sm:text-6xl font-extrabold text-[var(--text-primary)] leading-tight">
                        {t('pricing_page.hero_title')}
                    </h1>
                    <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
                        {t('pricing_page.hero_sub')}
                    </p>

                    {/* Toggle */}
                    <div className="flex items-center justify-center gap-3 pt-4">
                        <span className={`text-sm font-semibold ${!yearly ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                            {t('pricing_page.monthly')}
                        </span>
                        <button
                            onClick={() => setYearly(v => !v)}
                            className={`relative w-12 h-6 rounded-full transition-colors ${yearly ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-subtle)]'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${yearly ? 'translate-x-7' : 'translate-x-1'}`} />
                        </button>
                        <span className={`text-sm font-semibold ${yearly ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                            {t('pricing_page.yearly')}
                        </span>
                        {yearly && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold text-white bg-green-500">
                                {t('pricing_page.save')}
                            </span>
                        )}
                    </div>
                </div>
            </section>

            {/* ── Plan Cards ── */}
            <section className="px-4 sm:px-6 pb-16">
                <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
                    {plans.map(plan => (
                        <div
                            key={plan.key}
                            className={`relative rounded-3xl border flex flex-col overflow-hidden transition-all duration-300 ${plan.popular ? 'border-[var(--accent-primary)] shadow-2xl shadow-blue-500/15 scale-[1.02]' : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'}`}
                        >
                            {plan.popular && (
                                <>
                                    {/* Gradient header */}
                                    <div className={`bg-gradient-to-r ${plan.gradient} p-0.5`} />
                                    {/* Popular badge */}
                                    <div className="absolute top-3 right-3">
                                        <span className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold text-white bg-[var(--accent-primary)]">
                                            <Zap className="w-3 h-3" /> {t('pricing_page.popular')}
                                        </span>
                                    </div>
                                </>
                            )}
                            <div className={`p-7 flex-1 flex flex-col ${plan.popular ? 'bg-[var(--bg-surface)]' : ''}`}>
                                {/* Name + price */}
                                <div className="mb-6">
                                    <h3 className="font-extrabold text-xl text-[var(--text-primary)] mb-1">{plan.name}</h3>
                                    <p className="text-sm text-[var(--text-muted)] mb-4">{plan.desc}</p>
                                    <div className="flex items-end gap-1">
                                        <span className={`text-4xl font-extrabold ${plan.popular ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'}`}>
                                            {getDbPlan(plan.name) ? (getDbPlan(plan.name).price === 0 ? "Free" : `$${getDbPlan(plan.name).price}`) : plan.price}
                                        </span>
                                        <span className="text-sm text-[var(--text-muted)] mb-1">/ mo</span>
                                    </div>
                                </div>

                                {/* Features mini list */}
                                <ul className="space-y-2.5 flex-1 mb-7">
                                    {tableRows.slice(0, 6).map((row, i) => (
                                        <li key={i} className="flex items-center gap-2.5 text-sm">
                                            {plan.features[i]
                                                ? <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                                                : <X className="w-4 h-4 text-[var(--border-subtle)] flex-shrink-0" />
                                            }
                                            <span className={plan.features[i] ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)] line-through'}>
                                                {row}
                                            </span>
                                        </li>
                                    ))}
                                </ul>

                                {/* CTA */}
                                {currentUser && currentUser.plan && getDbPlan(plan.name) && currentUser.plan._id === getDbPlan(plan.name)._id ? (
                                    <button
                                        disabled
                                        className="w-full py-3 rounded-xl text-center font-bold transition-all text-sm bg-gray-100 text-gray-400 cursor-not-allowed border outline-none"
                                    >
                                        Current Plan
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => getDbPlan(plan.name) ? handleUpgrade(getDbPlan(plan.name)._id) : navigate('/login')}
                                        disabled={loadingPlan === (getDbPlan(plan.name)?._id)}
                                        className={`w-full py-3 rounded-xl text-center font-bold transition-all text-sm flex items-center justify-center gap-2 ${plan.popular
                                            ? 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] shadow-lg shadow-blue-500/30'
                                            : 'border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]'
                                            }`}
                                    >
                                        {loadingPlan === (getDbPlan(plan.name)?._id) ? <Loader2 className="w-5 h-5 animate-spin" /> : plan.cta}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Comparison Table ── */}
            <section className="px-4 sm:px-6 py-16 bg-[var(--bg-surface)]">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-center text-[var(--text-primary)] mb-10">
                        {t('pricing_page.compare_title')}
                    </h2>
                    <div className="rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
                        {/* Header */}
                        <div className="grid grid-cols-4 bg-[var(--bg-surface-light)] border-b border-[var(--border-subtle)]">
                            <div className="p-4 font-bold text-sm text-[var(--text-muted)] uppercase tracking-wider">
                                {t('pricing_page.feat_col')}
                            </div>
                            {[t('pricing_page.free_col'), t('pricing_page.pro_col'), t('pricing_page.elite_col')].map((c, i) => (
                                <div key={c} className={`p-4 text-center font-bold text-sm ${i === 1 ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'}`}>
                                    {c}
                                </div>
                            ))}
                        </div>
                        {/* Rows */}
                        {tableRows.map((row, i) => (
                            <div key={i} className={`grid grid-cols-4 border-b border-[var(--border-subtle)] last:border-0 ${i % 2 === 0 ? 'bg-[var(--bg-surface)]' : 'bg-[var(--bg-surface-light)]'}`}>
                                <div className="p-4 text-sm font-medium text-[var(--text-secondary)]">{row}</div>
                                {plans.map(plan => (
                                    <div key={plan.key} className="p-4 flex items-center justify-center">
                                        <TC v={plan.features[i]} />
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── FAQ ── */}
            <section className="px-4 sm:px-6 py-16 sm:py-20">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-center text-[var(--text-primary)] mb-10">
                        {t('pricing_page.faq_title')}
                    </h2>
                    <div className="space-y-3">
                        {faqs.map((f, i) => <FAQItem key={i} q={f.q} a={f.a} />)}
                    </div>
                </div>
            </section>

            {/* ── Bottom CTA ── */}
            <section className="px-4 sm:px-6 pb-20">
                <div className="max-w-3xl mx-auto text-center rounded-3xl bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 p-12 text-white relative overflow-hidden">
                    <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-xl" />
                    <div className="relative">
                        <h2 className="text-2xl sm:text-3xl font-extrabold mb-6">{t('pricing_page.cta_title')}</h2>
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-blue-600 bg-white hover:bg-blue-50 transition shadow-xl"
                        >
                            {t('pricing_page.cta_btn')} <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
};

export default Pricing;
