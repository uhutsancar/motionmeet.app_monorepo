
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Zap, Shield, Heart } from 'lucide-react';
import PublicLayout from './PublicLayout';
import motionmeetLogo from '../assets/motionmeet_logo.svg';
import { Box, Stack, Typography, Button, Container, Grid, Paper, useTheme } from '@mui/material';

const ValueCard = ({ icon: Icon, title, desc, iconBgColor, iconColor }) => {
  const theme = useTheme();
  return (
    <Paper 
      elevation={0}
      sx={{ 
        p: 3, 
        borderRadius: 4, 
        border: `1px solid ${theme.palette.divider}`,
        bgcolor: 'background.paper',
        display: 'flex', flexDirection: 'column', gap: 2,
        transition: 'border-color 0.3s',
        '&:hover': { borderColor: theme.palette.primary.main }
      }}
    >
      <Box sx={{ 
        width: 48, height: 48, borderRadius: 3, 
        bgcolor: iconBgColor, color: iconColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <Icon size={24} />
      </Box>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 0.5 }}>{title}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>{desc}</Typography>
      </Box>
    </Paper>
  );
};

const About = () => {
  const { t } = useTranslation();
  const theme = useTheme();

  const values = [
    {
      icon: Zap,
      title: t('about_page.val1_title'),
      desc: t('about_page.val1_desc'),
      iconBgColor: 'rgba(245, 158, 11, 0.1)',
      iconColor: '#f59e0b',
    },
    {
      icon: Shield,
      title: t('about_page.val2_title'),
      desc: t('about_page.val2_desc'),
      iconBgColor: 'rgba(59, 130, 246, 0.1)',
      iconColor: '#6558F5',
    },
    {
      icon: Heart,
      title: t('about_page.val3_title'),
      desc: t('about_page.val3_desc'),
      iconBgColor: 'rgba(236, 72, 153, 0.1)',
      iconColor: '#ec4899',
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
      <Box sx={{ position: 'relative', overflow: 'hidden', py: { xs: 10, sm: 14 }, px: { xs: 2, sm: 3 }, textAlign: 'center' }}>
        <Box sx={{ position: 'absolute', top: -128, left: '50%', transform: 'translateX(-50%)', width: 700, height: 400, borderRadius: '50%', bgcolor: 'rgba(18, 168, 138, 0.1)', filter: 'blur(80px)', pointerEvents: 'none' }} />
        
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
          <Stack spacing={3} alignItems="center">
            <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 2, py: 1, borderRadius: 10, bgcolor: `${theme.palette.primary.main}1A`, border: `1px solid ${theme.palette.primary.main}33` }}>
              <Typography variant="body2" sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>{t('about_page.hero_badge')}</Typography>
            </Box>
            
            <Typography variant="h2" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.2, fontSize: { xs: '2.5rem', sm: '3.75rem' } }}>
              {t('about_page.hero_title')}
            </Typography>
            
            <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 400, maxWidth: 672, mx: 'auto', lineHeight: 1.6 }}>
              {t('about_page.hero_sub')}
            </Typography>

            {/* Stats */}
            <Stack direction="row" flexWrap="wrap" justifyContent="center" gap={3} pt={2}>
              {stats.map(({ val }, i) => (
                <Box key={i} sx={{ px: 3, py: 1.5, borderRadius: 4, bgcolor: 'background.paper', border: `1px solid ${theme.palette.divider}` }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: theme.palette.primary.main }}>{val}</Typography>
                </Box>
              ))}
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* ── Our Story ── */}
      <Box sx={{ py: { xs: 8, sm: 10 }, px: { xs: 2, sm: 3 }, bgcolor: 'background.paper' }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 7, lg: 10 }} alignItems="center">
            {/* Visual */}
            <Grid size={{ xs: 12, lg: 6 }}>
              <Box sx={{ position: 'relative' }}>
                <Box sx={{ position: 'absolute', inset: 0, bgcolor: `${theme.palette.primary.main}10`, borderRadius: 6, transform: 'rotate(1deg) scale(1.05)' }} />
                <Paper elevation={0} sx={{ position: 'relative', bgcolor: 'background.default', borderRadius: 6, p: 4, border: 1, borderColor: 'divider' }}>
                  <Stack direction="row" alignItems="center" spacing={1.5} mb={2.5}>
                    <Box component="img" src={motionmeetLogo} alt="MotionMeet" sx={{ height: 40, width: 'auto' }} />
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>MotionMeet</Typography>
                  </Stack>
                  <Box sx={{ borderLeft: `4px solid ${theme.palette.primary.main}`, pl: 2.5, py: 0.5, mb: 3 }}>
                    <Typography variant="subtitle1" sx={{ fontStyle: 'italic', color: 'text.secondary', fontWeight: 600, lineHeight: 1.6 }}>
                      "{t('about_page.story_quote')}"
                    </Typography>
                  </Box>
                  <Stack spacing={2} pt={1}>
                    {[
                      { marker: '01', label: 'Plan routines around your own training' },
                      { marker: '02', label: 'Log only the sets you actually complete' },
                      { marker: '03', label: 'Turn workout history into clear progress' },
                      { marker: '04', label: 'Share with visibility you control' },
                    ].map(({ marker, label }) => (
                      <Stack key={marker} direction="row" alignItems="center" spacing={2}>
                        <Typography sx={{ width: 40, fontSize: 12, fontWeight: 800, color: theme.palette.primary.main }}>{marker}</Typography>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: theme.palette.primary.main, flexShrink: 0 }} />
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>{label}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Paper>
              </Box>
            </Grid>
            {/* Text */}
            <Grid size={{ xs: 12, lg: 6 }}>
              <Stack spacing={3}>
                <Typography variant="h3" sx={{ fontWeight: 800, color: 'text.primary' }}>
                  {t('about_page.story_title')}
                </Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>{t('about_page.story_p1')}</Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>{t('about_page.story_p2')}</Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>{t('about_page.story_p3')}</Typography>
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ── Values ── */}
      <Box sx={{ py: { xs: 8, sm: 10 }, px: { xs: 2, sm: 3 }, bgcolor: 'background.paper' }}>
        <Container maxWidth="md">
          <Typography variant="h3" align="center" sx={{ fontWeight: 800, mb: 6 }}>
            {t('about_page.values_title')}
          </Typography>
          <Grid container spacing={3}>
            {values.map((v, i) => (
              <Grid size={{ xs: 12, sm: 4 }} key={i}>
                <ValueCard {...v} />
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ── CTA ── */}
      <Box sx={{ px: { xs: 2, sm: 3 }, py: { xs: 8, sm: 10 } }}>
        <Container maxWidth="md">
          <Paper 
            elevation={0}
            sx={{ 
              borderRadius: 6, 
              background: `linear-gradient(to bottom right, #12A88A, #6558F5, #3F397E)`,
              p: { xs: 6, sm: 8 }, 
              textAlign: 'center', 
              position: 'relative', 
              overflow: 'hidden' 
            }}
          >
            <Box sx={{ position: 'absolute', top: -32, right: -32, width: 128, height: 128, borderRadius: '50%', bgcolor: 'rgba(255, 255, 255, 0.1)', filter: 'blur(24px)' }} />
            <Box sx={{ position: 'absolute', bottom: -32, left: -32, width: 128, height: 128, borderRadius: '50%', bgcolor: 'rgba(255, 255, 255, 0.1)', filter: 'blur(24px)' }} />
            <Stack spacing={3} sx={{ position: 'relative' }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: 'white' }}>
                {t('about_page.cta_title')}
              </Typography>
              <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.8)', maxWidth: 448, mx: 'auto', fontWeight: 400 }}>
                {t('about_page.cta_sub')}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" pt={1}>
                <Button 
                  component={Link} to="/login"
                  variant="contained"
                  size="large"
                  endIcon={<ArrowRight size={18} />}
                  sx={{ 
                    bgcolor: 'white', color: '#1d4ed8', 
                    px: 4, py: 1.5, borderRadius: 3, fontWeight: 'bold', fontSize: '1rem',
                    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.9)' }
                  }}
                >
                  {t('about_page.cta_btn')}
                </Button>
                <Button 
                  href="mailto:support@motionmeet.app"
                  variant="outlined"
                  size="large"
                  sx={{ 
                    color: 'white', borderColor: 'rgba(255, 255, 255, 0.3)', 
                    px: 4, py: 1.5, borderRadius: 3, fontWeight: 'bold', fontSize: '1rem', border: '2px solid',
                    '&:hover': { borderColor: 'white', bgcolor: 'rgba(255, 255, 255, 0.1)' }
                  }}
                >
                  {t('about_page.cta_btn2')}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Container>
      </Box>
    </PublicLayout>
  );
};

export default About;
