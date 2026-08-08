import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import AddRounded from "@mui/icons-material/AddRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import EditOutlined from "@mui/icons-material/EditOutlined";
import { Ruler } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import type { BodyMeasurement, BodyMeasurementMetric } from "@motionmeet/shared";
import { deleteMeasurement, getMeasurements } from "~/api/endpoints";
import { EmptyState, PageHeader, PageShell } from "~/components/AppPage";
import MeasurementEntryDialog from "~/components/MeasurementEntryDialog";
import { MEASUREMENT_METRICS, dayKeyToDate, formatMetricValue } from "~/config/measurements";
import { useAuthContext } from "~/context/AuthProvider";

/** Newest first is how the API returns them; charts need the opposite. */
const chartPoints = (measurements: BodyMeasurement[], metric: BodyMeasurementMetric) =>
  measurements
    .filter((entry) => typeof entry[metric] === "number")
    .slice(0, 12)
    .reverse()
    .map((entry) => ({ day: entry.measuredOn, value: entry[metric] as number }));

const Measurements = () => {
  const { t, i18n } = useTranslation();
  const muiTheme = useTheme();
  const { getToken } = useAuthContext();

  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState<BodyMeasurementMetric>("weightKg");
  const [entryOpen, setEntryOpen] = useState(false);
  const [editing, setEditing] = useState<BodyMeasurement | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<BodyMeasurement | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const response = await getMeasurements(token);
      setMeasurements(Array.isArray(response?.measurements) ? response.measurements : []);
    } catch {
      // A failed refresh keeps whatever is already on screen rather than
      // blanking the history the athlete was reading.
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const locale = i18n.language.startsWith("tr") ? "tr-TR" : "en-US";
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }),
    [locale],
  );
  const shortFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: "numeric", month: "numeric" }),
    [locale],
  );

  /** Latest value per metric, plus the change since the previous entry. */
  const summaries = useMemo(
    () =>
      MEASUREMENT_METRICS.map((metric) => {
        const logged = measurements.filter((entry) => typeof entry[metric.key] === "number");
        const latest = logged[0];
        const previous = logged[1];
        const delta = latest && previous ? (latest[metric.key] as number) - (previous[metric.key] as number) : null;
        return {
          metric,
          latestValue: latest ? (latest[metric.key] as number) : null,
          latestDay: latest?.measuredOn ?? null,
          delta,
        };
      }),
    [measurements],
  );

  const activeConfig = MEASUREMENT_METRICS.find((metric) => metric.key === activeMetric) ?? MEASUREMENT_METRICS[0];
  const points = useMemo(
    () =>
      chartPoints(measurements, activeMetric).map((point) => ({
        label: shortFormatter.format(dayKeyToDate(point.day)),
        value: point.value,
      })),
    [measurements, activeMetric, shortFormatter],
  );

  const openEntry = (measurement?: BodyMeasurement) => {
    setEditing(measurement);
    setEntryOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    const token = await getToken();
    if (!token) return;
    // Optimistic: the row leaves immediately, and a failed call is corrected by
    // the reload that follows.
    setMeasurements((current) => current.filter((item) => item.id !== target.id));
    try {
      await deleteMeasurement(target.id, token);
    } catch {
      toast.error(t("measurements.delete_failed", "The measurement could not be deleted."));
    } finally {
      void load();
    }
  };

  return (
    <PageShell maxWidth={980}>
      <PageHeader
        icon={Ruler}
        eyebrow={t("measurements.eyebrow", "BODY")}
        title={t("measurements.title", "Measurements")}
        description={t("measurements.description", "Log your weight and body measurements to follow your progress over time.")}
        action={(
          <Button variant="contained" startIcon={<AddRounded />} onClick={() => openEntry()}>
            {t("measurements.add", "Add measurement")}
          </Button>
        )}
      />

      {loading ? (
        <Stack sx={{ minHeight: 220, alignItems: "center", justifyContent: "center" }}>
          <CircularProgress size={28} />
        </Stack>
      ) : measurements.length === 0 ? (
        <EmptyState
          icon={Ruler}
          title={t("measurements.empty_title", "No measurements yet")}
          description={t("measurements.empty_text", "Log your weight and body measurements to follow your progress over time.")}
          actionLabel={t("measurements.add", "Add measurement")}
          onAction={() => openEntry()}
        />
      ) : (
        <>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            {MEASUREMENT_METRICS.map((metric) => (
              <Chip
                key={metric.key}
                label={t(metric.labelKey, metric.fallback)}
                onClick={() => setActiveMetric(metric.key)}
                color={metric.key === activeMetric ? "primary" : "default"}
                variant={metric.key === activeMetric ? "filled" : "outlined"}
                sx={{ fontWeight: 700 }}
              />
            ))}
          </Stack>

          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              {t(activeConfig.labelKey, activeConfig.fallback)}{" "}
              <Typography component="span" variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                {activeConfig.unit}
              </Typography>
            </Typography>
            <Box sx={{ height: 240, mt: 1.5 }}>
              {points.length >= 2 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke={muiTheme.palette.divider} vertical={false} />
                    <XAxis dataKey="label" stroke={muiTheme.palette.text.disabled} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={muiTheme.palette.text.disabled} fontSize={11} tickLine={false} axisLine={false} domain={["dataMin - 2", "dataMax + 2"]} />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: muiTheme.palette.background.paper,
                        border: `1px solid ${muiTheme.palette.divider}`,
                        borderRadius: 12,
                        color: muiTheme.palette.text.primary,
                      }}
                      formatter={(value) => [
                        `${formatMetricValue(typeof value === "number" ? value : Number(value))} ${activeConfig.unit}`,
                        t(activeConfig.labelKey, activeConfig.fallback),
                      ]}
                    />
                    <Line type="monotone" dataKey="value" stroke={activeConfig.color} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Stack sx={{ height: "100%", alignItems: "center", justifyContent: "center" }}>
                  <Typography variant="body2" color="text.secondary">
                    {t("measurements.chart_hint", "Log at least two entries to see the trend.")}
                  </Typography>
                </Stack>
              )}
            </Box>
          </Paper>

          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{t("measurements.latest", "Latest values")}</Typography>
          <Paper variant="outlined" sx={{ overflow: "hidden" }}>
            {summaries.map((summary) => (
              <Stack
                key={summary.metric.key}
                direction="row"
                spacing={1.5}
                onClick={() => setActiveMetric(summary.metric.key)}
                sx={{
                  px: 2,
                  py: 1.25,
                  alignItems: "center",
                  cursor: "pointer",
                  borderBottom: 1,
                  borderColor: "divider",
                  "&:last-of-type": { borderBottom: 0 },
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: summary.metric.color, flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 800 }}>
                    {t(summary.metric.labelKey, summary.metric.fallback)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                    {summary.latestDay
                      ? dateFormatter.format(dayKeyToDate(summary.latestDay))
                      : t("measurements.not_logged", "Not logged")}
                  </Typography>
                </Box>
                <Stack sx={{ alignItems: "flex-end" }}>
                  <Typography variant="body2" sx={{ fontWeight: 900 }}>
                    {summary.latestValue === null ? "-" : `${formatMetricValue(summary.latestValue)} ${summary.metric.unit}`}
                  </Typography>
                  {summary.delta !== null && summary.delta !== 0 && (
                    <Typography variant="caption" sx={{ fontWeight: 800, color: summary.delta > 0 ? "success.main" : "error.main" }}>
                      {`${summary.delta > 0 ? "+" : ""}${formatMetricValue(summary.delta)} ${summary.metric.unit}`}
                    </Typography>
                  )}
                </Stack>
              </Stack>
            ))}
          </Paper>

          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{t("measurements.history", "History")}</Typography>
          <Stack spacing={1.5}>
            {measurements.map((entry) => {
              const logged = MEASUREMENT_METRICS.filter((metric) => typeof entry[metric.key] === "number");
              return (
                <Paper key={entry.id} variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                    <Typography variant="body2" sx={{ fontWeight: 900 }}>
                      {dateFormatter.format(dayKeyToDate(entry.measuredOn))}
                    </Typography>
                    <Stack direction="row">
                      <Tooltip title={t("common.edit", "Edit")}>
                        <IconButton size="small" aria-label={t("common.edit", "Edit")} onClick={() => openEntry(entry)}>
                          <EditOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t("common.delete", "Delete")}>
                        <IconButton size="small" color="error" aria-label={t("common.delete", "Delete")} onClick={() => setPendingDelete(entry)}>
                          <DeleteOutlineRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                  <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1.25, flexWrap: "wrap" }}>
                    {logged.map((metric) => (
                      <Box key={metric.key} sx={{ px: 1.25, py: 0.75, borderRadius: 2, bgcolor: "action.hover" }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontWeight: 700, fontSize: 10 }}>
                          {t(metric.labelKey, metric.fallback)}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 900 }}>
                          {`${formatMetricValue(entry[metric.key])} ${metric.unit}`}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                  {entry.note && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
                      {entry.note}
                    </Typography>
                  )}
                </Paper>
              );
            })}
          </Stack>
        </>
      )}

      <MeasurementEntryDialog
        open={entryOpen}
        existing={editing}
        onClose={() => setEntryOpen(false)}
        onSaved={() => {
          setEntryOpen(false);
          void load();
        }}
      />

      <Dialog open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)}>
        <DialogTitle>{t("measurements.delete_title", "Delete measurement")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("measurements.delete_message", "This entry will be removed permanently.")}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)}>{t("common.cancel", "Cancel")}</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>
            {t("common.delete", "Delete")}
          </Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
};

export default Measurements;
