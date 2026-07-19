import MenuRounded from "@mui/icons-material/MenuRounded";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import { useState } from "react";
import { Outlet } from "react-router-dom";
import Loading from "~/components/Loading";
import SideBar from "~/components/SideBar";
import { useSelector } from "react-redux";

const Layout = ({ unreadCount = 0 }) => {
  const user = useSelector((state) => state.user.value);
  const [sideBarOpen, setSideBarOpen] = useState(false);

  return user ? (
    <Box sx={{ display: "flex", height: "100dvh", width: "100%", bgcolor: "background.default" }}>
      <SideBar
        sideBarOpen={sideBarOpen}
        setSideBarOpen={setSideBarOpen}
        unreadCount={unreadCount}
      />

      <Box
        component="main"
        role="main"
        sx={{ flex: 1, minWidth: 0, overflowY: "auto", bgcolor: "background.default" }}
      >
        <Outlet />
      </Box>

      {!sideBarOpen && (
        <IconButton
          aria-label="Open navigation"
          onClick={() => setSideBarOpen(true)}
          sx={{
            display: { xs: "inline-flex", sm: "none" },
            position: "fixed",
            right: 12,
            top: 12,
            zIndex: (theme) => theme.zIndex.drawer + 1,
            bgcolor: "background.paper",
            border: 1,
            borderColor: "divider",
            boxShadow: 2,
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <MenuRounded />
        </IconButton>
      )}
    </Box>
  ) : (
    <Loading />
  );
};

export default Layout;
