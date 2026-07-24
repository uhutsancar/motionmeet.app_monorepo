import CloseRounded from "@mui/icons-material/CloseRounded";
import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import LanguageRounded from "@mui/icons-material/LanguageRounded";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import MenuRounded from "@mui/icons-material/MenuRounded";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useLocation } from "react-router-dom";
import motionmeetLogo from "../assets/motionmeet_logo.svg";
import { useAppTheme } from "../context/appThemeContext";
import { alpha } from "@mui/material/styles";

const PublicNavbar = () => {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useAppTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const toggleLanguage = () => {
    const language = i18n.language.startsWith("tr") ? "en" : "tr";
    i18n.changeLanguage(language);
    localStorage.setItem("appLanguage", language);
  };

  const navLinks = [
    { to: "/features", label: t("nav.features") },
    { to: "/pricing", label: t("nav.pricing") },
    { to: "/about", label: t("nav.about") },
  ];

  return (
    <>
      <AppBar
        position="fixed"
        color="transparent"
        elevation={0}
        sx={{
          bgcolor: (muiTheme) => alpha(muiTheme.palette.background.paper, 0.88),
          backdropFilter: "blur(20px)",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ minHeight: 72 }}>
            <Stack
              component={RouterLink}
              to="/"
              direction="row"
              spacing={1.25}
              sx={{ alignItems: "center", color: "inherit", textDecoration: "none" }}
            >
              <Box component="img" src={motionmeetLogo} alt="MotionMeet" sx={{ height: 34, width: 34 }} />
              <Typography variant="h6" sx={{ display: { xs: "none", sm: "block" }, fontFamily: '"Sora", sans-serif', fontWeight: 800, letterSpacing: "-0.04em" }}>
                MotionMeet
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1} sx={{ ml: "auto", mr: 3, display: { xs: "none", md: "flex" } }}>
              {navLinks.map((link) => (
                <Button
                  key={link.to}
                  component={RouterLink}
                  to={link.to}
                  color={pathname === link.to ? "primary" : "inherit"}
                  sx={{ color: pathname === link.to ? "primary.main" : "text.secondary", px: 1.5 }}
                >
                  {link.label}
                </Button>
              ))}
            </Stack>

            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", display: { xs: "none", md: "flex" } }}>
              <Tooltip title={i18n.language.startsWith("tr") ? "Switch to English" : "Türkçeye geç"}>
                <Button color="inherit" startIcon={<LanguageRounded />} onClick={toggleLanguage}>
                  {i18n.language.startsWith("tr") ? "TR" : "EN"}
                </Button>
              </Tooltip>
              <Tooltip title={theme === "dark" ? t("nav.mode_light") : t("nav.mode_dark")}>
                <IconButton color="inherit" onClick={toggleTheme}>
                  {theme === "dark" ? <LightModeOutlined /> : <DarkModeOutlined />}
                </IconButton>
              </Tooltip>
              <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
              <Button component={RouterLink} to="/login" color="inherit">
                {t("nav.login")}
              </Button>
              <Button component={RouterLink} to="/signup" variant="contained" sx={{ minHeight: 40 }}>
                {t("nav.signup")}
              </Button>
            </Stack>

            <IconButton
              aria-label="Open menu"
              color="inherit"
              onClick={() => setMenuOpen(true)}
              sx={{ display: { md: "none" }, ml: "auto" }}
            >
              <MenuRounded />
            </IconButton>
          </Toolbar>
        </Container>
      </AppBar>

      <Drawer
        anchor="right"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        slotProps={{ paper: { sx: { width: "min(86vw, 340px)", p: 2 } } }}
      >
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>MotionMeet</Typography>
          <IconButton aria-label="Close menu" onClick={() => setMenuOpen(false)}>
            <CloseRounded />
          </IconButton>
        </Stack>
        <Divider />
        <List sx={{ py: 2 }}>
          {navLinks.map((link) => (
            <ListItemButton
              key={link.to}
              component={RouterLink}
              to={link.to}
              selected={pathname === link.to}
              sx={{ borderRadius: 2, mb: 0.5 }}
            >
              {link.label}
            </ListItemButton>
          ))}
        </List>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Button fullWidth variant="outlined" startIcon={<LanguageRounded />} onClick={toggleLanguage}>
            {i18n.language.startsWith("tr") ? "TR" : "EN"}
          </Button>
          <IconButton aria-label="Toggle theme" onClick={toggleTheme} sx={{ border: 1, borderColor: "divider" }}>
            {theme === "dark" ? <LightModeOutlined /> : <DarkModeOutlined />}
          </IconButton>
        </Stack>
        <Button component={RouterLink} to="/login" fullWidth sx={{ mb: 1 }}>
          {t("nav.login")}
        </Button>
        <Button component={RouterLink} to="/signup" fullWidth variant="contained">
          {t("nav.signup")}
        </Button>
      </Drawer>
    </>
  );
};

const PublicFooter = () => {
  const { t } = useTranslation();
  const groups = [
    {
      title: t("footer.product"),
      links: [
        { label: t("footer.features"), to: "/features" },
        { label: t("footer.pricing"), to: "/pricing" },
      ],
    },
    {
      title: t("footer.company"),
      links: [{ label: t("footer.about"), to: "/about" }],
    },
  ];

  return (
    <Box component="footer" sx={{ bgcolor: "background.paper", borderTop: 1, borderColor: "divider" }}>
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr 1fr" }, gap: 5 }}>
          <Box>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mb: 2 }}>
              <Box component="img" src={motionmeetLogo} alt="" sx={{ height: 32, width: 32 }} />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>MotionMeet</Typography>
            </Stack>
            <Typography color="text.secondary" variant="body2" sx={{ maxWidth: 360 }}>
              {t("footer.tagline")}
            </Typography>
          </Box>
          {groups.map((group) => (
            <Stack key={group.title} spacing={1.25}>
              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800 }}>{group.title}</Typography>
              {group.links.map((link) => (
                <Link key={link.to} component={RouterLink} to={link.to} color="text.secondary" underline="hover">
                  {link.label}
                </Link>
              ))}
            </Stack>
          ))}
        </Box>
        <Divider sx={{ my: 4 }} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
          <Typography variant="caption" color="text.secondary">{t("footer.copyright")}</Typography>
          <Stack direction="row" spacing={2}>
            <Link href="https://motionmeet.app/terms" color="text.secondary" variant="caption">{t("footer.terms")}</Link>
            <Link href="https://motionmeet.app/privacy" color="text.secondary" variant="caption">{t("footer.privacy")}</Link>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
};

const PublicLayout = ({ children, noFooter = false }) => (
  <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100dvh", bgcolor: "background.default" }}>
    <PublicNavbar />
    <Box component="main" sx={{ flex: 1, pt: 9 }}>{children}</Box>
    {!noFooter && <PublicFooter />}
  </Box>
);

export default PublicLayout;
