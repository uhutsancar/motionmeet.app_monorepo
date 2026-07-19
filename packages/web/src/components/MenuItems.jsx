import Badge from "@mui/material/Badge";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import { NavLink } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { menuItemsData } from "~/assets/assets";
import { useTranslation } from "react-i18next";

const MenuItems = ({ setSideBarOpen, unreadCount = 0 }) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  return (
    <List component="nav" aria-label="Primary navigation" sx={{ px: 2, py: 0 }}>
      {menuItemsData.map(({ to, label, Icon }) => {
        const isActive = pathname === to || pathname.startsWith(`${to}/`);
        const icon = (
          <Icon fontSize="small" color={isActive ? "primary" : "inherit"} />
        );

        return (
          <ListItemButton
            key={to}
            component={NavLink}
            to={to}
            selected={isActive}
            onClick={() => setSideBarOpen(false)}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              minHeight: 44,
              border: 1,
              borderColor: isActive ? "divider" : "transparent",
              "&.Mui-selected": { bgcolor: "action.selected" },
              "&.Mui-selected:hover": { bgcolor: "action.hover" },
            }}
          >
            <ListItemIcon sx={{ color: isActive ? "primary.main" : "text.secondary", minWidth: 38 }}>
              {to === "/messages" ? (
                <Badge badgeContent={unreadCount} color="error" max={99}>
                  {icon}
                </Badge>
              ) : icon}
            </ListItemIcon>
            <ListItemText
              primary={t(`menu.${label.toLowerCase()}`)}
              slotProps={{
                primary: {
                  sx: {
                    color: isActive ? "primary.main" : "text.secondary",
                    fontSize: 15,
                    fontWeight: isActive ? 700 : 500,
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
