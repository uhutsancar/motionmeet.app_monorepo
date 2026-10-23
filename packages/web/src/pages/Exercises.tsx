import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { Add, FitnessCenter, Search } from "@mui/icons-material";
import { Activity, Calendar, Info, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuthContext } from "../context/AuthProvider";
import CustomExerciseModal from "../components/CustomExerciseModal";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import dayjs from "../utils/dayjs";
import { useMuscleGroups } from "../hooks/useMuscleGroups";
import { useEquipment } from "../hooks/useEquipment";
import { getExercises, getExerciseStats } from "../services/exerciseService";
import { getExerciseHistory } from "~/api/endpoints";
import { resolvePublicMediaUrl, type Exercise, type ExerciseSessionEntry, type ExerciseStats } from "@motionmeet/shared";
import { EmptyState, PageHeader, PageShell } from "~/components/AppPage";

type DetailTab = "summary" | "history" | "instructions";

const getMediaUrl = (gifUrl: string): string | null => {
  return resolvePublicMediaUrl(gifUrl);
};

const ExerciseImage = ({ gifUrl, size = 56 }: { gifUrl: string; size?: number }) => {
  const [imageError, setImageError] = useState(false);
  const url = getMediaUrl(gifUrl);
  if (!url || imageError) {
    return (
      <Box sx={{ width: size, height: size, flexShrink: 0, borderRadius: 2, bgcolor: "action.hover", display: "grid", placeItems: "center" }}>
        <FitnessCenter sx={{ fontSize: size * 0.42, color: "text.disabled" }} />
      </Box>
    );
  }
  return (
    <Box
      component="img"
      src={url}
      alt=""
      onError={() => setImageError(true)}
      sx={{ width: size, height: size, flexShrink: 0, borderRadius: 2, objectFit: "cover", display: "block" }}
    />
  );
};

/** Steps are stored per language, with English as the shipped fallback. */
const ExerciseInstructions = ({ exercise }: { exercise: Exercise }) => {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage?.split("-")[0] || "en";
  const steps = exercise.instructionSteps?.[language] || exercise.instructionSteps?.en || [];
  const instruction = exercise.instructions?.[language] || exercise.instructions?.en || "";

  if (steps.length === 0 && !instruction) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t("exercises.instructions_unavailable", "Instructions are not available for this exercise yet.")}
      </Typography>
    );
  }

  return steps.length > 0 ? (
    <Stack component="ol" spacing={1.25} sx={{ pl: 2.5, m: 0 }}>
      {steps.map((step, index) => (
        <Typography key={`${index}-${step.slice(0, 12)}`} component="li" variant="body2" sx={{ lineHeight: 1.7 }}>
          {step}
        </Typography>
      ))}
    </Stack>
  ) : (
    <Typography variant="body2" sx={{ lineHeight: 1.75 }}>{instruction}</Typography>
  );
};

const Exercises = () => {
  const { t } = useTranslation();
  const { getToken } = useAuthContext();
  const { data: muscleGroupsList } = useMuscleGroups();
  const { data: equipmentListItems } = useEquipment();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("All Muscles");
  const [equipmentFilter, setEquipmentFilter] = useState("All Equipment");
  const [showModal, setShowModal] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [exerciseStats, setExerciseStats] = useState<ExerciseStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("summary");
  const [history, setHistory] = useState<ExerciseSessionEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadedFor, setHistoryLoadedFor] = useState<string | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [libraryError, setLibraryError] = useState("");
  const libraryRequestRef = useRef(0);
  const exerciseHistory = exerciseStats?.history ?? [];

  useEffect(() => {
    let active = true;
    const fetchStats = async () => {
      if (!selectedExercise) return;
      setStatsLoading(true);
      try {
        const token = await getToken();
        if (!token) throw new Error("Authentication required");
        const data = await getExerciseStats(token, selectedExercise._id);
        if (active && data.success && data.stats) setExerciseStats(data.stats);
      } catch (error) {
        console.error("Error fetching exercise stats:", error);
      } finally {
        if (active) setStatsLoading(false);
      }
    };
    fetchStats();
    return () => {
      active = false;
    };
  }, [selectedExercise, getToken]);

  // History is only fetched when its tab is opened; picking an exercise should
  // not pay for a query the athlete may never look at.
  const loadHistory = useCallback(async (exerciseId: string) => {
    if (historyLoadedFor === exerciseId || historyLoading) return;
    setHistoryLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication required");
      const data = await getExerciseHistory(exerciseId, token, 20);
      if (data.success) setHistory(data.history || []);
      setHistoryLoadedFor(exerciseId);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [getToken, historyLoadedFor, historyLoading]);

  useEffect(() => {
    if (detailTab === "history" && selectedExercise) void loadHistory(selectedExercise._id);
  }, [detailTab, loadHistory, selectedExercise]);

  useEffect(() => {
    const requestId = ++libraryRequestRef.current;
    setLibraryLoading(true);
    setLoadingMore(false);
    setLibraryError("");
    setNextCursor(null);
    const timeoutId = setTimeout(async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Authentication required");
        const data = await getExercises(token, {
          search: searchQuery,
          muscleGroup: muscleFilter,
          equipment: equipmentFilter,
          limit: 50,
        });
        if (libraryRequestRef.current !== requestId) return;
        if (data.success) {
          setExercises(data.exercises || []);
          setNextCursor(data.nextCursor || null);
        } else {
          throw new Error(data.message || "Exercises could not be loaded");
        }
      } catch (error: unknown) {
        if (libraryRequestRef.current === requestId) {
          setExercises([]);
          setLibraryError(error instanceof Error ? error.message : "Exercises could not be loaded");
        }
      } finally {
        if (libraryRequestRef.current === requestId) setLibraryLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, muscleFilter, equipmentFilter, getToken]);

  const loadMoreExercises = async () => {
    if (!nextCursor || loadingMore) return;
    const requestId = ++libraryRequestRef.current;
    setLoadingMore(true);
    setLibraryError("");
    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication required");
      const data = await getExercises(token, {
        search: searchQuery,
        muscleGroup: muscleFilter,
        equipment: equipmentFilter,
        cursor: nextCursor,
        limit: 50,
      });
      if (libraryRequestRef.current !== requestId) return;
      if (!data.success) throw new Error(data.message || "Exercises could not be loaded");
      setExercises((current) => {
        const knownIds = new Set(current.map((exercise) => exercise._id));
        return [
          ...current,
          ...(data.exercises || []).filter((exercise) => !knownIds.has(exercise._id)),
        ];
      });
      setNextCursor(data.nextCursor || null);
    } catch (error: unknown) {
      if (libraryRequestRef.current === requestId) {
        setLibraryError(error instanceof Error ? error.message : "Exercises could not be loaded");
      }
    } finally {
      if (libraryRequestRef.current === requestId) setLoadingMore(false);
    }
  };

  return (
    <PageShell maxWidth={1200}>
      <PageHeader
        icon={Activity}
        eyebrow="EXERCISE LIBRARY"
        title={t("menu.exercises", "Exercises")}
        description="Browse movements and review your exercise-level progress."
        action={(
          <Button variant="contained" startIcon={<Add />} onClick={() => setShowModal(true)}>
            {t("exercises.custom", "Custom exercise")}
          </Button>
        )}
      />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 2fr) minmax(280px, 1fr)" }, gap: 2.5, alignItems: "start" }}>
        <Box sx={{ order: { xs: 2, md: 1 }, minWidth: 0 }}>
          {selectedExercise ? (
            <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5} sx={{ alignItems: { sm: "center" } }}>
                <ExerciseImage gifUrl={selectedExercise.gifUrl} size={96} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>{selectedExercise.name}</Typography>
                  <Stack direction="row" useFlexGap sx={{ mt: 1, flexWrap: "wrap", gap: 0.75 }}>
                    <Chip label={t(`muscle_groups.${selectedExercise.muscleGroup}`, selectedExercise.muscleGroup)} color="primary" size="small" />
                    <Chip label={t(`equipment.${selectedExercise.equipment}`, selectedExercise.equipment)} variant="outlined" size="small" />
                  </Stack>
                </Box>
              </Stack>

              <Tabs
                value={detailTab}
                onChange={(_, value: DetailTab) => setDetailTab(value)}
                sx={{ mt: 2, minHeight: 42, borderBottom: 1, borderColor: "divider" }}
              >
                <Tab value="summary" label={t("exercises.tab_summary", "Summary")} />
                <Tab value="history" label={t("exercises.tab_history", "History")} />
                <Tab value="instructions" label={t("exercises.tab_instructions", "Instructions")} />
              </Tabs>

              {detailTab === "summary" && (
                <Box sx={{ mt: 2.5 }}>
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.5 }}>
                    <Paper variant="outlined" sx={{ p: 2, bgcolor: "action.hover" }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5, color: "warning.main" }}>
                        <Zap size={16} />
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{t("exercises.personal_record", "Personal record")}</Typography>
                      </Stack>
                      <Typography variant="h6">{exerciseStats?.personalRecord || 0} <Typography component="span" variant="caption" color="text.secondary">kg</Typography></Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 2, bgcolor: "action.hover" }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5, color: "info.dark" }}>
                        <Calendar size={16} />
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{t("exercises.total_sessions", "Total sessions")}</Typography>
                      </Stack>
                      <Typography variant="h6">{exerciseStats?.totalSessions || 0}</Typography>
                    </Paper>
                  </Box>

                  <Box sx={{ mt: 2.5 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 700 }}>{t("exercises.progress_history", "Progress history")}</Typography>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Box sx={{ height: 220 }}>
                        {statsLoading ? (
                          <Stack sx={{ height: "100%", alignItems: "center", justifyContent: "center" }}><CircularProgress size={26} /></Stack>
                        ) : exerciseHistory.length > 1 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={exerciseHistory}>
                              <XAxis dataKey="date" hide />
                              <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
                              <Tooltip
                                content={({ active, payload }) => (
                                  active && payload?.length ? (
                                    <Paper elevation={3} sx={{ p: 1.5, border: 1, borderColor: "divider" }}>
                                      <Typography variant="caption" color="text.secondary">{dayjs(payload[0].payload.date).format("MMM DD, YYYY")}</Typography>
                                      <Typography variant="body2" color="primary.main" sx={{ fontWeight: 700 }}>{payload[0].value} kg</Typography>
                                    </Paper>
                                  ) : null
                                )}
                              />
                              <Line type="monotone" dataKey="maxWeight" stroke="var(--mui-palette-primary-main)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <Stack sx={{ height: "100%", alignItems: "center", justifyContent: "center", textAlign: "center" }} spacing={1}>
                            <Info size={24} color="var(--text-muted)" />
                            <Typography variant="body2" color="text.secondary">{t("exercises.more_sessions_needed", "Complete at least two sessions to see a trend.")}</Typography>
                          </Stack>
                        )}
                      </Box>
                    </Paper>
                  </Box>
                </Box>
              )}

              {detailTab === "history" && (
                <Box sx={{ mt: 2.5 }}>
                  {historyLoading ? (
                    <Stack sx={{ minHeight: 180, alignItems: "center", justifyContent: "center" }}><CircularProgress size={26} /></Stack>
                  ) : history.length === 0 ? (
                    <Stack spacing={1} sx={{ minHeight: 180, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                      <FitnessCenter sx={{ color: "text.disabled" }} />
                      <Typography variant="body2" color="text.secondary">
                        {t("exercises.no_history", "No sessions logged for this exercise yet")}
                      </Typography>
                    </Stack>
                  ) : (
                    <Stack spacing={1.5}>
                      {history.map((session) => (
                        <Paper key={`${session.workoutId}-${session.performedAt}`} variant="outlined" sx={{ p: 2 }}>
                          <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>{session.workoutName}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {dayjs(session.performedAt).format("D MMM YYYY, HH:mm")}
                          </Typography>
                          <Stack spacing={0.5} sx={{ mt: 1.25 }}>
                            {session.sets.map((set) => (
                              <Stack key={`${session.workoutId}-${set.position}`} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                                <Typography variant="caption" color="text.secondary" sx={{ width: 24, fontWeight: 700 }}>
                                  {set.position + 1}
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {set.weight} kg × {set.reps}
                                </Typography>
                              </Stack>
                            ))}
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  )}
                </Box>
              )}

              {detailTab === "instructions" && (
                <Box sx={{ mt: 2.5 }}>
                  <ExerciseInstructions exercise={selectedExercise} />
                </Box>
              )}
            </Paper>
          ) : (
            <EmptyState
              icon={Activity}
              title={t("exercises.select_exercise", "Select an exercise")}
              description={t("exercises.choose_from_library", "Choose a movement from the library to see your history and statistics.")}
              minHeight={420}
            />
          )}
        </Box>

        <Paper variant="outlined" sx={{ order: { xs: 1, md: 2 }, p: 2, minWidth: 0 }}>
          <Stack direction="row" sx={{ mb: 1.5, alignItems: "center", justifyContent: "space-between" }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{t("exercises.library", "Library")}</Typography>
              <Typography variant="caption" color="text.secondary">{exercises.length} movements</Typography>
            </Box>
          </Stack>

          <TextField
            fullWidth
            size="small"
            placeholder={t("exercises.search", "Search exercises")}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: "text.disabled", fontSize: 18 }} /> } }}
          />

          <Stack direction="row" spacing={1} sx={{ my: 1.25 }}>
            <FormControl size="small" fullWidth>
              <Select value={equipmentFilter} onChange={(event) => setEquipmentFilter(event.target.value)} sx={{ fontSize: 13 }}>
                <MenuItem value="All Equipment">{t("exercises.all_equipment", "All equipment")}</MenuItem>
                {equipmentListItems.map((item) => <MenuItem key={item.code} value={item.code}>{t(`equipment.${item.code}`, item.name)}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <Select value={muscleFilter} onChange={(event) => setMuscleFilter(event.target.value)} sx={{ fontSize: 13 }}>
                <MenuItem value="All Muscles">{t("exercises.all_muscles", "All muscles")}</MenuItem>
                {muscleGroupsList.map((item) => <MenuItem key={item.code} value={item.code}>{t(`muscle_groups.${item.code}`, item.name)}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>

          <Divider />
          <Box className="no-scrollbar" sx={{ mt: 1, maxHeight: { xs: 360, md: 580 }, overflowY: "auto" }}>
            {libraryLoading ? (
              <Stack sx={{ minHeight: 180, alignItems: "center", justifyContent: "center" }}>
                <CircularProgress size={26} />
              </Stack>
            ) : exercises.length > 0 ? exercises.map((exercise) => {
              const selected = selectedExercise?._id === exercise._id;
              return (
                <Box
                  component="button"
                  key={exercise._id}
                  onClick={() => {
                    setSelectedExercise(exercise);
                    // A new movement starts on its summary, never on the
                    // previous one's history.
                    setDetailTab("summary");
                    setHistory([]);
                    setHistoryLoadedFor(null);
                  }}
                  sx={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 1.25,
                    p: 1,
                    mb: 0.5,
                    border: 0,
                    borderRadius: 2,
                    bgcolor: selected ? "action.selected" : "transparent",
                    color: "text.primary",
                    textAlign: "left",
                    cursor: "pointer",
                    font: "inherit",
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <ExerciseImage gifUrl={exercise.gifUrl} size={44} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 700, color: selected ? "primary.main" : "text.primary" }}>{exercise.name}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>{exercise.muscleGroup} · {exercise.equipment}</Typography>
                  </Box>
                </Box>
              );
            }) : (
              <Stack spacing={1} sx={{ minHeight: 180, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                <FitnessCenter sx={{ color: "text.disabled" }} />
                <Typography variant="body2" color="text.secondary">
                  {libraryError || t("exercises.not_found", "No exercises found")}
                </Typography>
              </Stack>
            )}
            {!libraryLoading && nextCursor && (
              <Button
                fullWidth
                size="small"
                onClick={loadMoreExercises}
                disabled={loadingMore}
                startIcon={loadingMore ? <CircularProgress size={14} /> : null}
                sx={{ mt: 0.75 }}
              >
                {t("common.load_more", "Load more")}
              </Button>
            )}
          </Box>
        </Paper>
      </Box>

      {showModal && (
        <CustomExerciseModal
          setShowModal={setShowModal}
          onExerciseCreated={(newExercise) => setExercises((current) => [newExercise, ...current])}
        />
      )}
    </PageShell>
  );
};

export default Exercises;
