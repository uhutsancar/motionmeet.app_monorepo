import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import AutoGraphRounded from "@mui/icons-material/AutoGraphRounded";
import GroupsRounded from "@mui/icons-material/GroupsRounded";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { Link } from "react-router";
import type { ReactNode } from "react";
import motionmeetLogo from "~/assets/motionmeet_logo.svg";

interface AuthShellProps {
  eyebrow: ReactNode;
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
}

const AuthShell = ({ eyebrow, title, description, children }: AuthShellProps) => (
  <Box
    sx={{
      minHeight: "100dvh",
      display: "grid",
      gridTemplateColumns: { xs: "1fr", lg: "minmax(480px, .98fr) minmax(520px, 1.02fr)" },
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
        p: { lg: 5, xl: 7 },
        color: "#F8FAF7",
        background: "linear-gradient(145deg, #11192D 0%, #171F42 54%, #103632 120%)",
      }}
    >
      <Box className="motion-grid" sx={{ position: "absolute", inset: 0, opacity: 0.1 }} />
      <Box sx={{ position: "absolute", width: 420, height: 420, top: -220, right: -140, borderRadius: "50%", bgcolor: "rgba(145,135,255,.22)", filter: "blur(2px)" }} />
      <Box sx={{ position: "absolute", width: 390, height: 390, bottom: -230, left: -170, borderRadius: "50%", bgcolor: "rgba(200,247,104,.12)", filter: "blur(2px)" }} />

      <Stack component={Link} to="/" direction="row" spacing={1.25} sx={{ position: "relative", zIndex: 1, alignItems: "center", color: "inherit", textDecoration: "none", width: "fit-content" }}>
        <Box component="img" src={motionmeetLogo} alt="" sx={{ width: 45, height: 45 }} />
        <Box>
          <Typography sx={{ fontFamily: '"Manrope", sans-serif', fontWeight: 800, fontSize: 19, letterSpacing: "-.05em", lineHeight: 1.05 }}>
            MotionMeet
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,.42)", fontSize: 9, fontWeight: 800, letterSpacing: ".14em" }}>
            MOVE WITH PURPOSE
          </Typography>
        </Box>
      </Stack>

      <Box sx={{ position: "relative", zIndex: 1, my: 6 }}>
        <Chip
          label="YOUR TRAINING, CONNECTED"
          sx={{ mb: 3, color: "#C8F768", bgcolor: "rgba(200,247,104,.08)", border: "1px solid rgba(200,247,104,.16)", letterSpacing: ".1em", fontSize: 10 }}
        />
        <Typography variant="h2" sx={{ maxWidth: 610, color: "#F8FAF7", fontSize: { lg: 48, xl: 58 }, lineHeight: 1.02 }}>
          One place for the work and the people behind it.
        </Typography>
        <Typography sx={{ mt: 2.5, maxWidth: 540, color: "rgba(255,255,255,.6)", fontSize: 16.5, lineHeight: 1.7 }}>
          Plan the session, capture the progress and carry the momentum into your community.
        </Typography>

        <Box sx={{ position: "relative", mt: 5, minHeight: 260, maxWidth: 570 }}>
          <Paper
            elevation={0}
            sx={{
              position: "absolute",
              inset: "0 8% 14% 0",
              p: 2.25,
              borderRadius: 5,
              bgcolor: "rgba(255,255,255,.07)",
              color: "#F8FAF7",
              border: "1px solid rgba(255,255,255,.1)",
              backdropFilter: "blur(14px)",
            }}
          >
            <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
              <Box>
                <Typography sx={{ color: "rgba(255,255,255,.42)", fontSize: 10, fontWeight: 800, letterSpacing: ".11em" }}>TODAY · UPPER BODY</Typography>
                <Typography sx={{ mt: 0.5, fontFamily: '"Manrope", sans-serif', fontWeight: 800, fontSize: 22 }}>Build the momentum.</Typography>
              </Box>
              <Box sx={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 3, bgcolor: "#C8F768", color: "#12182A" }}>
                <AutoGraphRounded fontSize="small" />
              </Box>
            </Stack>
            <Stack spacing={1} sx={{ mt: 2 }}>
              {([
                ["Bench press", "4 × 8", true],
                ["Shoulder press", "3 × 10", true],
                ["Cable fly", "3 × 12", false],
              ] as const).map(([name, detail, done]) => (
                <Stack key={name} direction="row" sx={{ alignItems: "center", p: 1, borderRadius: 2.5, bgcolor: done ? "rgba(255,255,255,.045)" : "#C8F768", color: done ? "inherit" : "#12182A" }}>
                  <Box sx={{ display: "grid", placeItems: "center", width: 27, height: 27, mr: 1, borderRadius: 2, bgcolor: done ? "rgba(145,135,255,.15)" : "rgba(18,24,42,.1)", color: done ? "#9187FF" : "inherit" }}>
                    <CheckRounded sx={{ fontSize: 16 }} />
                  </Box>
                  <Typography sx={{ flex: 1, fontSize: 12.5, fontWeight: 800 }}>{name}</Typography>
                  <Typography sx={{ fontSize: 11, fontWeight: 800, opacity: 0.58 }}>{detail}</Typography>
                </Stack>
              ))}
            </Stack>
          </Paper>

          <Paper
            className="motion-float"
            elevation={0}
            sx={{
              position: "absolute",
              right: 0,
              bottom: 0,
              width: 220,
              p: 1.5,
              borderRadius: 4,
              bgcolor: "#FFFFFF",
              color: "#12182A",
              boxShadow: "0 20px 50px rgba(0,0,0,.2)",
            }}
          >
            <Stack direction="row" spacing={1.1} sx={{ alignItems: "center" }}>
              <Box sx={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 2.5, bgcolor: "#FFF0EE", color: "#F7695E" }}>
                <GroupsRounded fontSize="small" />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 11.5, fontWeight: 900 }}>Maya cheered your PR</Typography>
                <Typography sx={{ color: "#8C94A2", fontSize: 10.5 }}>Keep the streak alive 🔥</Typography>
              </Box>
            </Stack>
          </Paper>
        </Box>
      </Box>

      <Typography sx={{ position: "relative", zIndex: 1, color: "rgba(255,255,255,.38)", fontSize: 11.5 }}>
        © {new Date().getFullYear()} MotionMeet · Train, track and connect.
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
        py: { xs: 2.5, sm: 5 },
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          width: 440,
          height: 440,
          right: -260,
          top: -220,
          borderRadius: "50%",
          background: (theme) => alpha(theme.palette.primary.main, 0.09),
        },
      }}
    >
      <Box sx={{ position: "relative", width: "100%", maxWidth: 500 }}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: { xs: 3, sm: 4.5 } }}>
          <ButtonBase
            component={Link}
            to="/"
            sx={{ color: "text.secondary", borderRadius: 2.5, py: 0.75, pr: 1.25, gap: 0.75, fontSize: 13, fontWeight: 800 }}
          >
            <ArrowBackRounded sx={{ fontSize: 18 }} />
            Back home
          </ButtonBase>
          <Stack component={Link} to="/" direction="row" spacing={0.8} sx={{ display: { lg: "none" }, alignItems: "center", color: "inherit", textDecoration: "none" }}>
            <Box component="img" src={motionmeetLogo} alt="" sx={{ width: 34, height: 34 }} />
            <Typography sx={{ fontFamily: '"Manrope", sans-serif', fontWeight: 800, fontSize: 15 }}>MotionMeet</Typography>
          </Stack>
        </Stack>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, sm: 4 },
            borderRadius: { xs: 5, sm: 6 },
            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.9),
            backdropFilter: "blur(18px)",
            border: 1,
            borderColor: "divider",
            boxShadow: 3,
          }}
        >
          <Typography variant="overline" color="primary" sx={{ fontWeight: 900, letterSpacing: ".13em" }}>
            {eyebrow}
          </Typography>
          <Typography variant="h3" sx={{ mt: 0.5, mb: 1.25, fontSize: { xs: 31, sm: 39 } }}>
            {title}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3.5, maxWidth: 420 }}>
            {description}
          </Typography>
          {children}
        </Paper>
      </Box>
    </Box>
  </Box>
);

export default AuthShell;
