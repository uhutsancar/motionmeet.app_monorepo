import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router";
import { menuItemsData } from "~/assets/assets";
import { useAppSelector } from "~/app/hooks";

interface MenuItemsProps { setSideBarOpen: (open: boolean) => void; unreadCount?: number }

const MenuItems = ({ setSideBarOpen, unreadCount = 0 }: MenuItemsProps) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const unreadActivity = useAppSelector((state) => state.notifications.unreadCount);

  return (
    <List component="nav" aria-label="Primary navigation" sx={{ px: 0, py: 0 }}>
      {menuItemsData.map(({ to, label, Icon }) => {
        const isActive = pathname === to || pathname.startsWith(`${to}/`);
        const icon = <Icon sx={{ fontSize: 22 }} />;
        const badgeCount = to === "/messages" ? unreadCount : to === "/activity" ? unreadActivity : 0;

        return (
          <ListItemButton
            key={to}
            component={NavLink}
            to={to}
            aria-current={isActive ? "page" : undefined}
            onClick={() => setSideBarOpen(false)}
            // Instagram's rail: the open page is told by weight alone, the
            // label going bold, with no coloured bar or tinted icon tile.
            sx={{
              borderRadius: 2,
              mb: 0.25,
              minHeight: 44,
              px: 1,
              color: "text.primary",
              "&:hover": { bgcolor: "action.hover" },
              "&.Mui-selected, &.Mui-selected:hover": { bgcolor: "action.hover" },
            }}
          >
            <ListItemIcon sx={{ color: "inherit", minWidth: 38 }}>
              <Box sx={{ display: "grid", placeItems: "center", width: 26, height: 26 }}>
                {badgeCount > 0 ? (
                  <Badge badgeContent={badgeCount} color="error" max={99}>
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
                    fontSize: 14.5,
                    fontWeight: isActive ? 700 : 400,
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
