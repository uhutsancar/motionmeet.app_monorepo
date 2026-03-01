import React from "react";
import { NavLink } from "react-router-dom";
import { menuItemsData } from "~/assets/assets";
import { useTranslation } from "react-i18next";

const MenuItems = ({ setSideBarOpen }) => {
  const { t } = useTranslation();

  return (
    <div className="px-6 space-y-1.5 font-medium">
      {menuItemsData.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          onClick={() => setSideBarOpen(false)}
          className={({ isActive }) =>
            `px-3.5 py-2.5 flex items-center gap-3 rounded-xl transition-all duration-200
            ${isActive
              ? "bg-surface-light text-text-primary border border-border-subtle shadow-sm"
              : "text-text-secondary hover:bg-surface-light hover:text-text-primary"}`
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={`w-5 h-5 ${isActive ? "text-accent-primary" : "text-text-muted"}`} />
              <span className={isActive ? "font-semibold text-accent-primary" : ""}>
                {t(`menu.${label.toLowerCase()}`)}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
};

export default MenuItems;
