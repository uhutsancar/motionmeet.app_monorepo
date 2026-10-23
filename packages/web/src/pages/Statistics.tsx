import { Box, ButtonBase, Paper, Stack, Typography } from "@mui/material";
import { ActivitySquare, Award, Calendar, ChevronRight, Dumbbell, Grid3x3, ListOrdered, Ruler } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { PageHeader, PageShell } from "~/components/AppPage";

/**
 * The statistics home: one list of the reports, each a plain row with a grey
 * outline icon and a line about what is inside. It used to be four 156px
 * cards with an icon in a tinted tile, a coloured accent per card and an
 * English "View details" link on each.
 */
const Statistics = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reports = [
    { title: t("statistics.monthly_report", "Aylık rapor"), subtitle: t("statistics.monthly_desc", "Takvim, devamlılık ve ayın özeti"), icon: Calendar, route: "/statistics/monthly-report" },
    { title: t("statistics.advanced", "Gelişmiş istatistikler"), subtitle: t("statistics.advanced_desc", "Hacim, set, tekrar ve süre"), icon: ActivitySquare, route: "/statistics/history" },
    { title: t("statistics.records", "Kişisel rekorlar"), subtitle: t("statistics.records_desc", "Tamamladığın en güçlü setler"), icon: Award, route: "/statistics/records" },
    { title: t("statistics.main_exercises", "Ana egzersizler"), subtitle: t("statistics.main_ex_desc", "En çok yaptığın hareketler"), icon: ListOrdered, route: "/statistics/main-exercises" },
    { title: t("statistics.muscle_dist", "Kas dağılımı"), subtitle: t("statistics.muscle_dist_desc", "Setlerin kas gruplarına dağılımı"), icon: Dumbbell, route: "/statistics/muscle-distribution" },
    { title: t("statistics.muscle_load", "Kas yükü"), subtitle: t("statistics.muscle_load_desc", "Hangi kası ne zaman çalıştırdın"), icon: Grid3x3, route: "/statistics/muscle-load" },
    { title: t("measurements.title", "Ölçümler"), subtitle: t("measurements.settings_hint", "Kilo, yağ oranı ve çevre ölçüleri"), icon: Ruler, route: "/measurements" },
  ];

  return (
    <PageShell maxWidth={720}>
      <PageHeader title={t("statistics.title", "İstatistikler")} />

      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        {reports.map(({ title, subtitle, icon: Icon, route }, index) => (
          <ButtonBase
            key={route}
            onClick={() => navigate(route)}
            sx={{
              width: "100%",
              justifyContent: "flex-start",
              textAlign: "left",
              px: 2,
              py: 1.25,
              gap: 1.75,
              borderTop: index ? 1 : 0,
              borderColor: "divider",
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            <Box sx={{ color: "text.secondary", display: "grid", placeItems: "center" }}>
              <Icon size={19} strokeWidth={1.75} />
            </Box>
            <Stack sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{title}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap>{subtitle}</Typography>
            </Stack>
            <Box sx={{ color: "text.disabled", display: "grid", placeItems: "center" }}>
              <ChevronRight size={17} />
            </Box>
          </ButtonBase>
        ))}
      </Paper>
    </PageShell>
  );
};

export default Statistics;
