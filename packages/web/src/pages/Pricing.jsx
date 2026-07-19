import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, X, ArrowRight, Zap, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import PublicLayout from './PublicLayout';
import api from '~/api/axios.js';
import { useAuthContext } from "../context/AuthProvider";
import { useSelector, useDispatch } from 'react-redux';
import { fetchUser } from '../features/user/userSlice';
import toast from 'react-hot-toast';
import { Box, Stack, Typography, Button, Container, Grid, Paper, Collapse, Switch, useTheme } from '@mui/material';

const FAQItem = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  const theme = useTheme();

  return (
    <Paper 
      elevation={0}
      sx={{ 
        border: `1px solid ${theme.palette.divider}`, 
        borderRadius: 4, 
        overflow: 'hidden',
        mb: 2,
        bgcolor: 'background.paper'
      }}
    >
      <Box 
        onClick={() => setOpen(!open)}
        sx={{ 
          px: 3, py: 2, 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' }
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{q}</Typography>
        <Box sx={{ color: open ? theme.palette.primary.main : 'text.secondary' }}>
          {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </Box>
      </Box>
      <Collapse in={open}>
        <Box sx={{ px: 3, py: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>{a}</Typography>
        </Box>
      </Collapse>
    </Paper>
  );
};

const TC = ({ v }) => v 
  ? <Check size={20} color="#22c55e" /> 
  : <X size={16} color="currentColor" style={{ opacity: 0.3 }} />;

const Pricing = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const [yearly, setYearly] = useState(false);

  // API State
  const { getToken } = useAuthContext();
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
    } catch (error) {
      toast.error(error.response?.data?.message || t('pricing_page.upgrade_err') || "Failed to update plan.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const getDbPlan = (name) => dbPlans.find(p => p.name.toLowerCase() === name.toLowerCase());

  const plans = [
    {
      key: 'free',
      dbName: 'Free',
      name: t('pricing_page.free_name'),
      price: t('pricing_page.free_price'),
      period: t('pricing_page.free_period'),
      desc: t('pricing_page.free_desc'),
      cta: t('pricing_page.free_cta'),
      popular: false,
      color: theme.palette.text.secondary,
      features: [true, true, true, true, false, false, false, false, false, false],
    },
    {
      key: 'pro',
      dbName: 'Pro',
      name: t('pricing_page.pro_name'),
      price: yearly ? t('pricing_page.pro_price_yearly') : t('pricing_page.pro_price_monthly'),
      period: yearly ? t('pricing_page.pro_period_yearly') : t('pricing_page.pro_period_monthly'),
      desc: t('pricing_page.pro_desc'),
      cta: t('pricing_page.pro_cta'),
      popular: true,
      color: theme.palette.primary.main,
      features: [true, true, true, true, true, true, true, true, false, false],
    },
    {
      key: 'elite',
      dbName: 'Premium',
      name: t('pricing_page.elite_name'),
      price: yearly ? t('pricing_page.elite_price_yearly') : t('pricing_page.elite_price_monthly'),
      period: yearly ? t('pricing_page.elite_period_yearly') : t('pricing_page.elite_period_monthly'),
      desc: t('pricing_page.elite_desc'),
      cta: t('pricing_page.elite_cta'),
      popular: false,
      color: '#8b5cf6',
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
      <Box sx={{ position: 'relative', overflow: 'hidden', py: { xs: 10, sm: 14 }, px: { xs: 2, sm: 3 }, textAlign: 'center' }}>
        <Box sx={{ position: 'absolute', top: -128, left: '50%', transform: 'translateX(-50%)', width: 600, height: 400, borderRadius: '50%', bgcolor: 'rgba(124, 58, 237, 0.1)', filter: 'blur(80px)', pointerEvents: 'none' }} />
        
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
          <Stack spacing={3} alignItems="center">
            <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 2, py: 1, borderRadius: 10, bgcolor: `${theme.palette.primary.main}1A`, border: `1px solid ${theme.palette.primary.main}33` }}>
              <Typography variant="body2" sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>{t('pricing_page.hero_badge')}</Typography>
            </Box>
            
            <Typography variant="h2" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.2, fontSize: { xs: '2.5rem', sm: '3.75rem' } }}>
              {t('pricing_page.hero_title')}
            </Typography>
            
            <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 400, maxWidth: 600, mx: 'auto' }}>
              {t('pricing_page.hero_sub')}
            </Typography>

            {/* Toggle */}
            <Stack direction="row" alignItems="center" spacing={2} pt={3}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: !yearly ? 'text.primary' : 'text.secondary' }}>
                {t('pricing_page.monthly')}
              </Typography>
              <Switch 
                checked={yearly} 
                onChange={(e) => setYearly(e.target.checked)} 
                color="primary" 
              />
              <Typography variant="body2" sx={{ fontWeight: 600, color: yearly ? 'text.primary' : 'text.secondary' }}>
                {t('pricing_page.yearly')}
              </Typography>
              {yearly && (
                <Box sx={{ px: 1.5, py: 0.5, borderRadius: 10, bgcolor: '#22c55e', color: 'white' }}>
                  <Typography variant="caption" sx={{ fontWeight: 'bold' }}>{t('pricing_page.save')}</Typography>
                </Box>
              )}
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* ── Plan Cards ── */}
      <Box sx={{ px: { xs: 2, sm: 3 }, pb: 10 }}>
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            {plans.map(plan => {
              const currentDbPlan = getDbPlan(plan.dbName);
              const displayPrice = currentDbPlan ? (currentDbPlan.price === 0 ? plan.price : `$${currentDbPlan.price}`) : plan.price;
              const isCurrent = currentUser?.plan?._id === currentDbPlan?._id;

              return (
                <Grid item xs={12} md={4} key={plan.key}>
                  <Paper 
                    elevation={plan.popular ? 12 : 0}
                    sx={{
                      position: 'relative',
                      height: '100%',
                      display: 'flex', flexDirection: 'column',
                      borderRadius: 6,
                      border: `1px solid ${plan.popular ? theme.palette.primary.main : theme.palette.divider}`,
                      bgcolor: plan.popular ? 'background.paper' : 'background.default',
                      transition: 'transform 0.3s',
                      transform: plan.popular ? 'scale(1.02)' : 'none',
                      overflow: 'hidden'
                    }}
                  >
                    {plan.popular && (
                      <Box sx={{ position: 'absolute', top: 12, right: 12 }}>
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ px: 1.5, py: 0.5, borderRadius: 10, bgcolor: theme.palette.primary.main, color: 'white' }}>
                          <Zap size={14} />
                          <Typography variant="caption" sx={{ fontWeight: 'bold' }}>{t('pricing_page.popular')}</Typography>
                        </Stack>
                      </Box>
                    )}

                    <Box sx={{ p: { xs: 4, sm: 5 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <Box mb={4}>
                        <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>{plan.name}</Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>{plan.desc}</Typography>
                        <Stack direction="row" alignItems="flex-end" spacing={0.5}>
                          <Typography variant="h3" sx={{ fontWeight: 800, color: plan.popular ? theme.palette.primary.main : 'text.primary', lineHeight: 1 }}>
                            {displayPrice}
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>/ mo</Typography>
                        </Stack>
                      </Box>

                      <Stack spacing={2} sx={{ flex: 1, mb: 5 }}>
                        {tableRows.slice(0, 6).map((row, i) => (
                          <Stack direction="row" alignItems="center" spacing={1.5} key={i}>
                            {plan.features[i] ? <Check size={20} color="#22c55e" /> : <X size={20} color={theme.palette.divider} />}
                            <Typography variant="body2" sx={{ 
                              color: plan.features[i] ? 'text.secondary' : 'text.disabled',
                              textDecoration: plan.features[i] ? 'none' : 'line-through'
                            }}>
                              {row}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>

                      {isCurrent ? (
                        <Button 
                          variant="outlined" 
                          disabled 
                          fullWidth 
                          sx={{ py: 1.5, borderRadius: 3, fontWeight: 'bold' }}
                        >
                          Current Plan
                        </Button>
                      ) : (
                        <Button
                          variant={plan.popular ? 'contained' : 'outlined'}
                          fullWidth
                          disabled={plan.key !== 'free' || loadingPlan === currentDbPlan?._id}
                          onClick={() => currentDbPlan ? handleUpgrade(currentDbPlan._id) : navigate('/login')}
                          sx={{ 
                            py: 1.5, borderRadius: 3, fontWeight: 'bold',
                            bgcolor: plan.popular ? 'primary.main' : 'transparent',
                            color: plan.popular ? 'white' : 'text.primary'
                          }}
                        >
                          {loadingPlan === currentDbPlan?._id 
                            ? <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /> 
                            : (plan.key === 'free' ? plan.cta : t('pricing_page.checkout_soon', 'Checkout yakında'))}
                        </Button>
                      )}
                    </Box>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </Container>
      </Box>

      {/* ── Comparison Table ── */}
      <Box sx={{ px: { xs: 2, sm: 3 }, py: 10, bgcolor: 'background.paper' }}>
        <Container maxWidth="lg">
          <Typography variant="h4" align="center" sx={{ fontWeight: 800, mb: 6 }}>
            {t('pricing_page.compare_title')}
          </Typography>
          <Paper elevation={0} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 4, overflow: 'hidden' }}>
            {/* Header */}
            <Grid container sx={{ bgcolor: 'action.hover', borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Grid item xs={3} sx={{ p: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>
                  {t('pricing_page.feat_col')}
                </Typography>
              </Grid>
              {[t('pricing_page.free_col'), t('pricing_page.pro_col'), t('pricing_page.elite_col')].map((c, i) => (
                <Grid item xs={3} key={c} sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: i === 1 ? 'primary.main' : 'text.primary' }}>
                    {c}
                  </Typography>
                </Grid>
              ))}
            </Grid>
            {/* Rows */}
            {tableRows.map((row, i) => (
              <Grid container key={i} sx={{ borderBottom: `1px solid ${theme.palette.divider}`, bgcolor: i % 2 === 0 ? 'background.default' : 'background.paper', '&:last-child': { borderBottom: 0 } }}>
                <Grid item xs={3} sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.secondary' }}>{row}</Typography>
                </Grid>
                {plans.map(plan => (
                  <Grid item xs={3} key={plan.key} sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TC v={plan.features[i]} />
                  </Grid>
                ))}
              </Grid>
            ))}
          </Paper>
        </Container>
      </Box>

      {/* ── FAQ ── */}
      <Box sx={{ px: { xs: 2, sm: 3 }, py: { xs: 10, sm: 12 } }}>
        <Container maxWidth="md">
          <Typography variant="h4" align="center" sx={{ fontWeight: 800, mb: 6 }}>
            {t('pricing_page.faq_title')}
          </Typography>
          <Box>
            {faqs.map((f, i) => <FAQItem key={i} q={f.q} a={f.a} />)}
          </Box>
        </Container>
      </Box>

      {/* ── Bottom CTA ── */}
      <Box sx={{ px: { xs: 2, sm: 3 }, pb: 10 }}>
        <Container maxWidth="md">
          <Paper 
            elevation={0}
            sx={{ 
              borderRadius: 6, 
              background: `linear-gradient(to bottom right, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              p: { xs: 6, sm: 8 }, 
              textAlign: 'center', 
              position: 'relative', 
              overflow: 'hidden' 
            }}
          >
            <Box sx={{ position: 'absolute', top: -32, right: -32, width: 128, height: 128, borderRadius: '50%', bgcolor: 'rgba(255, 255, 255, 0.1)', filter: 'blur(24px)' }} />
            <Box sx={{ position: 'relative' }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', mb: 4 }}>
                {t('pricing_page.cta_title')}
              </Typography>
              <Button 
                component={Link} to="/login"
                variant="contained"
                size="large"
                endIcon={<ArrowRight size={18} />}
                sx={{ 
                  bgcolor: 'white', color: theme.palette.primary.main, 
                  px: 4, py: 1.5, borderRadius: 3, fontWeight: 'bold', fontSize: '1rem',
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.9)' }
                }}
              >
                {t('pricing_page.cta_btn')}
              </Button>
            </Box>
          </Paper>
        </Container>
      </Box>
    </PublicLayout>
  );
};

export default Pricing;
