import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
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
import { alpha, useTheme } from "@mui/material/styles";
import KeyboardArrowDownRounded from "@mui/icons-material/KeyboardArrowDownRounded";
import { Dumbbell } from "lucide-react";
import { API_ROUTES, type WorkoutStats } from "@motionmeet/shared";
import { PageHeader, PageShell } from "~/components/AppPage";

const MuscleDistribution = () => {
  const { t } = useTranslation();
  const muiTheme = useTheme();
  const navigate = useNavigate();
  const { getToken } = useAuthContext();
  const { data: muscleGroupsList, isLoading: isMusclesLoading } = useMuscleGroups();
  type Period = "week" | "month" | "year";
  const [period, setPeriod] = useState<Period>("month");
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [stats, setStats] = useState<WorkoutStats | null>(null);
  const [loading, setLoading] = useState(true);

  const periodLabels: Record<Period, string> = {
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
        if (!token) return;
        const { data } = await api.get<WorkoutStats & { success: boolean }>(API_ROUTES.workout.stats, {
          headers: { Authorization: `Bearer ${token}` },
          params: { period }
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
  const getPoint = (value: number, index: number): string => {
    const pointRadius = radius * Math.max(value, 0.02);
    return `${center + pointRadius * Math.cos(angles[index])},${center + pointRadius * Math.sin(angles[index])}`;
  };
  const currentPolygon = values.map((value, index) => getPoint(value, index)).join(" ");
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1];
  const hasDistribution = values.some((value) => value > 0);
  const chartAccent = muiTheme.palette.mode === "dark" ? "#60A5FA" : "#2563EB";

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
              setPeriod(key as Period);
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
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 2, sm: 3 },
            minHeight: 430,
            display: "grid",
            placeItems: "center",
            background: `radial-gradient(circle at 50% 46%, ${alpha(chartAccent, 0.1)}, transparent 48%), ${muiTheme.palette.background.paper}`,
          }}
        >
          {loading || isMusclesLoading ? (
            <CircularProgress size={30} />
          ) : (
            <Stack spacing={2.5} sx={{ alignItems: "center", width: "100%" }}>
              <Box component="svg" viewBox={`0 0 ${size} ${size}`} sx={{ width: "min(100%, 340px)", overflow: "visible" }}>
                {gridLevels.map((level) => (
                  <polygon
                    key={level}
                    points={muscleKeys.map((_, index) => getPoint(level, index)).join(" ")}
                    stroke={muiTheme.palette.divider}
                    strokeWidth="1"
                    fill={level === 1 ? alpha(chartAccent, 0.025) : "none"}
                  />
                ))}
                {muscleKeys.map((key, index) => (
                  <line
                    key={key}
                    x1={center}
                    y1={center}
                    x2={center + radius * Math.cos(angles[index])}
                    y2={center + radius * Math.sin(angles[index])}
                    stroke={muiTheme.palette.divider}
                    strokeWidth="1"
                  />
                ))}
                {hasDistribution && (
                  <>
                    <polygon
                      points={currentPolygon}
                      stroke={chartAccent}
                      strokeWidth="3"
                      strokeLinejoin="round"
                      fill={chartAccent}
                      fillOpacity="0.18"
                    />
                    {values.map((value, index) => {
                      const [x, y] = getPoint(value, index).split(",");
                      return (
                        <circle
                          key={`${muscleKeys[index]}-point`}
                          cx={x}
                          cy={y}
                          r="3.5"
                          fill={muiTheme.palette.background.paper}
                          stroke={chartAccent}
                          strokeWidth="2.5"
                        />
                      );
                    })}
                  </>
                )}
                <circle cx={center} cy={center} r="2.5" fill={chartAccent} />
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
                      fill={muiTheme.palette.text.secondary}
                      textAnchor="middle"
                    >
                      {t(`muscle_groups.${key}`, group?.name || key)}
                    </text>
                  );
                })}
              </Box>
              <Stack direction="row" spacing={2.5} sx={{ minHeight: 22, alignItems: "center" }}>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                  <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: chartAccent, boxShadow: `0 0 0 4px ${alpha(chartAccent, 0.12)}` }} />
                  <Typography variant="caption" color="text.secondary">{t("statistics.current", "Current")}</Typography>
                </Stack>
                {!hasDistribution && (
                  <Typography variant="caption" color="text.secondary">
                    {t("monthly_report.no_data", "No training data for this period")}
                  </Typography>
                )}
              </Stack>
            </Stack>
          )}
        </Paper>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", lg: "1fr" }, gap: 1.5 }}>
          {summaryItems.map((item) => (
            <Paper key={item.label} variant="outlined" sx={{ p: 2.25 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{item.label}</Typography>
              <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 700 }}>
                {Number(item.value).toLocaleString()}{" "}
                {item.unit && <Typography component="span" variant="caption" color="text.secondary">{item.unit}</Typography>}
              </Typography>
              <Stack direction="row" spacing={0.6} sx={{ mt: 0.75, alignItems: "center", color: "text.secondary" }}>
                <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: chartAccent }} />
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
