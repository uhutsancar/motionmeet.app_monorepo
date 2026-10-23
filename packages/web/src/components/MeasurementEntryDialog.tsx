import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import axios from "axios";
import type { ApiFailure, BodyMeasurement, BodyMeasurementMetric } from "@motionmeet/shared";
import { getMeasurements, saveMeasurement, type SaveMeasurementPayload } from "~/api/endpoints";
import { MEASUREMENT_METRICS, dayKeyToDate, toDayKey } from "~/config/measurements";
import { useAuthContext } from "~/context/AuthProvider";

interface MeasurementEntryDialogProps {
  open: boolean;
  existing?: BodyMeasurement;
  onClose: () => void;
  onSaved: () => void;
}

type DraftValues = Record<BodyMeasurementMetric, string>;

const emptyDraft = (): DraftValues =>
  Object.fromEntries(MEASUREMENT_METRICS.map((metric) => [metric.key, ""])) as DraftValues;

/** An existing entry opens pre-filled so editing a day never wipes the rest. */
const draftFrom = (measurement?: BodyMeasurement): DraftValues => {
  const draft = emptyDraft();
  if (!measurement) return draft;
  for (const metric of MEASUREMENT_METRICS) {
    const value = measurement[metric.key];
    if (typeof value === "number") draft[metric.key] = `${value}`;
  }
  return draft;
};

/** Accepts both 82.4 and the comma form a Turkish keyboard produces. */
const parseInput = (raw: string): number | null => {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const MeasurementEntryDialog = ({ open, existing, onClose, onSaved }: MeasurementEntryDialogProps) => {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuthContext();

  const [dayKey, setDayKey] = useState<string>(() => existing?.measuredOn ?? toDayKey(new Date()));
  const [values, setValues] = useState<DraftValues>(() => draftFrom(existing));
  const [note, setNote] = useState<string>(existing?.note ?? "");
  const [saving, setSaving] = useState(false);

  // Saving replaces the whole day, so a day that already has values must open
  // pre-filled - otherwise adding today's weight would silently wipe the waist
  // and arm figures logged earlier the same day.
  const loadedDayRef = useRef<string | null>(existing ? existing.measuredOn : null);

  // Reopening the dialog for a different entry has to start from that entry.
  useEffect(() => {
    if (!open) return;
    const startDay = existing?.measuredOn ?? toDayKey(new Date());
    loadedDayRef.current = existing ? existing.measuredOn : null;
    setDayKey(startDay);
    setValues(draftFrom(existing));
    setNote(existing?.note ?? "");
  }, [existing, open]);

  useEffect(() => {
    if (!open || loadedDayRef.current === dayKey) return;
    let active = true;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const response = await getMeasurements(token);
        if (!active) return;
        const sameDay = (response?.measurements ?? []).find((entry) => entry.measuredOn === dayKey);
        loadedDayRef.current = dayKey;
        setValues(draftFrom(sameDay));
        setNote(sameDay?.note ?? "");
      } catch {
        // A failed lookup leaves the form as-is; the day simply starts empty.
      }
    })();
    return () => { active = false; };
  }, [dayKey, getToken, open]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language.startsWith("tr") ? "tr-TR" : "en-US", {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    [i18n.language],
  );

  const today = toDayKey(new Date());
  const isToday = dayKey === today;

  const shiftDay = useCallback((days: number) => {
    setDayKey((current) => {
      const next = dayKeyToDate(current);
      next.setDate(next.getDate() + days);
      // Measurements can only be logged for a day that has already happened.
      const nextKey = toDayKey(next);
      return nextKey > toDayKey(new Date()) ? current : nextKey;
    });
  }, []);

  const setValue = (metric: BodyMeasurementMetric, raw: string) => {
    // Digits plus a single separator.
    const cleaned = raw.replace(/[^0-9.,]/g, "").replace(/([.,])(?=.*[.,])/g, "");
    setValues((current) => ({ ...current, [metric]: cleaned }));
  };

  const onSave = async () => {
    const payload: SaveMeasurementPayload = { measuredOn: dayKey, note: note.trim() };
    let provided = 0;

    for (const metric of MEASUREMENT_METRICS) {
      const parsed = parseInput(values[metric.key]);
      if (parsed === null) continue;
      if (Number.isNaN(parsed) || parsed < metric.min || parsed > metric.max) {
        toast.error(
          `${t(metric.labelKey, metric.fallback)}: ${t("measurements.range_error", "Value must be between {{min}} and {{max}}.", {
            min: metric.min,
            max: metric.max,
          })}`,
        );
        return;
      }
      payload[metric.key] = parsed;
      provided += 1;
    }

    if (provided === 0) {
      toast.error(t("measurements.empty_error", "Enter at least one value before saving."));
      return;
    }

    setSaving(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication required");
      await saveMeasurement(payload, token);
      toast.success(t("measurements.saved", "Measurement saved"));
      onSaved();
    } catch (error: unknown) {
      const failure = axios.isAxiosError<ApiFailure>(error) ? error.response?.data : undefined;
      toast.error(failure?.message || t("measurements.save_error", "Could not save the measurement. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>
        {existing ? t("measurements.edit", "Edit measurement") : t("measurements.add", "Add measurement")}
      </DialogTitle>
      <DialogContent dividers>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", p: 1, mb: 2, borderRadius: 2, border: 1, borderColor: "divider", bgcolor: "action.hover" }}
        >
          <IconButton aria-label={t("measurements.previous_day", "Previous day")} onClick={() => shiftDay(-1)}>
            <ChevronLeftRounded />
          </IconButton>
          <Box sx={{ flex: 1, minWidth: 0, textAlign: "center" }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
              {dateFormatter.format(dayKeyToDate(dayKey))}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              {isToday ? t("measurements.today", "Today") : t("measurements.past_entry", "Past entry")}
            </Typography>
          </Box>
          <IconButton aria-label={t("measurements.next_day", "Next day")} disabled={isToday} onClick={() => shiftDay(1)}>
            <ChevronRightRounded />
          </IconButton>
        </Stack>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
          {MEASUREMENT_METRICS.map((metric) => (
            <TextField
              key={metric.key}
              size="small"
              label={`${t(metric.labelKey, metric.fallback)} (${metric.unit})`}
              value={values[metric.key]}
              onChange={(event) => setValue(metric.key, event.target.value)}
              slotProps={{ htmlInput: { inputMode: "decimal", maxLength: 6 } }}
            />
          ))}
        </Box>

        <TextField
          fullWidth
          multiline
          minRows={2}
          size="small"
          sx={{ mt: 2 }}
          label={t("measurements.note", "Note")}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 500 } }}
        />

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
          {t("measurements.upsert_hint", "Saving again for the same day updates that entry.")}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>{t("common.cancel", "Cancel")}</Button>
        <Button
          variant="contained"
          onClick={onSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={15} color="inherit" /> : null}
        >
          {t("common.save", "Save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MeasurementEntryDialog;
