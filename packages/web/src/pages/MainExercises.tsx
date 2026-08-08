import Avatar from "@mui/material/Avatar";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Dumbbell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { WorkoutStats } from "@motionmeet/shared";
import { getWorkoutStats } from "~/api/endpoints";
import { EmptyState, PageHeader, PageShell } from "~/components/AppPage";
import { useAuthContext } from "~/context/AuthProvider";

type ExerciseBreakdown = WorkoutStats["exerciseBreakdown"][number];

/** The movements that carried the last 30 days, ranked by volume. */
const MainExercises = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getToken } = useAuthContext();
  const [exercises, setExercises] = useState<ExerciseBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await getWorkoutStats("month", token);
      if (data.success && data.exerciseBreakdown) setExercises(data.exerciseBreakdown);
    } catch {
      // The page shows its empty state when the breakdown cannot be loaded.
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  return (
    <PageShell maxWidth={860}>
      <PageHeader
        icon={Dumbbell}
        eyebrow={t("statistics.eyebrow", "YOUR PROGRESS")}
        title={t("statistics.main_exercises", "Main exercises")}
        description={t("statistics.main_exercises_desc", "The movements that carried your last 30 days.")}
        onBack={() => navigate("/statistics")}
      />

      {loading ? (
        <Stack sx={{ minHeight: 220, alignItems: "center", justifyContent: "center" }}>
          <CircularProgress size={28} />
        </Stack>
      ) : exercises.length === 0 ? (
        <EmptyState icon={Dumbbell} title={t("common.no_data", "No data yet")} description={t("statistics.log_more_workouts", "Complete workouts to see your records here.")} />
      ) : (
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          {exercises.map((item, index) => {
            const key = item.name.toLowerCase().replace(/[\s-]/g, "_").replace("pull_up", "pullup");
            return (
              <Stack
                key={`${item.name}-${index}`}
                direction="row"
                spacing={2}
                sx={{ px: 2, py: 1.75, alignItems: "center", borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 } }}
              >
                <Avatar sx={{ width: 40, height: 40, bgcolor: "action.hover", color: "primary.main", fontWeight: 900, fontSize: 14 }}>
                  #{index + 1}
                </Avatar>
                <Stack sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>
                    {t(`statistics.ex_${key}`, item.name)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {(item.volume || 0).toLocaleString()} {t("common.kg", "kg")} · {(item.reps || 0).toLocaleString()} {t("routines.reps", "reps").toLowerCase()} · {item.sets || 0} {t("statistics.sets", "sets").toLowerCase()}
                  </Typography>
                </Stack>
              </Stack>
            );
          })}
        </Paper>
      )}
    </PageShell>
  );
};

export default MainExercises;
