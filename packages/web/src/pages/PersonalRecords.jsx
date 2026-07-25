import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import EmojiEventsRounded from "@mui/icons-material/EmojiEventsRounded";
import LocalFireDepartmentRounded from "@mui/icons-material/LocalFireDepartmentRounded";
import StarRounded from "@mui/icons-material/StarRounded";
import WorkspacePremiumRounded from "@mui/icons-material/WorkspacePremiumRounded";
import { Award } from "lucide-react";
import { EmptyState, PageHeader, PageShell } from "~/components/AppPage";

const iconMap = {
  Trophy: EmojiEventsRounded,
  Flame: LocalFireDepartmentRounded,
  Award: WorkspacePremiumRounded,
  Star: StarRounded,
};

const colorMap = {
  blue: "linear-gradient(135deg, #3b82f6, #4f46e5)",
  orange: "linear-gradient(135deg, #fb923c, #ef4444)",
  amber: "linear-gradient(135deg, #fbbf24, #ca8a04)",
  green: "linear-gradient(135deg, #34d399, #14b8a6)",
};

const PersonalRecords = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [records] = useState([
    { id: 1, name: "Bench Press", value: "100", unit: "kg", date: "Oct 24, 2025", icon: "Trophy", color: "blue" },
    { id: 2, name: "Squat", value: "140", unit: "kg", date: "Sep 12, 2025", icon: "Flame", color: "orange" },
    { id: 3, name: "Deadlift", value: "160", unit: "kg", date: "Nov 02, 2025", icon: "Award", color: "amber" },
    { id: 4, name: "Overhead Press", value: "65", unit: "kg", date: "Aug 15, 2025", icon: "Star", color: "green" },
  ]);

  return (
    <PageShell maxWidth={1000}>
      <PageHeader
        icon={Award}
        title={t("statistics.records", "Personal Records")}
        description={t("statistics.records_desc", "Your 1RM and strongest sets")}
        onBack={() => navigate("/statistics")}
        action={<Chip label="PRO" size="small" color="warning" sx={{ fontWeight: 900 }} />}
      />

      {records.length > 0 ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
          {records.map((record) => {
            const Icon = iconMap[record.icon] || EmojiEventsRounded;
            const gradient = colorMap[record.color] || colorMap.blue;
            return (
              <Paper key={record.id} variant="outlined" sx={{ p: 2.5, position: "relative", overflow: "hidden", "&:hover": { borderColor: "primary.main" } }}>
                <Box sx={{ position: "absolute", top: -28, right: -28, width: 100, height: 100, borderRadius: "50%", background: gradient, opacity: 0.1, filter: "blur(22px)" }} />
                <Stack direction="row" spacing={2} sx={{ position: "relative", zIndex: 1, alignItems: "center", justifyContent: "space-between" }}>
                  <Stack direction="row" spacing={1.5} sx={{ minWidth: 0, alignItems: "center" }}>
                    <Box sx={{ width: 42, height: 42, display: "grid", placeItems: "center", flexShrink: 0, borderRadius: 2.5, background: gradient }}>
                      <Icon sx={{ fontSize: 21, color: "#fff" }} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle1" noWrap sx={{ fontWeight: 800 }}>{record.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t("statistics.archived_on", "Recorded")} {record.date}
                      </Typography>
                    </Box>
                  </Stack>
                  <Box sx={{ flexShrink: 0, textAlign: "right" }}>
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                      {record.value} <Typography component="span" variant="body2" color="text.secondary">{record.unit}</Typography>
                    </Typography>
                    <Chip label="1RM" size="small" variant="outlined" sx={{ mt: 0.5 }} />
                  </Box>
                </Stack>
              </Paper>
            );
          })}
        </Box>
      ) : (
        <EmptyState
          icon={Award}
          title={t("statistics.no_records_yet", "No records yet")}
          description={t("statistics.log_more_workouts", "Log more workouts to see your personal records here.")}
        />
      )}
    </PageShell>
  );
};

export default PersonalRecords;
