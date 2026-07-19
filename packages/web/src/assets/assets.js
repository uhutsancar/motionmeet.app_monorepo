import HomeRounded from "@mui/icons-material/HomeRounded";
import ChatBubbleOutlineRounded from "@mui/icons-material/ChatBubbleOutlineRounded";
import BarChartRounded from "@mui/icons-material/BarChartRounded";
import RouteRounded from "@mui/icons-material/RouteRounded";
import FitnessCenterRounded from "@mui/icons-material/FitnessCenterRounded";
import PersonOutlineRounded from "@mui/icons-material/PersonOutlineRounded";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";

export const menuItemsData = [
    { to: "/feed", label: "Feed", Icon: HomeRounded },
    { to: "/messages", label: "Messages", Icon: ChatBubbleOutlineRounded },
    { to: "/statistics", label: "Statistics", Icon: BarChartRounded },
    { to: "/routines", label: "Routines", Icon: RouteRounded },
    { to: "/exercises", label: "Exercises", Icon: FitnessCenterRounded },
    { to: "/profile", label: "Profile", Icon: PersonOutlineRounded },
    { to: "/settings", label: "Settings", Icon: SettingsOutlined },
];
