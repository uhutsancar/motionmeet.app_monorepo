import AddRounded from "@mui/icons-material/AddRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { useMediaQuery, useTheme } from "@mui/material";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import motionmeetLogo from "~/assets/motionmeet_logo.svg";
import { useAuthContext } from "../context/AuthProvider";
import { useAppTheme } from "../context/appThemeContext";
import MenuItems from "./MenuItems";

const SideBar = ({ sideBarOpen, setSideBarOpen, unreadCount = 0 }) => {
  const navigate = useNavigate();
  const user = useSelector((state) => state.user.value);
  const { signOut } = useAuthContext();
  const { theme: themeMode, toggleTheme } = useAppTheme();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"));
  const drawerWidth = 272;

  const goTo = (route) => {
    navigate(route);
    setSideBarOpen(false);
  };

  return (
    <Drawer
      variant={desktop ? "permanent" : "temporary"}
      open={desktop || sideBarOpen}
      onClose={() => setSideBarOpen(false)}
      ModalProps={{ keepMounted: true }}
      slotProps={{ backdrop: { sx: { backdropFilter: "blur(4px)" } } }}
      sx={{
        flexShrink: 0,
        width: desktop ? drawerWidth : 0,
        "& .MuiDrawer-paper": {
          bgcolor: "background.paper",
          borderRightColor: "divider",
          boxSizing: "border-box",
          width: drawerWidth,
          p: 1,
        },
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <Stack
          direction="row"
          sx={{ alignItems: "center", justifyContent: "space-between", px: 1.25, py: 1.25, mb: 1 }}
        >
          <ButtonBase
            aria-label="Go to feed"
            onClick={() => goTo("/feed")}
            sx={{ borderRadius: 3, gap: 1.25, px: 0.75, py: 0.5 }}
          >
            <Box
              sx={{
                display: "grid",
                placeItems: "center",
                width: 38,
                height: 38,
                borderRadius: 3,
                bgcolor: (muiTheme) => alpha(muiTheme.palette.primary.main, 0.1),
              }}
            >
              <Box component="img" src={motionmeetLogo} alt="" sx={{ height: 28, width: 28 }} />
            </Box>
            <Box sx={{ textAlign: "left" }}>
              <Typography
                sx={{
                  fontFamily: '"Sora", sans-serif',
                  fontSize: 17,
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  lineHeight: 1.1,
                }}
              >
                MotionMeet
              </Typography>
              <Typography sx={{ color: "text.disabled", fontSize: 10, fontWeight: 800, letterSpacing: "0.12em" }}>
                TRAIN · TRACK · CONNECT
              </Typography>
            </Box>
          </ButtonBase>
          {!desktop && (
            <IconButton aria-label="Close navigation" onClick={() => setSideBarOpen(false)}>
              <CloseRounded />
            </IconButton>
          )}
        </Stack>

        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => goTo("/routines")}
          sx={{ mx: 1.25, mb: 2, minHeight: 46 }}
        >
          Start a workout
        </Button>

        <Box className="no-scrollbar" sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          <Typography
            variant="overline"
            sx={{ display: "block", px: 2.5, mb: 0.75, color: "text.disabled", fontWeight: 800, letterSpacing: "0.12em" }}
          >
            Workspace
          </Typography>
          <MenuItems setSideBarOpen={setSideBarOpen} unreadCount={unreadCount} />
        </Box>

        <Box
          sx={{
            m: 1,
            p: 1,
            borderRadius: 3.5,
            bgcolor: (muiTheme) => alpha(muiTheme.palette.action.hover, 0.72),
            border: 1,
            borderColor: "divider",
          }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <ButtonBase
              onClick={() => goTo("/profile")}
              sx={{ minWidth: 0, flex: 1, justifyContent: "flex-start", borderRadius: 2.5, p: 0.5, gap: 1 }}
            >
              <Avatar
                src={user?.profile_picture}
                alt={user?.username}
                sx={{ width: 38, height: 38, bgcolor: "primary.main" }}
              />
              <Box sx={{ minWidth: 0, textAlign: "left" }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 800 }}>
                  {user?.full_name || user?.username}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                  @{user?.username}
                </Typography>
              </Box>
            </ButtonBase>
            <Tooltip title={themeMode === "dark" ? "Light mode" : "Dark mode"}>
              <IconButton aria-label="Toggle theme" size="small" onClick={toggleTheme}>
                {themeMode === "dark" ? <LightModeOutlined fontSize="small" /> : <DarkModeOutlined fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Sign out">
              <IconButton aria-label="Sign out" size="small" onClick={() => signOut()}>
                <LogoutRounded fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      </Box>
    </Drawer>
  );
};

export default SideBar;
