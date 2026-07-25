import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../context/AuthProvider";
import api from "~/api/axios";
import { useMuscleGroups } from "../hooks/useMuscleGroups";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import CircularProgress from "@mui/material/CircularProgress";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import KeyboardArrowDownRounded from "@mui/icons-material/KeyboardArrowDownRounded";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import { Dumbbell } from "lucide-react";
import { PageHeader, PageShell } from "~/components/AppPage";

const MuscleDistribution = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getToken } = useAuthContext();
  const { data: muscleGroupsList, isLoading: isMusclesLoading } = useMuscleGroups();
  const [period, setPeriod] = useState("month");
  const [anchorEl, setAnchorEl] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const periodLabels = {
    week: t("statistics.last_7_days", "Last 7 days"),
    month: t("statistics.last_30_days", "Last 30 days"),
    year: t("statistics.last_year", "Last year"),
  };

  useEffect(() => {
    let active = true;
    const fetchStats = async () => {
      setLoading(true);
      try {
        const token = await getToken();
        const { data } = await api.get(`/api/workout/stats?period=${period}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (active && data.success) setStats(data);
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchStats();
    return () => {
      active = false;
    };
  }, [period, getToken]);

  const muscleKeys = muscleGroupsList.map((group) => group.code);
  const values = muscleKeys.map((key) => stats?.muscleDistribution?.[key] ?? 0);
  const angles = muscleKeys.map((_, index) => (Math.PI * 2 * index) / (muscleKeys.length || 1) - Math.PI / 2);
  const size = 300;
  const center = size / 2;
  const radius = size / 2 - 42;
  const getPoint = (value, index) => {
    const pointRadius = radius * Math.max(value, 0.02);
    return `${center + pointRadius * Math.cos(angles[index])},${center + pointRadius * Math.sin(angles[index])}`;
  };
  const currentPolygon = values.map((value, index) => getPoint(value, index)).join(" ");
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1];

  const periodAction = (
    <>
      <Button
        variant="outlined"
        color="inherit"
        endIcon={<KeyboardArrowDownRounded />}
        onClick={(event) => setAnchorEl(event.currentTarget)}
      >
        {periodLabels[period]}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        slotProps={{ paper: { sx: { mt: 1, minWidth: 180 } } }}
      >
        {Object.entries(periodLabels).map(([key, label]) => (
          <MenuItem
            key={key}
            selected={period === key}
            onClick={() => {
              setPeriod(key);
              setAnchorEl(null);
            }}
          >
            {label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );

  const summaryItems = [
    { label: t("statistics.workouts", "Workouts"), value: stats?.totalWorkouts ?? 0, unit: "" },
    { label: t("statistics.duration", "Duration"), value: stats?.totalDuration ?? 0, unit: "min" },
    { label: t("statistics.volume", "Volume"), value: stats?.totalVolume ?? 0, unit: "kg" },
    { label: t("statistics.sets", "Sets"), value: stats?.totalSets ?? 0, unit: "" },
  ];

  return (
    <PageShell maxWidth={1040}>
      <PageHeader
        icon={Dumbbell}
        title={t("statistics.muscle_dist", "Muscle Distribution")}
        description={t("statistics.muscle_dist_desc", "See which muscle groups received the most training volume.")}
        onBack={() => navigate("/statistics")}
        action={periodAction}
      />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.35fr) minmax(300px, .65fr)" }, gap: 2 }}>
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, minHeight: 430, display: "grid", placeItems: "center" }}>
          {loading || isMusclesLoading ? (
            <CircularProgress size={30} />
          ) : (
            <Stack spacing={2.5} sx={{ alignItems: "center", width: "100%" }}>
              <Box component="svg" viewBox={`0 0 ${size} ${size}`} sx={{ width: "min(100%, 340px)", overflow: "visible" }}>
                {gridLevels.map((level) => (
                  <polygon
                    key={level}
                    points={muscleKeys.map((_, index) => getPoint(level, index)).join(" ")}
                    stroke="var(--mui-palette-divider)"
                    strokeWidth="1"
                    fill="none"
                  />
                ))}
                {muscleKeys.map((key, index) => (
                  <line
                    key={key}
                    x1={center}
                    y1={center}
                    x2={center + radius * Math.cos(angles[index])}
                    y2={center + radius * Math.sin(angles[index])}
                    stroke="var(--mui-palette-divider)"
                    strokeWidth="1"
                  />
                ))}
                <polygon
                  points={currentPolygon}
                  stroke="var(--mui-palette-primary-main)"
                  strokeWidth="2.5"
                  fill="var(--mui-palette-primary-main)"
                  fillOpacity="0.14"
                />
                {muscleKeys.map((key, index) => {
                  const x = center + (radius + 30) * Math.cos(angles[index]);
                  const y = center + (radius + 30) * Math.sin(angles[index]);
                  const group = muscleGroupsList.find((item) => item.code === key);
                  return (
                    <text
                      key={`${key}-label`}
                      x={x}
                      y={y + 4}
                      fontSize="11"
                      fontWeight="600"
                      fill="var(--mui-palette-text-secondary)"
                      textAnchor="middle"
                    >
                      {t(`muscle_groups.${key}`, group?.name || key)}
                    </text>
                  );
                })}
              </Box>
              <Stack direction="row" spacing={2.5}>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                  <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: "primary.main" }} />
                  <Typography variant="caption" color="text.secondary">{t("statistics.current", "Current")}</Typography>
                </Stack>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                  <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: "text.disabled" }} />
                  <Typography variant="caption" color="text.secondary">{t("statistics.previous", "Previous")}</Typography>
                </Stack>
              </Stack>
            </Stack>
          )}
        </Paper>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", lg: "1fr" }, gap: 1.5 }}>
          {summaryItems.map((item) => (
            <Paper key={item.label} variant="outlined" sx={{ p: 2.25 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{item.label}</Typography>
              <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 800 }}>
                {Number(item.value).toLocaleString()}{" "}
                {item.unit && <Typography component="span" variant="caption" color="text.secondary">{item.unit}</Typography>}
              </Typography>
              <Stack direction="row" spacing={0.4} sx={{ mt: 0.75, alignItems: "center", color: "success.main" }}>
                <ArrowUpwardRounded sx={{ fontSize: 14 }} />
                <Typography variant="caption" sx={{ fontWeight: 700 }}>{t("statistics.current_period", "Current period")}</Typography>
              </Stack>
            </Paper>
          ))}
        </Box>
      </Box>
    </PageShell>
  );
};

export default MuscleDistribution;
