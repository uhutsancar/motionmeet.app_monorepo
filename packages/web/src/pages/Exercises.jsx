import { useState, useEffect } from "react";
import {
    Box, Stack, Typography, Paper, TextField, Select, MenuItem,
    FormControl, Chip, CircularProgress, Button, Divider,
} from "@mui/material";
import { Add, FitnessCenter, Search } from "@mui/icons-material";
import { Activity, Zap, Calendar, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuthContext } from "../context/AuthProvider";
import CustomExerciseModal from "../components/CustomExerciseModal";
import { ResponsiveContainer, LineChart, XAxis, YAxis, Tooltip, Line } from "recharts";
import moment from "moment";
import { useMuscleGroups } from "../hooks/useMuscleGroups";
import { useEquipment } from "../hooks/useEquipment";
import { getExercises, getExerciseStats } from "../services/exerciseService";
import { BASEURL } from "~/config/env";

const getMediaUrl = (gifUrl) => {
    if (!gifUrl) return null;
    return `${BASEURL}/dataset/${gifUrl.replace(".gif", ".jpg").replace("videos/", "images/")}`;
};

const ExerciseImage = ({ gifUrl, size = 56 }) => {
    const [imgError, setImgError] = useState(false);
    const url = getMediaUrl(gifUrl);
    if (!url || imgError) {
        return (
            <Box sx={{
                width: size, height: size, borderRadius: 2,
                bgcolor: "action.hover", display: "flex",
                alignItems: "center", justifyContent: "center",
            }}>
                <FitnessCenter sx={{ fontSize: size * 0.45, color: "text.disabled" }} />
            </Box>
        );
    }
    return (
        <Box
            component="img"
            src={url}
            alt=""
            onError={() => setImgError(true)}
            sx={{ width: size, height: size, borderRadius: 2, objectFit: "cover", display: "block" }}
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
        const fetchStats = async () => {
            if (!selectedExercise) return;
            setStatsLoading(true);
            try {
                const token = await getToken();
                const data = await getExerciseStats(token, selectedExercise._id);
                if (data.success) setExerciseStats(data.stats);
            } catch (err) {
                console.error("Error fetching exercise stats:", err);
            } finally {
                setStatsLoading(false);
            }
        };
        fetchStats();
    }, [selectedExercise, getToken]);

    useEffect(() => {
        const fetchExercises = async () => {
            try {
                const token = await getToken();
                const data = await getExercises(token, {
                    search: searchQuery,
                    muscleGroup: muscleFilter,
                    equipment: equipmentFilter
                });
                if (data.success) setExercises(data.exercises);
            } catch (err) {
                console.error("Error fetching exercises:", err);
            }
        };
        const timeoutId = setTimeout(fetchExercises, 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery, muscleFilter, equipmentFilter, getToken]);

    return (
        <Box sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            height: { xs: "auto", md: "100%" },
            minHeight: "100%",
            overflow: { xs: "visible", md: "hidden" },
        }}>

            {/* ── Left: Detail Panel ── */}
            <Box sx={{ order: { xs: 2, md: 1 }, flex: 1, minWidth: 0, px: { xs: 1.5, sm: 3, lg: 4 }, py: { xs: 3, md: 4 }, overflowY: { xs: "visible", md: "auto" } }}>
                <Stack direction="row" alignItems="center" spacing={1.5} mb={{ xs: 2.5, md: 4 }}>
                    <Box sx={{ p: 1, bgcolor: "primary.main", borderRadius: 2, display: "flex" }}>
                        <Activity size={22} color="#fff" />
                    </Box>
                    <Typography variant="h4" sx={{ fontSize: { xs: 27, sm: 32 } }}>{t("menu.exercises")}</Typography>
                </Stack>

                <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "center", minHeight: 400 }}>
                    {selectedExercise ? (
                        <Paper elevation={1} sx={{ width: "100%", maxWidth: 780, borderRadius: 5, border: 1, borderColor: "divider", p: { xs: 2, sm: 4 } }}>
                            {/* Header */}
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={3} alignItems={{ sm: "center" }} mb={4}>
                                <ExerciseImage gifUrl={selectedExercise.gifUrl} size={120} />
                                <Box>
                                    <Typography variant="h4" fontWeight={900} mb={1}>{selectedExercise.name}</Typography>
                                    <Stack direction="row" spacing={1} flexWrap="wrap">
                                        <Chip label={t(`muscle_groups.${selectedExercise.muscleGroup}`, selectedExercise.muscleGroup)} color="primary" size="small" sx={{ fontWeight: 700 }} />
                                        <Chip label={t(`equipment.${selectedExercise.equipment}`, selectedExercise.equipment)} variant="outlined" size="small" sx={{ fontWeight: 700 }} />
                                    </Stack>
                                </Box>
                            </Stack>

                            <Divider sx={{ mb: 3 }} />

                            {/* Stats */}
                            <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2} mb={3}>
                                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
                                    <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                                        <Zap size={16} color="#f97316" />
                                        <Typography variant="caption" fontWeight={700} textTransform="uppercase" color="text.secondary">
                                            {t("exercises.personal_record")}
                                        </Typography>
                                    </Stack>
                                    <Typography variant="h5" fontWeight={900}>
                                        {exerciseStats?.personalRecord || 0}
                                        <Typography component="span" variant="body2" color="text.secondary" ml={0.5}>kg</Typography>
                                    </Typography>
                                </Paper>
                                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
                                    <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                                        <Calendar size={16} color="#3b82f6" />
                                        <Typography variant="caption" fontWeight={700} textTransform="uppercase" color="text.secondary">
                                            {t("exercises.total_sessions")}
                                        </Typography>
                                    </Stack>
                                    <Typography variant="h5" fontWeight={900}>{exerciseStats?.totalSessions || 0}</Typography>
                                </Paper>
                            </Box>

                            {/* Chart */}
                            <Paper variant="outlined" sx={{ borderRadius: 3, p: 3 }}>
                                <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                                    <Activity size={16} color="var(--mui-palette-primary-main)" />
                                    <Typography variant="subtitle2" fontWeight={700}>
                                        {t("exercises.progress_history", "Progress History")}
                                    </Typography>
                                </Stack>
                                <Box sx={{ height: 200 }}>
                                    {statsLoading ? (
                                        <Stack alignItems="center" justifyContent="center" height="100%">
                                            <CircularProgress size={28} />
                                        </Stack>
                                    ) : exerciseStats?.history?.length > 1 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={exerciseStats.history}>
                                                <XAxis dataKey="date" hide />
                                                <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
                                                <Tooltip
                                                    content={({ active, payload }) => {
                                                        if (active && payload?.length) {
                                                            return (
                                                                <Paper elevation={3} sx={{ p: 1.5, borderRadius: 2 }}>
                                                                    <Typography variant="caption" color="text.secondary" display="block">
                                                                        {moment(payload[0].payload.date).format("MMM DD, YYYY")}
                                                                    </Typography>
                                                                    <Typography variant="body2" fontWeight={700} color="primary">
                                                                        {payload[0].value} kg
                                                                    </Typography>
                                                                </Paper>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="maxWeight"
                                                    stroke="var(--mui-palette-primary-main)"
                                                    strokeWidth={3}
                                                    dot={{ r: 4 }}
                                                    activeDot={{ r: 6 }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <Stack alignItems="center" justifyContent="center" height="100%" spacing={1} sx={{ opacity: 0.4 }}>
                                            <Info size={32} />
                                            <Typography variant="caption" fontWeight={700} textTransform="uppercase">
                                                {t("exercises.more_sessions_needed", "Need at least 2 sessions for trends")}
                                            </Typography>
                                        </Stack>
                                    )}
                                </Box>
                            </Paper>
                        </Paper>
                    ) : (
                        <Paper variant="outlined" sx={{
                            width: "100%", maxWidth: 440, height: { xs: 290, md: 400 },
                            borderRadius: 5, borderStyle: "dashed",
                            display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center", p: 5,
                        }}>
                            <FitnessCenter sx={{ fontSize: 64, color: "text.disabled", mb: 2 }} />
                            <Typography variant="h6" fontWeight={800} mb={1}>{t("exercises.select_exercise")}</Typography>
                            <Typography variant="body2" color="text.secondary" textAlign="center">
                                {t("exercises.choose_from_library")}
                            </Typography>
                        </Paper>
                    )}
                </Box>
            </Box>

            {/* ── Right: Library Sidebar ── */}
            <Paper elevation={2} sx={{
                width: { xs: "100%", md: 340, lg: 380 },
                order: { xs: 1, md: 2 },
                display: "flex", flexDirection: "column",
                flexShrink: 0,
                maxHeight: { xs: 590, md: "none" },
                borderRadius: 0,
                borderLeft: { xs: 0, md: 1 },
                borderBottom: { xs: 1, md: 0 },
                borderColor: "divider",
                p: { xs: 2, md: 3 },
            }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="subtitle1" fontWeight={700}>{t("exercises.library")}</Typography>
                    <Button
                        size="small"
                        startIcon={<Add />}
                        onClick={() => setShowModal(true)}
                        sx={{ fontWeight: 700, borderRadius: 2 }}
                    >
                        {t("exercises.custom")}
                    </Button>
                </Stack>

                {/* Search */}
                <TextField
                    fullWidth
                    size="small"
                    placeholder={t("exercises.search")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{ startAdornment: <Search sx={{ mr: 1, color: "text.disabled", fontSize: 18 }} /> }}
                    sx={{ mb: 1.5 }}
                />

                {/* Filters */}
                <Stack direction="row" spacing={1} mb={2}>
                    <FormControl size="small" fullWidth>
                        <Select
                            value={equipmentFilter}
                            onChange={(e) => setEquipmentFilter(e.target.value)}
                            sx={{ borderRadius: 2, fontSize: 13 }}
                        >
                            <MenuItem value="All Equipment">{t("exercises.all_equipment", "All Equipment")}</MenuItem>
                            {equipmentListItems.map((eq) => <MenuItem key={eq.code} value={eq.code} sx={{ fontSize: 13 }}>{t(`equipment.${eq.code}`, eq.name)}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" fullWidth>
                        <Select
                            value={muscleFilter}
                            onChange={(e) => setMuscleFilter(e.target.value)}
                            sx={{ borderRadius: 2, fontSize: 13 }}
                        >
                            <MenuItem value="All Muscles">{t("exercises.all_muscles", "All Muscles")}</MenuItem>
                            {muscleGroupsList.map((mg) => <MenuItem key={mg.code} value={mg.code} sx={{ fontSize: 13 }}>{t(`muscle_groups.${mg.code}`, mg.name)}</MenuItem>)}
                        </Select>
                    </FormControl>
                </Stack>

                {/* Exercise List */}
                <Box className="no-scrollbar" sx={{ flex: 1, minHeight: 0, overflowY: "auto", maxHeight: { xs: 360, md: "none" } }}>
                    {exercises.length > 0 ? (
                        exercises.map((exercise) => {
                            const isSelected = selectedExercise?._id === exercise._id;
                            return (
                                <Box
                                    key={exercise._id}
                                    onClick={() => setSelectedExercise(exercise)}
                                    sx={{
                                        display: "flex", alignItems: "center", gap: 1.5,
                                        p: 1.25, mb: 0.5, borderRadius: 3, cursor: "pointer",
                                        bgcolor: isSelected ? "action.selected" : "transparent",
                                        "&:hover": { bgcolor: "action.hover" },
                                        transition: "background 0.15s",
                                        borderLeft: isSelected ? 3 : "transparent",
                                        borderColor: "primary.main",
                                    }}
                                >
                                    <ExerciseImage gifUrl={exercise.gifUrl} size={48} />
                                    <Box flex={1} minWidth={0}>
                                        <Typography
                                            variant="body2" fontWeight={700} noWrap
                                            color={isSelected ? "primary" : "text.primary"}
                                        >
                                            {exercise.name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" noWrap>
                                            {exercise.muscleGroup} · {exercise.equipment}
                                        </Typography>
                                    </Box>
                                </Box>
                            );
                        })
                    ) : (
                        <Stack alignItems="center" justifyContent="center" pt={8} spacing={1} sx={{ opacity: 0.5 }}>
                            <FitnessCenter sx={{ fontSize: 48, color: "text.disabled" }} />
                            <Typography variant="caption" fontWeight={700} textTransform="uppercase">
                                {t("exercises.not_found")}
                            </Typography>
                        </Stack>
                    )}
                </Box>
            </Paper>

            {showModal && (
                <CustomExerciseModal
                    setShowModal={setShowModal}
                    onExerciseCreated={(newExercise) => setExercises((prev) => [newExercise, ...prev])}
                />
            )}
        </Box>
    );
};

export default Exercises;

