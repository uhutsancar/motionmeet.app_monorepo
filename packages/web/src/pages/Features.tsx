
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Dumbbell, TrendingUp, ListChecks, MessageSquare, BookOpen, BarChart2, ArrowRight } from 'lucide-react';
import PublicLayout from './PublicLayout';
import { Box, Stack, Typography, Button, Container, Grid, Paper, useTheme } from '@mui/material';

const ICONS = [Dumbbell, TrendingUp, ListChecks, MessageSquare, BookOpen, BarChart2];
const COLORS = [
  { main: '#6558F5', bg: 'rgba(101, 88, 245, 0.1)' },
  { main: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
  { main: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
  { main: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)' },
  { main: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  { main: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
];

const FeatureRow = ({ index }: { index: number }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isReversed = index % 2 === 1;
  const Icon = ICONS[index];
  const color = COLORS[index];
  
  const bullets = [
    t(`features_page.f${index + 1}_b1`),
    t(`features_page.f${index + 1}_b2`),
    t(`features_page.f${index + 1}_b3`),
    t(`features_page.f${index + 1}_b4`),
  ];

  const productPreviews = [
    /* 1 – Workout Logging */
    <Stack spacing={1.5} key="1">
      {[{ ex: 'Bench Press', done: true, val: '80 kg × 8' }, { ex: 'Squat', done: true, val: '100 kg × 5' }, { ex: 'Deadlift', done: false, val: '120 kg × 3' }].map((r, i) => (
        <Stack key={i} direction="row" sx={{ justifyContent: "space-between",  alignItems: "center", 
          p: 1.5, borderRadius: 3, border: '1px solid',
          bgcolor: r.done ? 'rgba(34, 197, 94, 0.1)' : 'background.default',
          borderColor: r.done ? 'rgba(34, 197, 94, 0.2)' : 'divider'
        }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: r.done ? '#4ade80' : 'text.primary' }}>{r.ex}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Set {i + 1}</Typography>
          </Box>
          <Stack direction="row" sx={{ alignItems: "center" }} spacing={1}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: r.done ? '#4ade80' : 'text.secondary' }}>{r.val}</Typography>
            <Box sx={{ 
              width: 20, height: 20, borderRadius: '50%', border: '2px solid',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: r.done ? '#22c55e' : 'transparent', borderColor: r.done ? '#22c55e' : 'divider'
            }}>
              {r.done && <CheckCircle2 size={12} color="white" />}
            </Box>
          </Stack>
        </Stack>
      ))}
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", p: 1.5, borderRadius: 3, bgcolor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
        <Typography variant="caption" sx={{ color: '#fbbf24', fontWeight: 'bold' }}>🏆 New PR — Bench Press 80 kg!</Typography>
      </Stack>
    </Stack>,
    /* 2 – Progress Tracking */
    <Stack spacing={1.5} key="2">
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "flex-end", height: 96 }}>
        {[40, 55, 50, 72, 65, 90, 85].map((h, i) => (
          <Box key={i} sx={{ flex: 1, position: 'relative', height: `${h}%` }}>
            <Box sx={{ width: '100%', height: '100%', borderRadius: 1, bgcolor: '#6558F5', opacity: 0.8 }} />
            {i === 5 && <Box sx={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', bgcolor: '#fbbf24', color: 'white', fontSize: 9, fontWeight: 'bold', px: 0.5, py: 0.25, borderRadius: 1 }}>PR!</Box>}
          </Box>
        ))}
      </Stack>
      <Stack direction="row" sx={{ justifyContent: "space-between", typography: 'caption', color: 'text.secondary', fontSize: 9 }}>
        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'].map(m => <Typography key={m} component="span" variant="inherit">{m}</Typography>)}
      </Stack>
      <Grid container spacing={1}>
        {[{ l: 'Total Volume', v: '23,500 kg', c: '#6558F5' }, { l: 'Personal Record', v: '90 kg', c: '#f59e0b' }].map(({ l, v, c }) => (
          <Grid size={{ xs: 6 }} key={l}>
            <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{l}</Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: c }}>{v}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Stack>,
    /* 3 – Routine Builder */
    <Stack spacing={1} key="3">
      {['Push Day A', 'Pull Day B', 'Leg Day C'].map((r, i) => (
        <Stack key={i} direction="row" spacing={1.5} sx={{ alignItems: "center", p: 1.5, borderRadius: 3, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ width: 32, height: 32, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: ['#6558F5', '#8A80FF', '#12A88A'][i], color: 'white', fontWeight: 'bold', fontSize: 14 }}>
            {['P', 'P', 'L'][i]}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{r}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{[5, 4, 5][i]} exercises</Typography>
          </Box>
          <ArrowRight size={16} color={theme.palette.text.secondary} />
        </Stack>
      ))}
      <Button variant="outlined" sx={{ py: 1.5, borderRadius: 3, borderStyle: 'dashed', borderWidth: 2, fontWeight: 'bold' }}>
        + Add Routine
      </Button>
    </Stack>,
    /* 4 – Social Feed */
    <Stack spacing={1.5} key="4">
      {[{ name: 'Alex M.', workout: 'Push Day A', time: '1h 20m', vol: '12,400 kg', pr: true }, { name: 'Sara K.', workout: 'Leg Day', time: '55m', vol: '8,200 kg', pr: false }].map((p, i) => (
        <Box key={i} sx={{ p: 1.5, borderRadius: 3, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" sx={{ alignItems: "center" }} spacing={1} mb={1}>
            <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: ['#3b82f6', '#ec4899'][i], display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 12 }}>
              {p.name[0]}
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{p.name}</Typography>
              {p.pr && <Typography variant="caption" sx={{ color: '#fbbf24', fontWeight: 'bold', fontSize: 10 }}>🏆 PR Crushed!</Typography>}
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            {[p.workout, `⏱ ${p.time}`, `💪 ${p.vol}`].map(t => (
              <Box key={t} sx={{ px: 1, py: 0.5, borderRadius: 1, bgcolor: 'background.paper', fontSize: 10, fontWeight: 'bold', color: 'text.secondary' }}>
                {t}
              </Box>
            ))}
          </Stack>
        </Box>
      ))}
    </Stack>,
    /* 5 – Exercise Library */
    <Stack spacing={1} key="5">
      <Stack direction="row" spacing={1} mb={1}>
        {['All', 'Chest', 'Back', 'Legs'].map((f, i) => (
          <Box key={f} sx={{ px: 1.5, py: 0.5, borderRadius: 10, fontSize: 11, fontWeight: 'bold', bgcolor: i === 1 ? 'primary.main' : 'background.default', color: i === 1 ? 'white' : 'text.secondary', border: '1px solid', borderColor: i === 1 ? 'primary.main' : 'divider', cursor: 'pointer' }}>
            {f}
          </Box>
        ))}
      </Stack>
      {[{ name: 'Bench Press', muscle: 'Chest', eq: 'Barbell' }, { name: 'Incline DB Press', muscle: 'Chest', eq: 'Dumbbell' }, { name: 'Cable Fly', muscle: 'Chest', eq: 'Cable' }].map((e, i) => (
        <Stack key={i} direction="row" spacing={1.5} sx={{ alignItems: "center", p: 1.5, borderRadius: 3, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: 'rgba(101, 88, 245, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6558F5' }}>
            <Dumbbell size={16} />
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{e.name}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>{e.muscle} · {e.eq}</Typography>
          </Box>
        </Stack>
      ))}
    </Stack>,
    /* 6 – Insights */
    <Stack spacing={1.5} key="6">
      <Grid container spacing={1}>
        {[{ l: 'Weekly Workouts', v: '5', c: '#6558F5' }, { l: 'Avg Duration', v: '62 min', c: '#12A88A' }, { l: 'Total Volume', v: '84,200 kg', c: '#8A80FF' }, { l: 'Completed Sets', v: '74', c: '#f59e0b' }].map(({ l, v, c }) => (
          <Grid size={{ xs: 6 }} key={l}>
            <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10, mb: 0.5, display: 'block' }}>{l}</Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: c }}>{v}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
      <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 1, display: 'block' }}>Weekly Activity</Typography>
        <Stack direction="row" spacing={0.5}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
            <Box key={d} sx={{ flex: 1, textAlign: 'center' }}>
              <Box sx={{ width: '100%', aspectRatio: '1/1', borderRadius: 0.5, mb: 0.5, bgcolor: [true, true, false, true, true, false, false][i] ? '#6558F5' : 'divider' }} />
              <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>{d[0]}</Typography>
            </Box>
          ))}
        </Stack>
      </Box>
    </Stack>,
  ];

  return (
    <Grid container spacing={{ xs: 6, lg: 8 }} alignItems="center" direction={isReversed ? 'row-reverse' : 'row'}>
      {/* Text */}
      <Grid size={{ xs: 12, lg: 6 }}>
        <Stack spacing={3}>
          <Box sx={{ display: 'inline-flex', p: 1.5, borderRadius: 4, bgcolor: color.bg, color: color.main, alignSelf: 'flex-start' }}>
            <Icon size={28} />
          </Box>
          <Typography variant="h3" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.2 }}>
            {t(`features_page.f${index + 1}_title`)}
          </Typography>
          <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 400, lineHeight: 1.6 }}>
            {t(`features_page.f${index + 1}_desc`)}
          </Typography>
          <Stack spacing={1.5}>
            {bullets.map((b, i) => (
              <Stack key={i} direction="row" sx={{ alignItems: "center" }} spacing={1.5}>
                <CheckCircle2 size={20} color={theme.palette.primary.main} style={{ flexShrink: 0 }} />
                <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 500 }}>{b}</Typography>
              </Stack>
            ))}
          </Stack>
        </Stack>
      </Grid>
      {/* Visual */}
      <Grid size={{ xs: 12, lg: 6 }}>
        <Paper elevation={0} sx={{ p: 3, borderRadius: 6, border: `1px solid ${theme.palette.divider}`, bgcolor: 'background.paper', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)' }}>
          {productPreviews[index]}
        </Paper>
      </Grid>
    </Grid>
  );
};

const Features = () => {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <PublicLayout>
      {/* Hero */}
      <Box sx={{ position: 'relative', overflow: 'hidden', py: { xs: 10, sm: 14 }, px: { xs: 2, sm: 3 }, textAlign: 'center' }}>
        <Box sx={{ position: 'absolute', top: -128, left: '50%', transform: 'translateX(-50%)', width: 700, height: 400, borderRadius: '50%', bgcolor: 'rgba(101, 88, 245, 0.1)', filter: 'blur(80px)', pointerEvents: 'none' }} />
        
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
          <Stack spacing={3} sx={{ alignItems: "center" }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 2, py: 1, borderRadius: 10, bgcolor: `${theme.palette.primary.main}1A`, border: `1px solid ${theme.palette.primary.main}33` }}>
              <Typography variant="body2" sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>{t('features_page.hero_badge')}</Typography>
            </Box>
            
            <Typography variant="h2" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.2, fontSize: { xs: '2.5rem', sm: '3.75rem' } }}>
              {t('features_page.hero_title')}
            </Typography>
            
            <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 400, maxWidth: 600, mx: 'auto', lineHeight: 1.6 }}>
              {t('features_page.hero_sub')}
            </Typography>

            <Box pt={2}>
              <Button 
                component={Link} to="/login"
                variant="contained"
                size="large"
                endIcon={<ArrowRight size={18} />}
                sx={{ px: 4, py: 1.5, borderRadius: 3, fontWeight: 'bold', fontSize: '1rem', boxShadow: `0 10px 25px -5px ${theme.palette.primary.main}66` }}
              >
                {t('features_page.cta_btn')}
              </Button>
            </Box>
          </Stack>
        </Container>
      </Box>

      {/* Feature rows */}
      <Box sx={{ py: { xs: 6, sm: 10 }, px: { xs: 2, sm: 3 } }}>
        <Container maxWidth="lg">
          <Stack spacing={{ xs: 12, sm: 16 }}>
            {[0, 1, 2, 3, 4, 5].map(i => (
              <FeatureRow key={i} index={i} />
            ))}
          </Stack>
        </Container>
      </Box>

      {/* CTA */}
      <Box sx={{ px: { xs: 2, sm: 3 }, py: { xs: 10, sm: 12 } }}>
        <Container maxWidth="md">
          <Paper 
            elevation={0}
            sx={{ 
              borderRadius: 6, 
              background: `linear-gradient(to bottom right, ${theme.palette.primary.main}, #4f46e5)`,
              p: { xs: 6, sm: 8 }, 
              textAlign: 'center', 
              position: 'relative', 
              overflow: 'hidden' 
            }}
          >
            <Box sx={{ position: 'absolute', top: -32, right: -32, width: 128, height: 128, borderRadius: '50%', bgcolor: 'rgba(255, 255, 255, 0.1)', filter: 'blur(24px)' }} />
            <Box sx={{ position: 'relative' }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', mb: 3 }}>
                {t('features_page.cta_title')}
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
                {t('features_page.cta_btn')}
              </Button>
            </Box>
          </Paper>
        </Container>
      </Box>
    </PublicLayout>
  );
};

export default Features;
