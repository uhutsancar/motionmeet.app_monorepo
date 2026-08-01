import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, BarChart3, Clock, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useAuthContext } from "../context/AuthProvider";
import api from "~/api/axios";
import { API_ROUTES } from "@motionmeet/shared";
import { Box, Paper, Skeleton, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { PageHeader, PageShell } from "~/components/AppPage";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { WorkoutStats } from "@motionmeet/shared";

interface ChartTooltipProps { active?: boolean; payload?: ReadonlyArray<{ value?: number | string }>; label?: ReactNode; unit: ReactNode }
interface MetricProps { icon: LucideIcon; label: ReactNode; value: number; unit: ReactNode; color: string }
interface ChartCardProps { icon: LucideIcon; title: ReactNode; children: ReactNode; color?: string }

const ChartTooltip = ({ active, payload, label, unit }: ChartTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <Paper elevation={3} sx={{ p: 1.5, border: 1, borderColor: "divider" }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
        {Number(payload[0].value || 0).toLocaleString()}{" "}
        <Typography component="span" variant="caption" color="text.secondary">{unit}</Typography>
      </Typography>
    </Paper>
  );
};

const Metric = ({ icon: Icon, label, value, unit, color }: MetricProps) => (
  <Paper variant="outlined" sx={{ p: 2 }}>
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
      <Box sx={{ width: 38, height: 38, display: "grid", placeItems: "center", borderRadius: 2, bgcolor: "action.hover", color }}>
        <Icon size={19} />
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{label}</Typography>
        <Typography variant="h6" sx={{ mt: 0.15, fontWeight: 800 }}>
          {Number(value || 0).toLocaleString()}{" "}
          <Typography component="span" variant="caption" color="text.secondary">{unit}</Typography>
        </Typography>
      </Box>
    </Stack>
  </Paper>
);

const ChartCard = ({ icon: Icon, title, children, color = "primary.main" }: ChartCardProps) => (
  <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0 }}>
    <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
      <Box sx={{ color, display: "flex" }}><Icon size={18} /></Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{title}</Typography>
    </Stack>
    {children}
  </Paper>
);

const AdvancedStatistics = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getToken } = useAuthContext();
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");
  const [statsData, setStatsData] = useState<WorkoutStats["stats"] | null>(null);
  const [loading, setLoading] = useState(true);

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
        if (active && data.success) setStatsData(data.stats);
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

  const chartData = useMemo(() => (
    statsData?.labels?.map((label, index) => ({
      name: label,
      volume: statsData.volumes?.[index] || 0,
      reps: statsData.reps?.[index] || 0,
      duration: statsData.durations?.[index] || 0,
    })) || []
  ), [statsData]);

  const totals = useMemo(() => chartData.reduce(
    (result, item) => ({
      volume: result.volume + item.volume,
      reps: result.reps + item.reps,
      duration: result.duration + item.duration,
    }),
    { volume: 0, reps: 0, duration: 0 },
  ), [chartData]);

  const periodSelector = (
    <ToggleButtonGroup
      value={period}
      exclusive
      size="small"
      onChange={(_, nextPeriod) => nextPeriod && setPeriod(nextPeriod)}
      sx={{
        bgcolor: "background.paper",
        p: 0.5,
        border: 1,
        borderColor: "divider",
        borderRadius: 2.5,
        "& .MuiToggleButton-root": {
          minWidth: 72,
          border: 0,
          borderRadius: 2,
          px: 2,
          py: 0.75,
          fontWeight: 700,
          textTransform: "none",
          "&.Mui-selected": { bgcolor: "primary.main", color: "primary.contrastText" },
        },
      }}
    >
      {["week", "month", "year"].map((item) => (
        <ToggleButton key={item} value={item}>{t(`statistics.${item}`, item)}</ToggleButton>
      ))}
    </ToggleButtonGroup>
  );

  return (
    <PageShell maxWidth={1180}>
      <PageHeader
        icon={BarChart3}
        title={t("statistics.advanced", "Advanced Statistics")}
        description={t("statistics.advanced_desc", "Volume, set and rep details")}
        onBack={() => navigate("/statistics")}
        action={periodSelector}
      />

      {loading ? (
        <Stack spacing={2}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2 }}>
            {[0, 1, 2].map((item) => <Skeleton key={item} variant="rounded" height={78} />)}
          </Box>
          <Skeleton variant="rounded" height={330} />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2 }}>
            <Skeleton variant="rounded" height={290} />
            <Skeleton variant="rounded" height={290} />
          </Box>
        </Stack>
      ) : (
        <Stack spacing={2}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2 }}>
            <Metric icon={TrendingUp} label={t("statistics.volume", "Volume")} value={totals.volume} unit="kg" color="primary.main" />
            <Metric icon={Activity} label="Reps" value={totals.reps} unit="reps" color="success.main" />
            <Metric icon={Clock} label={t("statistics.duration", "Duration")} value={totals.duration} unit="min" color="info.dark" />
          </Box>

          <ChartCard icon={TrendingUp} title={`${t("statistics.volume", "Volume")} (${t("statistics.total_uppercase", "Total")})`}>
            <Box sx={{ height: 270, width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "var(--text-secondary)", fontSize: 11 }} dy={8} />
                  <YAxis width={54} axisLine={false} tickLine={false} tick={{ fill: "var(--text-secondary)", fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip unit="kg" />} />
                  <Area type="monotone" dataKey="volume" stroke="var(--accent-primary)" strokeWidth={2.5} fill="url(#volumeGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </ChartCard>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2 }}>
            <ChartCard icon={Activity} title={`Reps (${t("statistics.total_uppercase", "Total")})`} color="success.main">
              <Box sx={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "var(--text-secondary)", fontSize: 11 }} dy={8} />
                    <Tooltip content={<ChartTooltip unit="reps" />} />
                    <Bar dataKey="reps" fill="#22A06B" radius={[4, 4, 0, 0]} maxBarSize={34} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </ChartCard>

            <ChartCard icon={Clock} title={t("statistics.duration", "Duration")} color="info.dark">
              <Box sx={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "var(--text-secondary)", fontSize: 11 }} dy={8} />
                    <Tooltip content={<ChartTooltip unit="min" />} />
                    <Area type="monotone" dataKey="duration" stroke="#3284FF" strokeWidth={2.5} fill="#3284FF" fillOpacity={0.08} />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </ChartCard>
          </Box>
        </Stack>
      )}
    </PageShell>
  );
};

export default AdvancedStatistics;
