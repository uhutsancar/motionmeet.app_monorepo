
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, BarChart3, Users, Zap, ArrowRight, Star } from 'lucide-react';
import PublicLayout from './PublicLayout';
import { Box, Stack, Typography, Button, Container, Grid, Paper, useTheme, Avatar } from '@mui/material';
import { alpha } from '@mui/material/styles';

const StatCard = ({ value, label }) => {
  const theme = useTheme();
  return (
    <Stack alignItems="center" spacing={0.5}>
      <Typography variant="h3" sx={{ fontWeight: 800, color: theme.palette.primary.main, fontSize: { xs: '2rem', sm: '2.5rem' } }}>
        {value}
      </Typography>
      <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </Typography>
    </Stack>
  );
};

const MiniFeature = ({ icon: Icon, title, desc }) => {
  const theme = useTheme();
  return (
    <Paper 
      elevation={0}
      sx={{ 
        p: 3, 
        borderRadius: 4, 
        border: `1px solid ${theme.palette.divider}`,
        bgcolor: 'background.paper',
        transition: 'all 0.3s ease',
        '&:hover': {
          borderColor: theme.palette.primary.main,
          boxShadow: `0 10px 30px -10px ${theme.palette.primary.main}20`
        }
      }}
    >
      <Stack spacing={2}>
        <Box sx={{ 
          width: 48, height: 48, borderRadius: 3, 
          bgcolor: `${theme.palette.primary.main}15`, 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: theme.palette.primary.main
        }}>
          <Icon size={24} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 0.5 }}>{title}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>{desc}</Typography>
        </Box>
      </Stack>
    </Paper>
  );
};

const TestimonialCard = ({ name, role, text }) => {
  const theme = useTheme();
  return (
    <Paper 
      elevation={0}
      sx={{ 
        p: 3, 
        borderRadius: 4, 
        border: `1px solid ${theme.palette.divider}`,
        bgcolor: 'background.paper',
        display: 'flex', flexDirection: 'column', gap: 2, height: '100%'
      }}
    >
      <Stack direction="row" spacing={0.5} sx={{ color: '#F59E0B' }}>
        {Array(5).fill(0).map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, flex: 1, fontStyle: 'italic' }}>
        "{text}"
      </Typography>
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{name}</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{role}</Typography>
      </Box>
    </Paper>
  );
};

const PhoneMockup = () => {
  const theme = useTheme();
  const sets = [
    { name: 'Bench Press', set: 'Set 1', value: '80 kg × 8', done: true },
    { name: 'Bench Press', set: 'Set 2', value: '85 kg × 6', done: true },
    { name: 'Overhead Press', set: 'Set 1', value: '50 kg × 10', done: false },
    { name: 'Squat', set: 'Set 1', value: '100 kg × 5', done: false },
  ];
  return (
    <Box sx={{ position: 'relative', mx: 'auto', width: { xs: 260, sm: 290 } }}>
      <Box sx={{ position: 'absolute', inset: 0, bgcolor: theme.palette.primary.main, filter: 'blur(60px)', opacity: 0.2, borderRadius: '50%', transform: 'scale(0.9)', zIndex: -1 }} />
      <Box sx={{ 
        position: 'relative', width: '100%', borderRadius: '36px', 
        border: '4px solid #1a1a2e', bgcolor: '#0d0d1a', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', 
        overflow: 'hidden' 
      }}>
        <Box sx={{ width: '100%', height: 28, bgcolor: '#0d0d1a', display: 'flex', justifyContent: 'center', pt: 0.5 }}>
          <Box sx={{ width: 80, height: 16, bgcolor: '#1a1a2e', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }} />
        </Box>
        <Box sx={{ p: 2, pb: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.5}>
            <Box>
              <Typography sx={{ fontSize: 10, color: theme.palette.primary.light, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Active Workout</Typography>
              <Typography sx={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>Push Day A</Typography>
            </Box>
            <Box sx={{ bgcolor: theme.palette.primary.main, color: 'white', fontSize: 10, fontWeight: 'bold', px: 1.5, py: 0.5, borderRadius: 10 }}>Finish</Box>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)', borderRadius: 2, px: 1.5, py: 1 }}>
            <Box sx={{ width: 8, height: 8, bgcolor: '#4ade80', borderRadius: '50%' }} />
            <Typography sx={{ color: '#4ade80', fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold' }}>01:24:08</Typography>
          </Stack>
          {sets.map((s, i) => (
            <Stack key={i} direction="row" alignItems="center" justifyContent="space-between" sx={{ 
              borderRadius: 2, px: 1.5, py: 1.25, 
              bgcolor: s.done ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 255, 255, 0.05)', 
              border: '1px solid', borderColor: s.done ? 'rgba(74, 222, 128, 0.3)' : 'rgba(255, 255, 255, 0.1)' 
            }}>
              <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 'bold', color: s.done ? '#4ade80' : 'rgba(255, 255, 255, 0.7)' }}>{s.name}</Typography>
                <Typography sx={{ fontSize: 10, color: s.done ? 'rgba(74, 222, 128, 0.7)' : 'rgba(255, 255, 255, 0.4)' }}>{s.set}</Typography>
              </Box>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography sx={{ fontSize: 11, fontWeight: 'bold', color: s.done ? '#86efac' : 'rgba(255, 255, 255, 0.6)' }}>{s.value}</Typography>
                <Box sx={{ 
                  width: 16, height: 16, borderRadius: '50%', border: '2px solid', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  bgcolor: s.done ? '#22c55e' : 'transparent', borderColor: s.done ? '#22c55e' : 'rgba(255, 255, 255, 0.3)' 
                }}>
                  {s.done && <CheckCircle2 size={10} color="white" />}
                </Box>
              </Stack>
            </Stack>
          ))}
          <Stack direction="row" alignItems="center" spacing={1} sx={{ bgcolor: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 2, px: 1.5, py: 1 }}>
            <Typography sx={{ color: '#fbbf24', fontSize: 10, fontWeight: 'bold' }}>🏆 NEW PERSONAL RECORD — Bench Press 85 kg</Typography>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
};

const Landing = () => {
  const { t } = useTranslation();
  const theme = useTheme();

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
      <Box sx={{
        position: 'relative',
        overflow: 'hidden',
        pt: { xs: 6, sm: 10, lg: 12 },
        pb: { xs: 9, sm: 13 },
        px: { xs: 2, sm: 3 },
        background: (muiTheme) => `linear-gradient(180deg, ${alpha(muiTheme.palette.primary.main, 0.055)}, transparent 48%)`,
      }}>
        <Box sx={{ position: 'absolute', top: -160, right: -160, width: 600, height: 600, borderRadius: '50%', bgcolor: `${theme.palette.primary.main}15`, filter: 'blur(80px)', pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', bottom: -160, left: -160, width: 500, height: 500, borderRadius: '50%', bgcolor: `${theme.palette.secondary.main}15`, filter: 'blur(80px)', pointerEvents: 'none' }} />

        <Container maxWidth="lg" sx={{ position: 'relative' }}>
          <Grid container spacing={{ xs: 7, lg: 10 }} alignItems="center">
            {/* Left */}
            <Grid item xs={12} lg={6} sx={{ textAlign: { xs: 'center', lg: 'left' } }}>
              <Stack spacing={3.5} alignItems={{ xs: 'center', lg: 'flex-start' }}>
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderRadius: 10, bgcolor: `${theme.palette.primary.main}1A`, border: `1px solid ${theme.palette.primary.main}33` }}>
                  <Typography variant="body2" sx={{ color: theme.palette.primary.main, fontWeight: 600 }}>{t('landing.hero_badge')}</Typography>
                </Box>
                
                <Typography variant="h2" sx={{ fontWeight: 800, lineHeight: 1.06, fontSize: { xs: '2.45rem', sm: '3.55rem', lg: '4.4rem' }, letterSpacing: '-0.045em', overflowWrap: 'anywhere' }}>
                  {t('landing.hero_headline')}<br />
                  <Box component="span" sx={{ color: theme.palette.primary.main }}>{t('landing.hero_headline2')}</Box>
                </Typography>

                <Typography sx={{ color: 'text.secondary', fontSize: { xs: 16, sm: 18 }, fontWeight: 500, maxWidth: 600, lineHeight: 1.7 }}>
                  {t('landing.hero_sub')}
                </Typography>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} width={{ xs: '100%', sm: 'auto' }}>
                  <Button 
                    component={Link} to="/login"
                    variant="contained" 
                    size="large"
                    endIcon={<ArrowRight size={18} />}
                    sx={{ px: 4, minHeight: 52, borderRadius: 3.5, fontWeight: 'bold', fontSize: '1rem', boxShadow: `0 12px 28px -7px ${theme.palette.primary.main}80` }}
                  >
                    {t('landing.hero_cta_primary')}
                  </Button>
                  <Button 
                    component={Link} to="/features"
                    variant="outlined" 
                    size="large"
                    sx={{ px: 4, minHeight: 52, borderRadius: 3.5, fontWeight: 'bold', fontSize: '1rem', bgcolor: 'background.paper' }}
                  >
                    {t('landing.hero_cta_secondary')}
                  </Button>
                </Stack>

                <Stack direction="row" alignItems="center" spacing={1.5} pt={1}>
                  <Stack direction="row" sx={{ '& > *': { ml: -1 }, '& > *:first-of-type': { ml: 0 } }}>
                    {['#60A5FA', '#A78BFA', '#F472B6', '#FBBF24'].map((c, i) => (
                      <Avatar key={i} sx={{ width: 32, height: 32, bgcolor: c, border: `2px solid ${theme.palette.background.default}`, fontSize: 12, fontWeight: 'bold' }}>
                        {['A', 'S', 'M', 'J'][i]}
                      </Avatar>
                    ))}
                  </Stack>
                  <Box sx={{ textAlign: 'left' }}>
                    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: '#F59E0B' }}>
                      {Array(5).fill(0).map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', ml: 0.5 }}>4.9</Typography>
                    </Stack>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t('landing.hero_trust')}</Typography>
                  </Box>
                </Stack>
              </Stack>
            </Grid>

            {/* Right */}
            <Grid item xs={12} lg={6} sx={{ display: 'flex', justifyContent: 'center' }}>
              <PhoneMockup />
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ── STATS BAR ─────────────────────────────────────── */}
      <Box sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider', py: 5, bgcolor: 'background.paper' }}>
        <Container maxWidth="md">
          <Grid container spacing={{ xs: 1, sm: 3 }} divider={<Box sx={{ width: 1, height: '100%', bgcolor: 'divider' }} />}>
            <Grid item xs={4}><StatCard value="50k+" label={t('landing.stat_users')} /></Grid>
            <Grid item xs={4}><StatCard value="1M+" label={t('landing.stat_workouts')} /></Grid>
            <Grid item xs={4}><StatCard value="4.9★" label={t('landing.stat_rating')} /></Grid>
          </Grid>
        </Container>
      </Box>

      {/* ── MINI FEATURES ─────────────────────────────────── */}
      <Box sx={{ py: { xs: 10, sm: 12 }, px: { xs: 2, sm: 3 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={3}>
            {featureCards.map((f, i) => (
              <Grid item xs={12} sm={4} key={i}>
                <MiniFeature {...f} />
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ── APP SHOWCASE ──────────────────────────────────── */}
      <Box sx={{ py: { xs: 10, sm: 12 }, px: { xs: 2, sm: 3 }, bgcolor: 'background.paper' }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 8, lg: 10 }} alignItems="center">
            {/* Left */}
            <Grid item xs={12} lg={6}>
              <Box sx={{ position: 'relative' }}>
                <Box sx={{ position: 'absolute', inset: 0, bgcolor: `${theme.palette.primary.main}10`, borderRadius: 6, transform: 'rotate(-1deg) scale(1.05)' }} />
                <Paper elevation={0} sx={{ position: 'relative', bgcolor: 'background.default', borderRadius: 6, p: { xs: 4, sm: 5 }, border: 1, borderColor: 'divider' }}>
                  <Box mb={3}>
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', mb: 2 }}>
                      <Typography variant="caption" sx={{ fontWeight: 'bold', color: theme.palette.primary.main, textTransform: 'uppercase', letterSpacing: 1, px: 1, py: 0.5, borderRadius: 1, bgcolor: `${theme.palette.primary.main}1A` }}>
                        {t('landing.showcase_badge')}
                      </Typography>
                    </Box>
                    <Stack direction="row" alignItems="flex-end" spacing={1} sx={{ height: 120, mb: 1.5 }}>
                      {[40, 55, 42, 70, 62, 85, 78].map((h, i) => (
                        <Box key={i} sx={{ flex: 1, position: 'relative', height: `${h}%`, borderTopLeftRadius: 6, borderTopRightRadius: 6, bgcolor: theme.palette.primary.main, opacity: 0.8 }}>
                          {i === 5 && (
                            <Box sx={{ position: 'absolute', top: -24, left: '50%', transform: 'translateX(-50%)', bgcolor: '#F59E0B', color: 'white', fontSize: 9, fontWeight: 'bold', px: 0.5, py: 0.25, borderRadius: 1, whiteSpace: 'nowrap' }}>
                              PR!
                            </Box>
                          )}
                        </Box>
                      ))}
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" sx={{ typography: 'caption', color: 'text.secondary', fontSize: 10 }}>
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <Typography key={d} component="span" variant="inherit">{d}</Typography>)}
                    </Stack>
                  </Box>
                  <Grid container spacing={1.5}>
                    {[
                      { label: 'Total Volume', value: '23,500 kg', color: '#3b82f6' },
                      { label: 'Calories Burned', value: '18,400 kcal', color: '#22c55e' },
                    ].map(({ label, value, color }) => (
                      <Grid item xs={6} key={label}>
                        <Paper elevation={0} sx={{ bgcolor: 'background.paper', borderRadius: 3, p: 1.5, border: 1, borderColor: 'divider' }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{label}</Typography>
                          <Typography variant="subtitle1" sx={{ fontWeight: 800, color }}>{value}</Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              </Box>
            </Grid>

            {/* Right */}
            <Grid item xs={12} lg={6}>
              <Stack spacing={3}>
                <Typography variant="h3" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.2 }}>
                  {t('landing.showcase_title')}
                </Typography>
                <Stack spacing={1.5}>
                  {showcaseFeats.map((f, i) => (
                    <Stack key={i} direction="row" alignItems="center" spacing={1.5} sx={{ color: 'text.secondary' }}>
                      <CheckCircle2 size={20} color={theme.palette.primary.main} />
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>{f}</Typography>
                    </Stack>
                  ))}
                </Stack>
                <Box pt={1}>
                  <Button 
                    component={Link} to="/features"
                    endIcon={<ArrowRight size={16} />}
                    sx={{ fontWeight: 'bold', textTransform: 'none', fontSize: '0.875rem' }}
                  >
                    {t('landing.hero_cta_secondary')}
                  </Button>
                </Box>
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ── TESTIMONIALS ──────────────────────────────────── */}
      <Box sx={{ py: { xs: 10, sm: 12 }, px: { xs: 2, sm: 3 } }}>
        <Container maxWidth="lg">
          <Typography variant="h3" align="center" sx={{ fontWeight: 800, color: 'text.primary', mb: 6 }}>
            {t('landing.testimonial_title')}
          </Typography>
          <Grid container spacing={3}>
            {testimonials.map((t, i) => (
              <Grid item xs={12} md={4} key={i}>
                <TestimonialCard {...t} />
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ── CTA BANNER ────────────────────────────────────── */}
      <Box sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 10, sm: 12 } }}>
        <Container maxWidth="md">
          <Paper 
            elevation={0}
            sx={{ 
              borderRadius: 6, 
              background: `linear-gradient(to bottom right, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              p: { xs: 5, sm: 7 }, 
              textAlign: 'center', 
              position: 'relative', 
              overflow: 'hidden' 
            }}
          >
            <Box sx={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', bgcolor: 'rgba(255, 255, 255, 0.1)', filter: 'blur(30px)' }} />
            <Box sx={{ position: 'absolute', bottom: -40, left: -40, width: 160, height: 160, borderRadius: '50%', bgcolor: 'rgba(255, 255, 255, 0.1)', filter: 'blur(30px)' }} />
            <Box sx={{ position: 'relative' }}>
              <Typography variant="h3" sx={{ fontWeight: 800, color: 'white', mb: 2 }}>
                {t('landing.cta_title')}
              </Typography>
              <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.8)', mb: 4, maxWidth: 600, mx: 'auto', fontWeight: 400 }}>
                {t('landing.cta_sub')}
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
                {t('landing.cta_btn')}
              </Button>
            </Box>
          </Paper>
        </Container>
      </Box>
    </PublicLayout>
  );
};

export default Landing;
