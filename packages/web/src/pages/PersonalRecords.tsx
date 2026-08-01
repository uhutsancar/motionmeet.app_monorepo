import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import EmojiEventsRounded from "@mui/icons-material/EmojiEventsRounded";
import LocalFireDepartmentRounded from "@mui/icons-material/LocalFireDepartmentRounded";
import StarRounded from "@mui/icons-material/StarRounded";
import WorkspacePremiumRounded from "@mui/icons-material/WorkspacePremiumRounded";
import CircularProgress from "@mui/material/CircularProgress";
import { Award } from "lucide-react";
import { EmptyState, PageHeader, PageShell } from "~/components/AppPage";
import { getPersonalRecords } from "../services/exerciseService";
import { useAuthContext } from "../context/AuthProvider";
import type { PersonalRecord } from "@motionmeet/shared";

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
  const { getToken } = useAuthContext();
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadRecords = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const data = await getPersonalRecords(token);
        if (active && data.success) setRecords(data.records || []);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadRecords();
    return () => {
      active = false;
    };
  }, [getToken]);

  return (
    <PageShell maxWidth={1000}>
      <PageHeader
        icon={Award}
        title={t("statistics.records", "Personal Records")}
        description={t("statistics.records_desc", "Your 1RM and strongest sets")}
        onBack={() => navigate("/statistics")}
        action={<Chip label="PRO" size="small" color="warning" sx={{ fontWeight: 900 }} />}
      />

      {loading ? (
        <Stack sx={{ alignItems: "center" }} py={8}>
          <CircularProgress size={32} />
        </Stack>
      ) : records.length > 0 ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
          {records.map((record, index) => {
            const icons = Object.values(iconMap);
            const gradients = Object.values(colorMap);
            const Icon = icons[index % icons.length];
            const gradient = gradients[index % gradients.length];
            return (
              <Paper key={record.exerciseId} variant="outlined" sx={{ p: 2.5, position: "relative", overflow: "hidden", "&:hover": { borderColor: "primary.main" } }}>
                <Box sx={{ position: "absolute", top: -28, right: -28, width: 100, height: 100, borderRadius: "50%", background: gradient, opacity: 0.1, filter: "blur(22px)" }} />
                <Stack direction="row" spacing={2} sx={{ position: "relative", zIndex: 1, alignItems: "center", justifyContent: "space-between" }}>
                  <Stack direction="row" spacing={1.5} sx={{ minWidth: 0, alignItems: "center" }}>
                    <Box sx={{ width: 42, height: 42, display: "grid", placeItems: "center", flexShrink: 0, borderRadius: 2.5, background: gradient }}>
                      <Icon sx={{ fontSize: 21, color: "#fff" }} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle1" noWrap sx={{ fontWeight: 800 }}>{record.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t("statistics.archived_on", "Recorded")}{" "}
                        {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(record.recordedAt))}
                      </Typography>
                    </Box>
                  </Stack>
                  <Box sx={{ flexShrink: 0, textAlign: "right" }}>
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                      {record.value} <Typography component="span" variant="body2" color="text.secondary">kg</Typography>
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
