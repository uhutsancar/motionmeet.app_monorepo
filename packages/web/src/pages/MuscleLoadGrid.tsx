import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { Activity } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { getWorkoutStats } from "~/api/endpoints";
import { EmptyState, PageHeader, PageShell } from "~/components/AppPage";
import { useAuthContext } from "~/context/AuthProvider";

interface MuscleDatum { name: string; value: number }

/** Warmer means a larger share of the last 30 days' training volume. */
const intensityColor = (value: number): string => {
  if (value > 80) return "#ef4444";
  if (value > 50) return "#f97316";
  if (value > 20) return "#eab308";
  return "#64748b";
};

const MuscleLoadGrid = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getToken } = useAuthContext();
  const [muscleData, setMuscleData] = useState<MuscleDatum[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await getWorkoutStats("month", token);
      if (data.success && data.muscleDistribution) {
        setMuscleData(
          Object.entries(data.muscleDistribution)
            .map(([name, share]) => ({ name, value: Math.round(share * 100) }))
            .sort((a, b) => b.value - a.value),
        );
      }
    } catch {
      // The page shows its empty state when the distribution cannot be loaded.
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  return (
    <PageShell maxWidth={980}>
      <PageHeader
        icon={Activity}
        eyebrow={t("statistics.eyebrow", "YOUR PROGRESS")}
        title={t("statistics.muscle_dist_body", "Muscle load grid")}
        description={t("statistics.muscle_dist_body_desc", "Share of your last 30 days' volume, muscle by muscle.")}
        onBack={() => navigate("/statistics/muscle-distribution")}
      />

      {loading ? (
        <Stack sx={{ minHeight: 220, alignItems: "center", justifyContent: "center" }}>
          <CircularProgress size={28} />
        </Stack>
      ) : muscleData.length === 0 ? (
        <EmptyState icon={Activity} title={t("common.no_data", "No data yet")} description={t("statistics.log_more_workouts", "Complete workouts to see your records here.")} />
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", md: "repeat(4, 1fr)" }, gap: 2 }}>
          {muscleData.map((item) => {
            const color = intensityColor(item.value);
            return (
              <Paper key={item.name} variant="outlined" sx={{ p: 2, textAlign: "center", borderRadius: 3 }}>
                <Box
                  sx={{
                    width: 52,
                    height: 52,
                    mx: "auto",
                    mb: 1.25,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: "50%",
                    bgcolor: alpha(color, 0.16),
                    color,
                  }}
                >
                  <Activity size={24} />
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {t(`statistics.muscle_${item.name.toLowerCase()}`, item.name)}
                </Typography>
                <Typography variant="caption" sx={{ color, fontWeight: 700 }}>
                  {item.value}
                  {t("statistics.training_share_percent", "% share")}
                </Typography>
              </Paper>
            );
          })}
        </Box>
      )}
    </PageShell>
  );
};

export default MuscleLoadGrid;
