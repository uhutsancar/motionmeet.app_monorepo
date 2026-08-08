import MenuRounded from "@mui/icons-material/MenuRounded";
import NotificationsNoneRounded from "@mui/icons-material/NotificationsNoneRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import Badge from "@mui/material/Badge";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { menuItemsData } from "~/assets/assets";
import motionmeetLogo from "~/assets/motionmeet_logo.svg";
import Loading from "~/components/Loading";
import SideBar from "~/components/SideBar";
import { useAppSelector } from "~/app/hooks";

interface UnreadCountProps { unreadCount?: number }

const mobileRoutes = ["/feed", "/routines", "/exercises", "/messages", "/profile"];

const MobileNavigation = ({ unreadCount = 0 }: UnreadCountProps) => {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const items = menuItemsData.filter((item) => mobileRoutes.includes(item.to));

  return (
    <Paper
      component="nav"
      aria-label="Mobile navigation"
      square
      elevation={0}
      sx={{
        display: { xs: "flex", md: "none" },
        flexShrink: 0,
        justifyContent: "space-around",
        minHeight: 68,
        mx: 1.25,
        mb: 1,
        px: 0.5,
        pb: "env(safe-area-inset-bottom)",
        bgcolor: (theme) => alpha(theme.palette.background.paper, 0.94),
        backdropFilter: "blur(18px)",
        border: 1,
        borderColor: "divider",
        borderRadius: 4,
        boxShadow: 3,
        zIndex: (theme) => theme.zIndex.appBar,
      }}
    >
      {items.map(({ to, label, Icon }) => {
        const active = pathname === to || pathname.startsWith(`${to}/`);
        const icon = <Icon sx={{ fontSize: 22 }} />;

        return (
          <ButtonBase
            key={to}
            component={NavLink}
            to={to}
            aria-current={active ? "page" : undefined}
            sx={{
              color: active ? "primary.main" : "text.disabled",
              flex: 1,
              minWidth: 0,
              maxWidth: 90,
              py: 0.75,
              flexDirection: "column",
              gap: 0.35,
              borderRadius: 3,
            }}
          >
            <Box
              sx={{
                display: "grid",
                placeItems: "center",
                width: 40,
                height: 31,
                borderRadius: 2.5,
                bgcolor: active ? (theme) => alpha(theme.palette.primary.main, 0.12) : "transparent",
                transition: "background-color 160ms ease",
              }}
            >
              {to === "/messages" ? (
                <Badge badgeContent={unreadCount} color="error" max={9}>
                  {icon}
                </Badge>
              ) : icon}
            </Box>
            <Typography
              component="span"
              sx={{ fontSize: 10, fontWeight: active ? 800 : 700, lineHeight: 1.2 }}
            >
              {t(`menu.${label.toLowerCase()}`)}
            </Typography>
          </ButtonBase>
        );
      })}
    </Paper>
  );
};

const Layout = ({ unreadCount = 0 }: UnreadCountProps) => {
  const user = useAppSelector((state) => state.user.value);
  const unreadActivity = useAppSelector((state) => state.notifications.unreadCount);
  const [sideBarOpen, setSideBarOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const pageTitle = useMemo(() => {
    const current = menuItemsData.find(({ to }) => pathname === to || pathname.startsWith(`${to}/`));
    return current ? t(`menu.${current.label.toLowerCase()}`) : "MotionMeet";
  }, [pathname, t]);

  if (!user) return <Loading />;

  return (
    <Box
      sx={{
        display: "flex",
        height: "100dvh",
        width: "100%",
        overflow: "hidden",
        bgcolor: "background.default",
      }}
    >
      <SideBar
        sideBarOpen={sideBarOpen}
        setSideBarOpen={setSideBarOpen}
        unreadCount={unreadCount}
      />

      <Box sx={{ display: "flex", flex: 1, minWidth: 0, minHeight: 0, flexDirection: "column" }}>
        <Paper
          component="header"
          square
          elevation={0}
          sx={{
            display: { xs: "flex", md: "none" },
            alignItems: "center",
            flexShrink: 0,
            minHeight: 66,
            px: 1.5,
            pt: "env(safe-area-inset-top)",
            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.94),
            backdropFilter: "blur(18px)",
            borderBottom: 1,
            borderColor: "divider",
            zIndex: (theme) => theme.zIndex.appBar,
          }}
        >
          <IconButton aria-label="Open navigation" onClick={() => setSideBarOpen(true)}>
            <MenuRounded />
          </IconButton>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", ml: 0.5, minWidth: 0 }}>
            <Box component="img" src={motionmeetLogo} alt="" sx={{ width: 28, height: 28 }} />
            <Typography variant="subtitle1" noWrap sx={{ fontFamily: '"Manrope", sans-serif' }}>
              {pageTitle}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.25} sx={{ alignItems: "center", ml: "auto" }}>
            <IconButton aria-label="Search" onClick={() => navigate("/exercises")}>
              <SearchRounded />
            </IconButton>
            <IconButton aria-label={t("activity.title", "Notifications")} onClick={() => navigate("/activity")}>
              <Badge badgeContent={unreadActivity} color="error" max={99}>
                <NotificationsNoneRounded />
              </Badge>
            </IconButton>
            <IconButton aria-label="Open profile" onClick={() => navigate("/profile")} sx={{ p: 0.5 }}>
              <Avatar
                src={user?.profile_picture}
                alt={user?.full_name || user?.username}
                sx={{ width: 34, height: 34, border: 2, borderColor: "background.paper" }}
              />
            </IconButton>
          </Stack>
        </Paper>

        <Box
          component="main"
          role="main"
          sx={{
            position: "relative",
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            bgcolor: "background.default",
          }}
        >
          <Outlet />
        </Box>

        <MobileNavigation unreadCount={unreadCount} />
      </Box>
    </Box>
  );
};

export default Layout;
