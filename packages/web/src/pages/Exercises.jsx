import { useEffect, useState } from "react";
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
  TextField,
  Typography,
} from "@mui/material";
import { Add, FitnessCenter, Search } from "@mui/icons-material";
import { Activity, Calendar, Info, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuthContext } from "../context/AuthProvider";
import CustomExerciseModal from "../components/CustomExerciseModal";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import moment from "moment";
import { useMuscleGroups } from "../hooks/useMuscleGroups";
import { useEquipment } from "../hooks/useEquipment";
import { getExercises, getExerciseStats } from "../services/exerciseService";
import { BASEURL } from "~/config/env";
import { EmptyState, PageHeader, PageShell } from "~/components/AppPage";

const getMediaUrl = (gifUrl) => {
  if (!gifUrl) return null;
  return `${BASEURL}/dataset/${gifUrl.replace(".gif", ".jpg").replace("videos/", "images/")}`;
};

const ExerciseImage = ({ gifUrl, size = 56 }) => {
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

const Exercises = () => {
  const { t } = useTranslation();
  const { getToken } = useAuthContext();
  const { data: muscleGroupsList } = useMuscleGroups();
  const { data: equipmentListItems } = useEquipment();
  const [exercises, setExercises] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("All Muscles");
  const [equipmentFilter, setEquipmentFilter] = useState("All Equipment");
  const [showModal, setShowModal] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [exerciseStats, setExerciseStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchStats = async () => {
      if (!selectedExercise) return;
      setStatsLoading(true);
      try {
        const token = await getToken();
        const data = await getExerciseStats(token, selectedExercise._id);
        if (active && data.success) setExerciseStats(data.stats);
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

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      try {
        const token = await getToken();
        const data = await getExercises(token, {
          search: searchQuery,
          muscleGroup: muscleFilter,
          equipment: equipmentFilter,
        });
        if (data.success) setExercises(data.exercises);
      } catch (error) {
        console.error("Error fetching exercises:", error);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, muscleFilter, equipmentFilter, getToken]);

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
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>{selectedExercise.name}</Typography>
                  <Stack direction="row" useFlexGap sx={{ mt: 1, flexWrap: "wrap", gap: 0.75 }}>
                    <Chip label={t(`muscle_groups.${selectedExercise.muscleGroup}`, selectedExercise.muscleGroup)} color="primary" size="small" />
                    <Chip label={t(`equipment.${selectedExercise.equipment}`, selectedExercise.equipment)} variant="outlined" size="small" />
                  </Stack>
                </Box>
              </Stack>

              <Divider sx={{ my: 2.5 }} />

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
                <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 800 }}>{t("exercises.progress_history", "Progress history")}</Typography>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Box sx={{ height: 220 }}>
                    {statsLoading ? (
                      <Stack sx={{ height: "100%", alignItems: "center", justifyContent: "center" }}><CircularProgress size={26} /></Stack>
                    ) : exerciseStats?.history?.length > 1 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={exerciseStats.history}>
                          <XAxis dataKey="date" hide />
                          <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
                          <Tooltip
                            content={({ active, payload }) => (
                              active && payload?.length ? (
                                <Paper elevation={3} sx={{ p: 1.5, border: 1, borderColor: "divider" }}>
                                  <Typography variant="caption" color="text.secondary">{moment(payload[0].payload.date).format("MMM DD, YYYY")}</Typography>
                                  <Typography variant="body2" color="primary.main" sx={{ fontWeight: 800 }}>{payload[0].value} kg</Typography>
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
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{t("exercises.library", "Library")}</Typography>
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
            {exercises.length > 0 ? exercises.map((exercise) => {
              const selected = selectedExercise?._id === exercise._id;
              return (
                <Box
                  component="button"
                  key={exercise._id}
                  onClick={() => setSelectedExercise(exercise)}
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
                <Typography variant="body2" color="text.secondary">{t("exercises.not_found", "No exercises found")}</Typography>
              </Stack>
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
