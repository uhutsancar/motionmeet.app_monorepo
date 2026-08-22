import HomeRounded from "@mui/icons-material/HomeRounded";
import BarChartRounded from "@mui/icons-material/BarChartRounded";
import RouteRounded from "@mui/icons-material/RouteRounded";
import FitnessCenterRounded from "@mui/icons-material/FitnessCenterRounded";
import PersonOutlineRounded from "@mui/icons-material/PersonOutlineRounded";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import NotificationsNoneRounded from "@mui/icons-material/NotificationsNoneRounded";
import GroupOutlined from "@mui/icons-material/GroupOutlined";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import ExploreOutlined from "@mui/icons-material/ExploreOutlined";
import SearchRounded from "@mui/icons-material/SearchRounded";
import SendOutlined from "@mui/icons-material/SendOutlined";

/**
 * `label` doubles as the i18n key (`menu.<lowercased label>`), so a new entry
 * needs its translation added under that key in both locale files.
 */
export const menuItemsData = [
    { to: "/feed", label: "Feed", Icon: HomeRounded },
    { to: "/explore", label: "Explore", Icon: SearchRounded },
    { to: "/activity", label: "Activity", Icon: NotificationsNoneRounded },
    { to: "/messages", label: "Messages", Icon: SendOutlined },
    { to: "/connections", label: "Connections", Icon: GroupOutlined },
    { to: "/nearby", label: "Nearby", Icon: ExploreOutlined },
    { to: "/statistics", label: "Statistics", Icon: BarChartRounded },
    { to: "/measurements", label: "Measurements", Icon: StraightenRounded },
    { to: "/routines", label: "Routines", Icon: RouteRounded },
    { to: "/exercises", label: "Exercises", Icon: FitnessCenterRounded },
    { to: "/profile", label: "Profile", Icon: PersonOutlineRounded },
    { to: "/settings", label: "Settings", Icon: SettingsOutlined },
];
