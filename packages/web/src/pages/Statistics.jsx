import { Avatar, Box, Card, CardActionArea, Chip, Stack, Typography } from "@mui/material";
import { ActivitySquare, Award, BarChart3, Calendar, Dumbbell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

const Statistics = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const menuItems = [
    {
      title: t("statistics.advanced", "Gelişmiş İstatistikler"),
      subtitle: t("statistics.advanced_desc", "Hacim, set ve tekrar detayları"),
      icon: ActivitySquare,
      color: "primary.main",
      route: "/statistics/history",
      isPro: false,
    },
    {
      title: t("statistics.muscle_dist", "Kas Dağılımı"),
      subtitle: t("statistics.muscle_dist_desc", "Hangi kasları çalıştırdığını gör"),
      icon: Dumbbell,
      color: "secondary.main",
      route: "/statistics/muscle-distribution",
      isPro: false,
    },
    {
      title: t("statistics.records", "Kişisel Rekorlar"),
      subtitle: t("statistics.records_desc", "1RM ve en iyi setlerin"),
      icon: Award,
      color: "warning.main",
      route: "/statistics/records",
      isPro: true,
    },
    {
      title: t("statistics.monthly_report", "Aylık Rapor"),
      subtitle: t("statistics.monthly_desc", "Aylık antrenman ve istatistiklerinizin özeti"),
      icon: Calendar,
      color: "info.main",
      route: "/statistics/monthly-report",
      isPro: false,
    },
  ];

  return (
    <Box sx={{ width: "100%", minHeight: "100vh", overflowY: "auto", p: { xs: 2, sm: 4 } }}>
      <Stack spacing={4} sx={{ maxWidth: 896, mx: "auto" }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Avatar variant="rounded" sx={{ bgcolor: "action.hover", color: "primary.main", width: 48, height: 48 }}>
            <BarChart3 size={24} />
          </Avatar>
          <Typography variant="h4" sx={{ fontWeight: 900 }}>{t("statistics.title", "İstatistikler")}</Typography>
        </Stack>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 3 }}>
          {menuItems.map(({ title, subtitle, icon: Icon, color, route, isPro }) => (
            <Card key={route} variant="outlined" sx={{ borderRadius: 3, position: "relative" }}>
              {isPro && <Chip label="PRO" size="small" color="warning" sx={{ position: "absolute", zIndex: 1, top: 16, right: 16, fontWeight: 900 }} />}
              <CardActionArea onClick={() => navigate(route)} sx={{ p: 3.5, height: "100%" }}>
                <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center" }}>
                  <Avatar variant="rounded" sx={{ width: 58, height: 58, bgcolor: "action.hover", color }}>
                    <Icon size={28} />
                  </Avatar>
                  <Stack spacing={0.75}>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>{title}</Typography>
                    <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
                  </Stack>
                </Stack>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      </Stack>
    </Box>
  );
};

export default Statistics;
