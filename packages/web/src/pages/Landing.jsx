import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha, useTheme } from "@mui/material/styles";
import {
  Activity,
  BarChart3,
  Dumbbell,
  Flame,
  Heart,
  Sparkles,
  Target,
  TimerReset,
  TrendingUp,
  Trophy,
  Users2,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const people = [
  { name: "Maya", color: "#F7695E" },
  { name: "Alex", color: "#00A98F" },
  { name: "Jin", color: "#6457F5" },
  { name: "Noa", color: "#E89614" },
];

const Metric = ({ icon: Icon, label, value, accent }) => (
  <Box
    sx={{
      minWidth: 0,
      p: 1.5,
      borderRadius: 3.5,
      bgcolor: "background.paper",
      border: 1,
      borderColor: "divider",
    }}
  >
    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 1 }}>
      <Icon size={14} color={accent} strokeWidth={2.4} />
      <Typography sx={{ color: "text.disabled", fontSize: 10.5, fontWeight: 800, letterSpacing: ".05em" }}>
        {label}
      </Typography>
    </Stack>
    <Typography sx={{ fontFamily: '"Manrope", sans-serif', fontWeight: 800, fontSize: 18, letterSpacing: "-.04em" }}>
      {value}
    </Typography>
  </Box>
);

const HeroProduct = () => {
  const theme = useTheme();

  return (
    <Box sx={{ position: "relative", minHeight: { xs: 465, md: 580 } }}>
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          inset: { xs: "7% -15% 4%", md: "5% -12% 3%" },
          borderRadius: "48%",
          filter: "blur(2px)",
          background: `radial-gradient(circle at 28% 28%, ${alpha(theme.palette.primary.main, 0.3)}, transparent 35%), radial-gradient(circle at 75% 70%, ${alpha(theme.palette.secondary.main, 0.24)}, transparent 38%)`,
        }}
      />

      <Paper
        className="motion-float-delayed"
        elevation={0}
        sx={{
          "--float-rotate": "-2deg",
          position: "absolute",
          inset: { xs: "18px 0 auto 6%", sm: "22px 4% auto 9%" },
          height: { xs: 356, sm: 410, md: 458 },
          overflow: "hidden",
          borderRadius: { xs: 5, sm: 7 },
          color: "#F8FAF7",
          background: "linear-gradient(145deg, #11192D, #080D19 70%)",
          border: "1px solid rgba(255,255,255,.12)",
          boxShadow: "0 34px 90px rgba(8,13,25,.28)",
        }}
      >
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", px: { xs: 2, sm: 2.75 }, py: 2 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: "#C8F768", boxShadow: "0 0 0 6px rgba(200,247,104,.1)" }} />
            <Typography sx={{ fontWeight: 800, fontSize: 13 }}>Live session</Typography>
          </Stack>
          <Chip
            label="38:24"
            size="small"
            sx={{ bgcolor: "rgba(255,255,255,.08)", color: "#F8FAF7", border: "1px solid rgba(255,255,255,.1)" }}
          />
        </Stack>
        <Divider sx={{ borderColor: "rgba(255,255,255,.08)" }} />
        <Box sx={{ p: { xs: 2, sm: 2.75 } }}>
          <Typography sx={{ color: "rgba(255,255,255,.48)", fontSize: 11, fontWeight: 800, letterSpacing: ".11em" }}>
            UPPER BODY · DAY 03
          </Typography>
          <Typography sx={{ mt: 0.5, fontFamily: '"Manrope", sans-serif', fontSize: { xs: 23, sm: 29 }, fontWeight: 800, letterSpacing: "-.04em" }}>
            Push the pace.
          </Typography>

          <Stack spacing={1.25} sx={{ mt: 2.5 }}>
            {[
              { name: "Bench press", meta: "4 sets · 72.5 kg", done: true },
              { name: "Incline press", meta: "3 sets · 26 kg", done: true },
              { name: "Cable fly", meta: "3 sets · 12 reps", active: true },
            ].map((item, index) => (
              <Stack
                key={item.name}
                direction="row"
                sx={{
                  alignItems: "center",
                  p: 1.35,
                  borderRadius: 3.25,
                  color: item.active ? "#12182A" : "#F8FAF7",
                  bgcolor: item.active ? "#C8F768" : "rgba(255,255,255,.055)",
                  border: `1px solid ${item.active ? "rgba(200,247,104,.8)" : "rgba(255,255,255,.08)"}`,
                }}
              >
                <Box
                  sx={{
                    display: "grid",
                    placeItems: "center",
                    width: 38,
                    height: 38,
                    mr: 1.25,
                    borderRadius: 2.5,
                    color: item.active ? "#12182A" : index === 0 ? "#C8F768" : "#9187FF",
                    bgcolor: item.active ? "rgba(18,24,42,.09)" : "rgba(255,255,255,.07)",
                  }}
                >
                  {item.done ? <CheckRounded fontSize="small" /> : <Dumbbell size={18} />}
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{item.name}</Typography>
                  <Typography sx={{ opacity: 0.58, fontSize: 11 }}>{item.meta}</Typography>
                </Box>
                {item.active && (
                  <Box className="motion-pulse" sx={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: "50%", bgcolor: "#12182A", color: "#C8F768" }}>
                    <PlayArrowRounded fontSize="small" />
                  </Box>
                )}
              </Stack>
            ))}
          </Stack>
        </Box>
      </Paper>

      <Paper
        className="motion-float"
        elevation={0}
        sx={{
          position: "absolute",
          width: { xs: 168, sm: 210 },
          right: { xs: -4, sm: 0 },
          bottom: { xs: 18, sm: 8, md: 16 },
          p: { xs: 1.5, sm: 2 },
          borderRadius: 4,
          bgcolor: (muiTheme) => alpha(muiTheme.palette.background.paper, 0.94),
          backdropFilter: "blur(16px)",
          border: 1,
          borderColor: "divider",
          boxShadow: 4,
        }}
      >
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1.75 }}>
          <Box>
            <Typography sx={{ color: "text.disabled", fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em" }}>THIS WEEK</Typography>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: 18, sm: 22 }, letterSpacing: "-.04em" }}>4 sessions</Typography>
          </Box>
          <Box sx={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 2.5, bgcolor: (muiTheme) => alpha(muiTheme.palette.primary.main, 0.12), color: "primary.main" }}>
            <TrendingUp size={18} />
          </Box>
        </Stack>
        <Stack direction="row" spacing={0.75} sx={{ height: 70, alignItems: "flex-end" }}>
          {[38, 64, 47, 82, 58, 92, 72].map((height, index) => (
            <Box
              key={index}
              sx={{
                width: "100%",
                height: `${height}%`,
                borderRadius: "6px 6px 2px 2px",
                bgcolor: index === 5 ? "#F7695E" : "primary.main",
                opacity: index < 3 ? 0.42 + index * 0.16 : 1,
              }}
            />
          ))}
        </Stack>
      </Paper>

      <Paper
        className="motion-float-delayed"
        elevation={0}
        sx={{
          position: "absolute",
          left: { xs: 0, sm: 2 },
          bottom: { xs: 6, sm: 40, md: 58 },
          px: 1.25,
          py: 1,
          borderRadius: 4,
          bgcolor: "#FFFFFF",
          color: "#12182A",
          boxShadow: "0 16px 42px rgba(8,13,25,.18)",
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Box sx={{ display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: 2.5, bgcolor: "#FFF0EE", color: "#F7695E" }}>
            <Trophy size={18} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 10, color: "#6B7280", fontWeight: 700 }}>NEW PERSONAL BEST</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 900 }}>Bench press · 80 kg</Typography>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
};

const SectionIntro = ({ eyebrow, title, description, align = "left" }) => (
  <Box sx={{ maxWidth: 700, mx: align === "center" ? "auto" : 0, textAlign: align, mb: 5 }}>
    <Typography variant="overline" color="primary" sx={{ fontWeight: 800, letterSpacing: ".14em" }}>
      {eyebrow}
    </Typography>
    <Typography variant="h2" sx={{ mt: 1, fontSize: { xs: 36, md: 52 }, lineHeight: 1.05 }}>
      {title}
    </Typography>
    <Typography sx={{ mt: 2, color: "text.secondary", fontSize: { xs: 16, md: 18 }, lineHeight: 1.7 }}>
      {description}
    </Typography>
  </Box>
);

const FeatureCard = ({ icon: Icon, eyebrow, title, description, color, children, large = false }) => (
  <Paper
    component="article"
    variant="outlined"
    sx={{
      gridColumn: { md: large ? "span 2" : "span 1" },
      position: "relative",
      minHeight: large ? 390 : 330,
      overflow: "hidden",
      p: { xs: 3, sm: 4 },
      borderRadius: 6,
      "&:hover": {
        transform: "translateY(-5px)",
        borderColor: color,
        boxShadow: 4,
      },
    }}
  >
    <Box sx={{ display: "grid", placeItems: "center", width: 48, height: 48, borderRadius: 3.5, bgcolor: alpha(color, 0.12), color, mb: 3 }}>
      <Icon size={23} strokeWidth={2.2} />
    </Box>
    <Typography sx={{ color: "text.disabled", fontSize: 10.5, fontWeight: 900, letterSpacing: ".13em" }}>{eyebrow}</Typography>
    <Typography variant="h4" sx={{ mt: 0.75, mb: 1.5, fontSize: { xs: 27, md: 32 } }}>{title}</Typography>
    <Typography color="text.secondary" sx={{ maxWidth: 520, lineHeight: 1.75 }}>{description}</Typography>
    {children}
  </Paper>
);

const Landing = () => {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <PublicLayout>
      <Box
        component="section"
        sx={{
          position: "relative",
          overflow: "hidden",
          pt: { xs: 14, sm: 17, md: 20 },
          pb: { xs: 8, md: 12 },
          "&::before": {
            content: '""',
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: `radial-gradient(circle at 16% 16%, ${alpha(theme.palette.primary.main, 0.13)}, transparent 28%), radial-gradient(circle at 86% 30%, ${alpha(theme.palette.secondary.main, 0.11)}, transparent 25%)`,
          },
        }}
      >
        <Box className="motion-grid" sx={{ position: "absolute", inset: 0, opacity: 0.42, pointerEvents: "none" }} />
        <Container maxWidth="lg" sx={{ position: "relative" }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, .94fr) minmax(430px, 1.06fr)" }, gap: { xs: 6, md: 4, lg: 8 }, alignItems: "center" }}>
            <Box>
              <Chip
                icon={<Sparkles size={15} />}
                label={t("landing.hero_badge")}
                sx={{ mb: 3, bgcolor: alpha(theme.palette.primary.main, 0.09), color: "primary.main", border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}` }}
              />
              <Typography variant="h1" sx={{ maxWidth: 720, fontSize: { xs: 49, sm: 67, md: 73, lg: 82 }, lineHeight: 0.98 }}>
                Train with purpose.{" "}
                <Box component="span" sx={{ color: "primary.main", position: "relative", whiteSpace: { sm: "nowrap" } }}>
                  Move together.
                  <Box sx={{ position: "absolute", left: 2, right: 0, bottom: 2, height: 6, borderRadius: 5, bgcolor: "#C8F768", zIndex: -1, transform: "rotate(-1deg)" }} />
                </Box>
              </Typography>
              <Typography sx={{ mt: 3, maxWidth: 610, color: "text.secondary", fontSize: { xs: 17, sm: 19 }, lineHeight: 1.7 }}>
                Track every session, understand what is working and share the momentum with people who keep you showing up.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mt: 4, alignItems: { sm: "center" } }}>
                <Button component={Link} to="/signup" variant="contained" size="large" endIcon={<ArrowForwardRounded />} sx={{ minHeight: 56, px: 3 }}>
                  {t("landing.hero_cta_primary")}
                </Button>
                <Button component={Link} to="/features" variant="outlined" size="large" startIcon={<PlayArrowRounded />} sx={{ minHeight: 56, px: 3 }}>
                  See it in motion
                </Button>
              </Stack>
              <Stack direction="row" spacing={1.75} sx={{ mt: 4, alignItems: "center" }}>
                <Stack direction="row">
                  {people.map((person, index) => (
                    <Avatar
                      key={person.name}
                      sx={{ width: 34, height: 34, ml: index ? -0.9 : 0, border: 2, borderColor: "background.default", bgcolor: person.color, fontSize: 11, fontWeight: 900 }}
                    >
                      {person.name[0]}
                    </Avatar>
                  ))}
                </Stack>
                <Box>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 800 }}>Built for real consistency</Typography>
                  <Typography sx={{ color: "text.disabled", fontSize: 11.5 }}>Training · progress · people</Typography>
                </Box>
              </Stack>
            </Box>
            <HeroProduct />
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ pb: { xs: 10, md: 14 } }}>
        <Paper
          variant="outlined"
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
            gap: 1,
            p: 1,
            borderRadius: 5,
            bgcolor: alpha(theme.palette.background.paper, 0.68),
          }}
        >
          <Metric icon={Activity} label="ACTIVE ATHLETES" value="50K+" accent={theme.palette.primary.main} />
          <Metric icon={Dumbbell} label="SESSIONS LOGGED" value="1M+" accent={theme.palette.secondary.main} />
          <Metric icon={Flame} label="WEEKLY MOMENTUM" value="87%" accent="#F7695E" />
          <Metric icon={Heart} label="COMMUNITY RATING" value="4.9 / 5" accent="#E89614" />
        </Paper>
      </Container>

      <Box component="section" sx={{ py: { xs: 10, md: 15 }, bgcolor: "background.paper", borderBlock: 1, borderColor: "divider" }}>
        <Container maxWidth="lg">
          <SectionIntro
            eyebrow="ONE CONNECTED TRAINING SPACE"
            title="Everything important, without the noise."
            description="MotionMeet connects the practical parts of training with the human reasons you keep going."
            align="center"
          />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2.5 }}>
            <FeatureCard
              icon={Zap}
              eyebrow="TRAIN"
              title="Log fast. Stay focused."
              description="Build a routine, record sets and keep your session moving with a flow designed for the gym floor."
              color={theme.palette.primary.main}
              large
            >
              <Box sx={{ position: "absolute", right: { xs: -58, sm: 26 }, bottom: -48, width: { xs: 270, sm: 340 }, p: 2, borderRadius: 5, color: "#F8FAF7", bgcolor: "#0C1323", transform: "rotate(-3deg)", boxShadow: 5 }}>
                <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                  <Typography sx={{ fontWeight: 800 }}>Lat pulldown</Typography>
                  <Typography sx={{ color: "#C8F768", fontSize: 12, fontWeight: 800 }}>03 / 04</Typography>
                </Stack>
                {[["60 kg", "10"], ["65 kg", "8"], ["65 kg", "8"]].map(([weight, reps], index) => (
                  <Stack key={index} direction="row" sx={{ alignItems: "center", p: 1, mb: 0.75, borderRadius: 2.5, bgcolor: index === 2 ? "#C8F768" : "rgba(255,255,255,.06)", color: index === 2 ? "#12182A" : "inherit" }}>
                    <Typography sx={{ width: 28, fontWeight: 800 }}>{index + 1}</Typography>
                    <Typography sx={{ flex: 1, fontWeight: 700 }}>{weight}</Typography>
                    <Typography sx={{ fontWeight: 800 }}>{reps} reps</Typography>
                  </Stack>
                ))}
              </Box>
            </FeatureCard>
            <FeatureCard
              icon={BarChart3}
              eyebrow="UNDERSTAND"
              title="Progress that explains itself."
              description="See volume, consistency and personal bests at a glance—then use the signal to plan what comes next."
              color={theme.palette.secondary.main}
            >
              <Stack direction="row" spacing={0.7} sx={{ position: "absolute", left: 32, right: 32, bottom: 32, height: 92, alignItems: "flex-end" }}>
                {[28, 46, 38, 63, 54, 78, 70, 92].map((height, index) => (
                  <Box key={index} sx={{ flex: 1, height: `${height}%`, borderRadius: "7px 7px 2px 2px", bgcolor: index === 7 ? "#C8F768" : "secondary.main", opacity: 0.42 + index * 0.07 }} />
                ))}
              </Stack>
            </FeatureCard>
            <FeatureCard
              icon={Users2}
              eyebrow="CONNECT"
              title="A feed with a purpose."
              description="Celebrate a PR, ask for feedback and find athletes whose work makes your own feel possible."
              color="#F7695E"
            >
              <Stack spacing={1} sx={{ position: "absolute", left: 28, right: 28, bottom: 26 }}>
                {[
                  ["MJ", "Mira hit a new 5K best", "Give some love", "#6457F5"],
                  ["AT", "Arda finished Push Day", "View session", "#00A98F"],
                ].map(([initials, title, action, color]) => (
                  <Stack key={title} direction="row" sx={{ alignItems: "center", p: 1.2, borderRadius: 3, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
                    <Avatar sx={{ width: 34, height: 34, mr: 1.1, bgcolor: color, fontSize: 10 }}>{initials}</Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography noWrap sx={{ fontSize: 12, fontWeight: 800 }}>{title}</Typography>
                      <Typography sx={{ color: "text.disabled", fontSize: 10.5 }}>{action}</Typography>
                    </Box>
                    <Heart size={16} color="#F7695E" />
                  </Stack>
                ))}
              </Stack>
            </FeatureCard>
          </Box>
        </Container>
      </Box>

      <Box component="section" sx={{ py: { xs: 10, md: 15 }, position: "relative", overflow: "hidden" }}>
        <Container maxWidth="lg">
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, .9fr) minmax(420px, 1.1fr)" }, gap: { xs: 6, md: 9 }, alignItems: "center" }}>
            <Box>
              <SectionIntro
                eyebrow="DESIGNED AROUND YOUR RHYTHM"
                title="From intention to insight in one flow."
                description="Less tapping. Less hunting. More time doing the work and understanding the result."
              />
              <Stack spacing={2.5}>
                {[
                  [Target, "Plan it", "Shape sessions around your goal, time and equipment."],
                  [TimerReset, "Train it", "Log with a focused interface that stays out of the way."],
                  [TrendingUp, "Learn from it", "Turn every workout into useful, motivating context."],
                ].map(([Icon, title, text], index) => (
                  <Stack key={title} direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
                    <Box sx={{ display: "grid", placeItems: "center", flexShrink: 0, width: 46, height: 46, borderRadius: 3.5, bgcolor: index === 0 ? "#C8F768" : index === 1 ? "primary.main" : "secondary.main", color: index === 0 ? "#12182A" : "#FFFFFF", boxShadow: 2 }}>
                      <Icon size={21} />
                    </Box>
                    <Box>
                      <Typography variant="h6">{title}</Typography>
                      <Typography color="text.secondary" sx={{ mt: 0.35, lineHeight: 1.65 }}>{text}</Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </Box>
            <Box sx={{ position: "relative", minHeight: { xs: 420, sm: 500 } }}>
              <Paper elevation={0} sx={{ position: "absolute", inset: "2% 4% 2% 8%", borderRadius: 8, bgcolor: "#0B1020", color: "#F8FAF7", overflow: "hidden", border: "1px solid rgba(255,255,255,.11)", boxShadow: "0 35px 90px rgba(8,13,25,.22)" }}>
                <Box className="motion-grid" sx={{ position: "absolute", inset: 0, opacity: 0.13 }} />
                <Box sx={{ position: "relative", p: { xs: 3, sm: 4.5 } }}>
                  <Typography sx={{ color: "rgba(255,255,255,.48)", fontSize: 11, fontWeight: 900, letterSpacing: ".12em" }}>WEEK 07 · MOMENTUM</Typography>
                  <Typography sx={{ mt: 1, fontFamily: '"Manrope", sans-serif', fontSize: { xs: 30, sm: 39 }, lineHeight: 1.08, fontWeight: 800, letterSpacing: "-.045em" }}>You are stronger than last month.</Typography>
                  <Stack direction="row" spacing={1.25} sx={{ mt: 4 }}>
                    <Box sx={{ flex: 1, p: 2, borderRadius: 4, bgcolor: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)" }}>
                      <Typography sx={{ color: "#C8F768", fontSize: 27, fontWeight: 900 }}>+12%</Typography>
                      <Typography sx={{ color: "rgba(255,255,255,.48)", fontSize: 11 }}>weekly volume</Typography>
                    </Box>
                    <Box sx={{ flex: 1, p: 2, borderRadius: 4, bgcolor: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)" }}>
                      <Typography sx={{ color: "#9187FF", fontSize: 27, fontWeight: 900 }}>18</Typography>
                      <Typography sx={{ color: "rgba(255,255,255,.48)", fontSize: 11 }}>day streak</Typography>
                    </Box>
                  </Stack>
                  <Box sx={{ mt: 3.5, p: 2, borderRadius: 4, bgcolor: "rgba(255,255,255,.055)", border: "1px solid rgba(255,255,255,.08)" }}>
                    <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                      <Box>
                        <Typography sx={{ fontWeight: 800 }}>Consistency score</Typography>
                        <Typography sx={{ color: "rgba(255,255,255,.45)", fontSize: 11.5 }}>Your best month yet</Typography>
                      </Box>
                      <Typography sx={{ color: "#C8F768", fontWeight: 900, fontSize: 24 }}>92</Typography>
                    </Stack>
                    <Box sx={{ mt: 1.5, height: 7, borderRadius: 10, bgcolor: "rgba(255,255,255,.08)", overflow: "hidden" }}>
                      <Box sx={{ width: "92%", height: "100%", borderRadius: "inherit", background: "linear-gradient(90deg, #9187FF, #C8F768)" }} />
                    </Box>
                  </Box>
                </Box>
              </Paper>
            </Box>
          </Box>
        </Container>
      </Box>

      <Box component="section" sx={{ py: { xs: 10, md: 14 }, bgcolor: "background.paper", borderBlock: 1, borderColor: "divider" }}>
        <Container maxWidth="lg">
          <SectionIntro
            eyebrow="REAL PEOPLE. REAL MOMENTUM."
            title="A stronger habit feels better together."
            description="MotionMeet is made for people who care more about showing up than showing off."
            align="center"
          />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
            {[
              ["“My training finally feels organized without feeling rigid.”", "Maya R.", "Hybrid athlete", "#F7695E"],
              ["“The progress view gives me exactly the push I need for the next session.”", "Jon B.", "Strength athlete", "#6457F5"],
              ["“It feels social, but every interaction still comes back to the work.”", "Ece A.", "Runner & lifter", "#00A98F"],
            ].map(([quote, name, role, color], index) => (
              <Paper key={name} variant="outlined" sx={{ p: 3.25, borderRadius: 5, minHeight: 240, display: "flex", flexDirection: "column", justifyContent: "space-between", transform: { md: index === 1 ? "translateY(-12px)" : "none" } }}>
                <Box>
                  <Stack direction="row" spacing={0.3} sx={{ mb: 2.5 }}>
                    {[0, 1, 2, 3, 4].map((star) => <Box key={star} sx={{ color: "#E89614", fontSize: 15 }}>★</Box>)}
                  </Stack>
                  <Typography sx={{ fontFamily: '"Manrope", sans-serif', fontWeight: 700, fontSize: 18, lineHeight: 1.6 }}>{quote}</Typography>
                </Box>
                <Stack direction="row" spacing={1.2} sx={{ alignItems: "center", mt: 3 }}>
                  <Avatar sx={{ bgcolor: color, width: 40, height: 40, fontSize: 12, fontWeight: 900 }}>{name.split(" ").map((part) => part[0]).join("")}</Avatar>
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 900 }}>{name}</Typography>
                    <Typography sx={{ color: "text.disabled", fontSize: 11.5 }}>{role}</Typography>
                  </Box>
                </Stack>
              </Paper>
            ))}
          </Box>
        </Container>
      </Box>

      <Box component="section" sx={{ py: { xs: 10, md: 13 } }}>
        <Container maxWidth="lg">
          <Paper
            elevation={0}
            sx={{
              position: "relative",
              overflow: "hidden",
              p: { xs: 4, sm: 6, md: 8 },
              borderRadius: { xs: 6, md: 8 },
              color: "#F8FAF7",
              background: "linear-gradient(135deg, #11192D 0%, #1B2250 55%, #113A39 120%)",
              boxShadow: "0 34px 80px rgba(8,13,25,.18)",
            }}
          >
            <Box className="motion-grid" sx={{ position: "absolute", inset: 0, opacity: 0.1 }} />
            <Box sx={{ position: "absolute", width: 330, height: 330, borderRadius: "50%", right: -100, top: -180, bgcolor: "rgba(200,247,104,.16)", filter: "blur(3px)" }} />
            <Box sx={{ position: "relative", maxWidth: 760 }}>
              <Chip label="YOUR NEXT SESSION STARTS HERE" sx={{ mb: 3, color: "#C8F768", bgcolor: "rgba(200,247,104,.08)", border: "1px solid rgba(200,247,104,.18)" }} />
              <Typography variant="h2" sx={{ color: "inherit", fontSize: { xs: 39, md: 59 }, lineHeight: 1.04 }}>
                Turn today’s effort into tomorrow’s momentum.
              </Typography>
              <Typography sx={{ mt: 2, maxWidth: 630, color: "rgba(255,255,255,.64)", fontSize: { xs: 16, md: 18 }, lineHeight: 1.7 }}>
                Start free, build your first routine and meet the people who will keep the streak alive.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} sx={{ mt: 4 }}>
                <Button component={Link} to="/signup" size="large" endIcon={<ArrowForwardRounded />} sx={{ minHeight: 54, bgcolor: "#C8F768", color: "#111827", "&:hover": { bgcolor: "#D5FF7F" } }}>
                  Create your account
                </Button>
                <Button component={Link} to="/features" size="large" sx={{ minHeight: 54, color: "#FFFFFF", border: "1px solid rgba(255,255,255,.18)" }}>
                  Explore the experience
                </Button>
              </Stack>
            </Box>
          </Paper>
        </Container>
      </Box>
    </PublicLayout>
  );
};

export default Landing;
