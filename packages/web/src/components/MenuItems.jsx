import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import { alpha } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router";
import { menuItemsData } from "~/assets/assets";

const MenuItems = ({ setSideBarOpen, unreadCount = 0 }) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  return (
    <List component="nav" aria-label="Primary navigation" sx={{ px: 0, py: 0 }}>
      {menuItemsData.map(({ to, label, Icon }) => {
        const isActive = pathname === to || pathname.startsWith(`${to}/`);
        const icon = <Icon sx={{ fontSize: 21 }} />;

        return (
          <ListItemButton
            key={to}
            component={NavLink}
            to={to}
            aria-current={isActive ? "page" : undefined}
            onClick={() => setSideBarOpen(false)}
            sx={{
              position: "relative",
              borderRadius: 2,
              mb: 0.5,
              minHeight: 44,
              px: 0.75,
              color: isActive ? "primary.main" : "text.secondary",
              "&::before": {
                content: '""',
                position: "absolute",
                left: 0,
                width: 3,
                height: isActive ? 20 : 0,
                borderRadius: 2,
                bgcolor: "primary.main",
                transition: "height 180ms ease",
              },
              "&.Mui-selected": {
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.11),
              },
              "&.Mui-selected:hover": {
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14),
              },
            }}
          >
            <ListItemIcon sx={{ color: "inherit", minWidth: 40 }}>
              <Box
                sx={{
                  display: "grid",
                  placeItems: "center",
                  width: 30,
                  height: 30,
                  borderRadius: 2,
                  bgcolor: isActive ? (theme) => alpha(theme.palette.primary.main, 0.1) : "transparent",
                }}
              >
                {to === "/messages" ? (
                  <Badge badgeContent={unreadCount} color="error" max={99}>
                    {icon}
                  </Badge>
                ) : icon}
              </Box>
            </ListItemIcon>
            <ListItemText
              primary={t(`menu.${label.toLowerCase()}`)}
              slotProps={{
                primary: {
                  sx: {
                    color: "inherit",
                    fontSize: 14,
                    fontWeight: isActive ? 800 : 650,
                    letterSpacing: "-0.01em",
                  },
                },
              }}
            />
          </ListItemButton>
        );
      })}
    </List>
  );
};

export default MenuItems;
