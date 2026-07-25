import { Box, Card, CardActionArea, Chip, Stack, Typography } from "@mui/material";
import { ActivitySquare, ArrowUpRight, Award, BarChart3, Calendar, Dumbbell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { PageHeader, PageShell } from "~/components/AppPage";

const Statistics = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const menuItems = [
    {
      title: t("statistics.advanced", "Advanced Statistics"),
      subtitle: t("statistics.advanced_desc", "Volume, set and rep details"),
      icon: ActivitySquare,
      color: "primary.main",
      route: "/statistics/history",
      isPro: false,
    },
    {
      title: t("statistics.muscle_dist", "Muscle Distribution"),
      subtitle: t("statistics.muscle_dist_desc", "See which muscles you trained"),
      icon: Dumbbell,
      color: "secondary.main",
      route: "/statistics/muscle-distribution",
      isPro: false,
    },
    {
      title: t("statistics.records", "Personal Records"),
      subtitle: t("statistics.records_desc", "Your 1RM and strongest sets"),
      icon: Award,
      color: "warning.main",
      route: "/statistics/records",
      isPro: true,
    },
    {
      title: t("statistics.monthly_report", "Monthly Report"),
      subtitle: t("statistics.monthly_desc", "A summary of your monthly training"),
      icon: Calendar,
      color: "info.main",
      route: "/statistics/monthly-report",
      isPro: false,
    },
  ];

  return (
    <PageShell maxWidth={1120}>
      <PageHeader
        icon={BarChart3}
        eyebrow="YOUR PROGRESS"
        title={t("statistics.title", "Statistics")}
        description="Review your training volume, consistency and personal bests."
      />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
        {menuItems.map(({ title, subtitle, icon: Icon, color, route, isPro }) => (
          <Card key={route} variant="outlined" sx={{ position: "relative", minHeight: 156 }}>
            {isPro && (
              <Chip
                label="PRO"
                size="small"
                color="warning"
                sx={{ position: "absolute", zIndex: 1, top: 16, right: 16, height: 22, fontWeight: 900 }}
              />
            )}
            <CardActionArea onClick={() => navigate(route)} sx={{ p: 2.5, height: "100%" }}>
              <Stack direction="row" spacing={2} sx={{ height: "100%", alignItems: "flex-start" }}>
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 2.5,
                    bgcolor: "action.hover",
                    color,
                  }}
                >
                  <Icon size={21} />
                </Box>
                <Stack spacing={0.6} sx={{ minWidth: 0, flex: 1, pr: isPro ? 5 : 0 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{title}</Typography>
                  <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", mt: "auto", pt: 1.5, color: "primary.main" }}>
                    <Typography variant="caption" sx={{ fontWeight: 800 }}>View details</Typography>
                    <ArrowUpRight size={14} />
                  </Stack>
                </Stack>
              </Stack>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </PageShell>
  );
};

export default Statistics;
