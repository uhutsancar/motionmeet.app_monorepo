import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import AutoGraphRounded from "@mui/icons-material/AutoGraphRounded";
import GroupsRounded from "@mui/icons-material/GroupsRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { Link } from "react-router-dom";
import motionmeetLogo from "~/assets/motionmeet_logo.svg";

const benefitItems = [
  {
    icon: AutoGraphRounded,
    title: "Progress you can see",
    text: "Turn every session into clear, useful momentum.",
  },
  {
    icon: GroupsRounded,
    title: "A community that moves",
    text: "Share wins and train alongside people who get it.",
  },
  {
    icon: ShieldRounded,
    title: "Your data, protected",
    text: "Private by default and always under your control.",
  },
];

const AuthShell = ({ eyebrow, title, description, children }) => (
  <Box
    sx={{
      minHeight: "100dvh",
      display: "grid",
      gridTemplateColumns: { xs: "1fr", lg: "minmax(420px, 0.92fr) minmax(520px, 1.08fr)" },
      bgcolor: "background.default",
    }}
  >
    <Box
      sx={{
        display: { xs: "none", lg: "flex" },
        position: "relative",
        overflow: "hidden",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: "100dvh",
        p: { lg: 6, xl: 8 },
        color: "#FFFFFF",
        background: "linear-gradient(145deg, #15112F 0%, #302A78 52%, #166B64 120%)",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          width: 420,
          height: 420,
          top: -180,
          right: -120,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(138,128,255,.52), transparent 70%)",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          width: 460,
          height: 460,
          bottom: -240,
          left: -180,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(56,210,176,.32), transparent 70%)",
        }}
      />
      <Stack component={Link} to="/" direction="row" spacing={1.25} sx={{ zIndex: 1, alignItems: "center", color: "inherit", textDecoration: "none", width: "fit-content" }}>
        <Box
          sx={{
            display: "grid",
            placeItems: "center",
            width: 44,
            height: 44,
            borderRadius: 3.5,
            bgcolor: "rgba(255,255,255,.12)",
            border: "1px solid rgba(255,255,255,.18)",
          }}
        >
          <Box component="img" src={motionmeetLogo} alt="" sx={{ width: 30, height: 30 }} />
        </Box>
        <Typography sx={{ fontFamily: '"Sora", sans-serif', fontWeight: 800, fontSize: 20, letterSpacing: "-0.04em" }}>
          MotionMeet
        </Typography>
      </Stack>

      <Box sx={{ position: "relative", zIndex: 1, maxWidth: 560, my: 8 }}>
        <Chip
          label="BUILT FOR CONSISTENCY"
          sx={{
            mb: 3,
            color: "#D9D5FF",
            bgcolor: "rgba(255,255,255,.1)",
            border: "1px solid rgba(255,255,255,.16)",
            letterSpacing: "0.11em",
            fontSize: 11,
          }}
        />
        <Typography variant="h2" sx={{ mb: 2.5, fontSize: { lg: 46, xl: 56 }, lineHeight: 1.06, color: "#FFFFFF" }}>
          Your strongest chapter starts with one session.
        </Typography>
        <Typography sx={{ mb: 5, maxWidth: 510, color: "rgba(255,255,255,.7)", fontSize: 17, lineHeight: 1.7 }}>
          Plan smarter workouts, understand your progress and meet a community that keeps you moving.
        </Typography>
        <Stack spacing={1.5}>
          {benefitItems.map(({ icon: Icon, title: itemTitle, text }) => (
            <Stack
              key={itemTitle}
              direction="row"
              spacing={1.75}
              sx={{
                alignItems: "center",
                p: 1.75,
                borderRadius: 4,
                bgcolor: "rgba(255,255,255,.075)",
                border: "1px solid rgba(255,255,255,.11)",
                backdropFilter: "blur(12px)",
              }}
            >
              <Box sx={{ display: "grid", placeItems: "center", width: 42, height: 42, borderRadius: 3, bgcolor: "rgba(255,255,255,.12)", flexShrink: 0 }}>
                <Icon sx={{ fontSize: 21, color: "#B9FFF0" }} />
              </Box>
              <Box>
                <Typography sx={{ color: "#FFFFFF", fontWeight: 800, fontSize: 14 }}>{itemTitle}</Typography>
                <Typography sx={{ color: "rgba(255,255,255,.58)", fontSize: 12.5 }}>{text}</Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      </Box>

      <Typography sx={{ position: "relative", zIndex: 1, color: "rgba(255,255,255,.44)", fontSize: 12 }}>
        © {new Date().getFullYear()} MotionMeet. Move with purpose.
      </Typography>
    </Box>

    <Box
      sx={{
        position: "relative",
        display: "flex",
        minWidth: 0,
        minHeight: "100dvh",
        alignItems: "center",
        justifyContent: "center",
        px: { xs: 2, sm: 4, xl: 8 },
        py: { xs: 3, sm: 6 },
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: (theme) => `radial-gradient(circle at 86% 8%, ${alpha(theme.palette.primary.main, 0.1)}, transparent 28%)`,
        },
      }}
    >
      <Box sx={{ position: "relative", width: "100%", maxWidth: 470 }}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: { xs: 5, sm: 7 } }}>
          <ButtonBase
            component={Link}
            to="/"
            sx={{ color: "text.secondary", borderRadius: 2.5, py: 0.75, pr: 1.25, gap: 0.75, fontSize: 13, fontWeight: 800 }}
          >
            <ArrowBackRounded sx={{ fontSize: 18 }} />
            Back home
          </ButtonBase>
          <Stack component={Link} to="/" direction="row" spacing={0.8} sx={{ display: { lg: "none" }, alignItems: "center", color: "inherit", textDecoration: "none" }}>
            <Box component="img" src={motionmeetLogo} alt="" sx={{ width: 28, height: 28 }} />
            <Typography sx={{ fontFamily: '"Sora", sans-serif', fontWeight: 800, fontSize: 15 }}>MotionMeet</Typography>
          </Stack>
        </Stack>

        <Typography variant="overline" color="primary" sx={{ fontWeight: 800, letterSpacing: "0.12em" }}>
          {eyebrow}
        </Typography>
        <Typography variant="h3" sx={{ mt: 0.5, mb: 1.25, fontSize: { xs: 32, sm: 38 } }}>
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 4, maxWidth: 420 }}>
          {description}
        </Typography>
        {children}
      </Box>
    </Box>
  </Box>
);

export default AuthShell;
