import CloseRounded from "@mui/icons-material/CloseRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import { useMediaQuery, useTheme } from "@mui/material";
import { useAuthContext } from "../context/AuthProvider";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import motionmeetLogo from "~/assets/motionmeet_logo.svg";
import MenuItems from "./MenuItems";

const SideBar = ({ sideBarOpen, setSideBarOpen, unreadCount = 0 }) => {
  const navigate = useNavigate();
  const user = useSelector((state) => state.user.value);
  const { signOut } = useAuthContext();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("sm"));
  const wideDesktop = useMediaQuery(theme.breakpoints.up("xl"));
  const drawerWidth = wideDesktop ? 288 : 240;

  return (
    <Drawer
      variant={desktop ? "permanent" : "temporary"}
      open={desktop || sideBarOpen}
      onClose={() => setSideBarOpen(false)}
      ModalProps={{ keepMounted: true }}
      sx={{
        flexShrink: 0,
        width: desktop ? drawerWidth : 0,
        "& .MuiDrawer-paper": {
          bgcolor: "background.paper",
          borderRightColor: "divider",
          boxSizing: "border-box",
          width: drawerWidth,
        },
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", px: 2.5, py: 2 }}>
          <ButtonBase
            aria-label="Go to feed"
            onClick={() => navigate("/feed")}
            sx={{ borderRadius: 2, gap: 1.25, px: 0.75, py: 0.5 }}
          >
            <Box component="img" src={motionmeetLogo} alt="" sx={{ height: 32, width: 32 }} />
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: "-0.02em" }}>
              MotionMeet
            </Typography>
          </ButtonBase>
          {!desktop && (
            <IconButton aria-label="Close navigation" onClick={() => setSideBarOpen(false)}>
              <CloseRounded />
            </IconButton>
          )}
        </Stack>

        <Divider sx={{ mb: 2 }} />
        <MenuItems setSideBarOpen={setSideBarOpen} unreadCount={unreadCount} />

        <Box sx={{ mt: "auto" }}>
          <Divider />
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", p: 2 }}>
            <Avatar src={user?.profile_picture} alt={user?.username} sx={{ width: 32, height: 32 }} />
            <ButtonBase
              onClick={() => navigate("/profile")}
              sx={{ minWidth: 0, flex: 1, justifyContent: "flex-start", borderRadius: 1.5, textAlign: "left" }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                  {user?.full_name || user?.username}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                  @{user?.username}
                </Typography>
              </Box>
            </ButtonBase>
            <IconButton aria-label="Sign out" size="small" onClick={() => signOut()}>
              <LogoutRounded fontSize="small" />
            </IconButton>
          </Stack>
        </Box>
      </Box>
    </Drawer>
  );
};

export default SideBar;
