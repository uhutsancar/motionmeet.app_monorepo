import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Dumbbell, FileText, MoreHorizontal, PlayCircle, Plus, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuthContext } from "../context/AuthProvider";
import api from "~/api/axios";
import { API_ROUTES, type Routine } from "@motionmeet/shared";
import { useNavigate } from "react-router";
import RoutineBuilderModal from "../components/RoutineBuilderModal";
import { Box, Button, Chip, IconButton, Paper, Stack, Typography } from "@mui/material";
import { EmptyState, PageHeader, PageShell, SectionHeader } from "~/components/AppPage";

const Routines = () => {
  const { t } = useTranslation();
  const { getToken } = useAuthContext();
  const navigate = useNavigate();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchRoutines = useCallback(async (cursor: string | null = null) => {
    try {
      if (cursor) setLoadingMore(true);
      const token = await getToken();
      if (!token) return;
      const { data } = await api.get<{ success: boolean; routines: Routine[]; nextCursor: string | null }>(API_ROUTES.routine.base, {
        headers: { Authorization: `Bearer ${token}` },
        params: cursor ? { cursor } : undefined,
      });
      if (data.success) {
        setRoutines((currentRoutines) => {
          if (!cursor) return data.routines || [];
          const knownIds = new Set(currentRoutines.map((routine) => routine._id));
          return [
            ...currentRoutines,
            ...(data.routines || []).filter((routine) => !knownIds.has(routine._id)),
          ];
        });
        setNextCursor(data.nextCursor);
      }
    } catch (error) {
      console.error("Error fetching routines:", error);
    } finally {
      if (cursor) setLoadingMore(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchRoutines();
  }, [fetchRoutines]);

  return (
    <PageShell maxWidth={1120}>
      <PageHeader
        icon={Dumbbell}
        eyebrow="TRAINING PLANS"
        title={t("routines.title", "Routines")}
        description="Build repeatable sessions and start training without setup."
        action={(
          <Button variant="contained" startIcon={<Plus size={17} />} onClick={() => setShowBuilder(true)}>
            {t("routines.new_routine", "New routine")}
          </Button>
        )}
      />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
        <Paper
          component="button"
          variant="outlined"
          onClick={() => navigate("/active-workout", {
            state: {
              routine: {
                name: t("routines.quick_workout", "Quick workout"),
                exercises: [],
              },
            },
          })}
          sx={{
            p: 2.5,
            display: "flex",
            alignItems: "center",
            gap: 2,
            textAlign: "left",
            color: "text.primary",
            cursor: "pointer",
            font: "inherit",
            "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
          }}
        >
          <Box sx={{ width: 42, height: 42, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 2.5, bgcolor: "primary.main", color: "primary.contrastText" }}>
            <PlayCircle size={21} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{t("routines.start_empty", "Quick workout")}</Typography>
            <Typography variant="body2" color="text.secondary">{t("routines.start_empty_desc", "Start a session without a routine")}</Typography>
          </Box>
          <ArrowRight size={18} />
        </Paper>

        <Paper
          component="button"
          variant="outlined"
          sx={{
            p: 2.5,
            display: "flex",
            alignItems: "center",
            gap: 2,
            textAlign: "left",
            color: "text.primary",
            cursor: "pointer",
            font: "inherit",
            "&:hover": { borderColor: "secondary.main", bgcolor: "action.hover" },
          }}
        >
          <Box sx={{ width: 42, height: 42, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 2.5, bgcolor: "action.hover", color: "secondary.main" }}>
            <Search size={21} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{t("routines.discover", "Discover")}</Typography>
            <Typography variant="body2" color="text.secondary">{t("routines.discover_desc", "Explore community favourites")}</Typography>
          </Box>
          <ArrowRight size={18} />
        </Paper>
      </Box>

      <Stack spacing={1.5}>
        <SectionHeader
          title={`${t("routines.my_routines", "My routines")} (${routines.length})`}
          description="Your saved training templates"
        />

        {routines.length > 0 ? (
          <Stack spacing={1.25}>
            {routines.map((routine) => (
              <Paper key={routine._id} variant="outlined" sx={{ p: { xs: 2, sm: 2.25 } }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  sx={{ alignItems: { xs: "stretch", sm: "center" } }}
                >
                  <Box sx={{ width: 44, height: 44, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 2.5, bgcolor: "action.hover", color: "primary.main" }}>
                    <FileText size={21} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Typography variant="subtitle1" noWrap sx={{ fontWeight: 800 }}>{routine.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{routine.exercises.length} exercises</Typography>
                    </Stack>
                    <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 0.75, mt: 0.8 }}>
                      {routine.exercises.slice(0, 3).map((exercise, index) => {
                        const entity = exercise.exerciseId && typeof exercise.exerciseId !== "string" ? exercise.exerciseId : null;
                        return <Chip key={exercise.id || index} label={exercise.exerciseName || entity?.name || "Exercise"} size="small" />;
                      })}
                      {routine.exercises.length > 3 && <Chip label={`+${routine.exercises.length - 3}`} size="small" variant="outlined" />}
                    </Stack>
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                    <IconButton aria-label="Routine options" size="small"><MoreHorizontal size={18} /></IconButton>
                    <Button
                      variant="contained"
                      startIcon={<PlayCircle size={17} />}
                      onClick={() => navigate("/active-workout", { state: { routine } })}
                    >
                      {t("routines.start_routine", "Start")}
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : (
          <EmptyState
            icon={FileText}
            title={t("routines.no_routines", "No routines yet")}
            description={t("routines.start_building", "Create your first plan and keep your next session ready.")}
            actionLabel={t("routines.new_routine", "Create routine")}
            onAction={() => setShowBuilder(true)}
          />
        )}

        {nextCursor && (
          <Button
            variant="outlined"
            onClick={() => fetchRoutines(nextCursor)}
            disabled={loadingMore}
            sx={{ alignSelf: "center" }}
          >
            {loadingMore ? t("common.loading", "Loading...") : t("common.load_more", "Load more")}
          </Button>
        )}
      </Stack>

      {showBuilder && (
        <RoutineBuilderModal
          setShowModal={setShowBuilder}
          onRoutineCreated={(routine) => setRoutines((current) => [routine, ...current])}
        />
      )}
    </PageShell>
  );
};

export default Routines;
