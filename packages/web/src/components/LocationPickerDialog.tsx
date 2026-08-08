import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import ListItemButton from "@mui/material/ListItemButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import { MapPin, Navigation } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import axios from "axios";
import type { ApiFailure, LocationSuggestion, ProfileLocation, ProfileLocationSource } from "@motionmeet/shared";
import { getRecentLocations, resolveCoordinates, saveProfileLocation, searchLocations } from "~/api/endpoints";
import { useAppDispatch } from "~/app/hooks";
import { useAuthContext } from "~/context/AuthProvider";
import { fetchUser } from "~/features/user/userSlice";
import { useDeviceLocation } from "~/hooks/useDeviceLocation";

/**
 * Picks a profile location from the reference dataset.
 *
 * There is no free-text path out of this dialog on purpose: the member either
 * selects a suggestion the backend returned or closes it without changing
 * anything. Whatever ends up on the profile is a label the server rendered from
 * the record that was chosen.
 *
 * "Use my current location" is only a shortcut *into* the same list — the fix
 * is turned into a suggestion the member still has to confirm, and it never
 * enables the Nearby feature as a side effect.
 */

/** Long enough to swallow a burst of typing, short enough to feel immediate. */
const DEBOUNCE_MS = 280;
const MIN_QUERY_LENGTH = 2;

interface LocationPickerDialogProps {
  open: boolean;
  source?: ProfileLocationSource;
  onClose: () => void;
  onSaved: (location: ProfileLocation) => void;
}

/**
 * The browser locale biases the ranking so a member in Turkey typing "nil" gets
 * Nilüfer before Nilphamari. It only reorders equally good text matches — no
 * result is ever hidden because of it — and it is read from the language tag,
 * not from any location permission.
 */
const browserRegion = (): string | null => {
  const tag = typeof navigator === "undefined" ? "" : navigator.language || "";
  const region = tag.split("-")[1];
  return region && /^[A-Za-z]{2}$/.test(region) ? region.toUpperCase() : null;
};

const LocationPickerDialog = ({ open, source = "manual_search", onClose, onSaved }: LocationPickerDialogProps) => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { getToken } = useAuthContext();
  const { busy: locating, requestFix } = useDeviceLocation();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationSuggestion[]>([]);
  const [recent, setRecent] = useState<LocationSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [proposal, setProposal] = useState<LocationSuggestion | null>(null);

  const locale = i18n.language.startsWith("tr") ? "tr" : "en";
  const country = useMemo(browserRegion, []);
  // Cancels the request a newer keystroke has already made irrelevant, so
  // out-of-order responses can never overwrite the visible list.
  const inFlight = useRef<AbortController | null>(null);
  const trimmed = query.trim();

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setProposal(null);
    setFailed(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const response = await getRecentLocations(token, locale);
        if (active && response.success) setRecent(response.results ?? []);
      } catch {
        // Recent picks are a convenience; the search field works without them.
      }
    })();
    return () => { active = false; };
  }, [getToken, locale, open]);

  useEffect(() => {
    if (!open) return undefined;
    if (trimmed.length < MIN_QUERY_LENGTH) {
      inFlight.current?.abort();
      setResults([]);
      setSearching(false);
      setFailed(false);
      return undefined;
    }

    setSearching(true);
    setFailed(false);
    const timer = setTimeout(() => {
      void (async () => {
        inFlight.current?.abort();
        const controller = new AbortController();
        inFlight.current = controller;
        try {
          const token = await getToken();
          if (!token) return;
          const response = await searchLocations(trimmed, token, { locale, country, limit: 15, signal: controller.signal });
          if (controller.signal.aborted) return;
          setResults(response.success ? response.results ?? [] : []);
        } catch {
          // An aborted request is a newer keystroke, not a failure.
          if (controller.signal.aborted) return;
          setResults([]);
          setFailed(true);
        } finally {
          if (!controller.signal.aborted) setSearching(false);
        }
      })();
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [country, getToken, locale, open, trimmed]);

  const select = useCallback(async (suggestion: LocationSuggestion) => {
    if (saving) return;
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) throw new Error(t("auth.session_expired", "Your session has expired."));
      // The id is what travels; the label on screen is only what the member saw.
      const payload = suggestion.kind === "city"
        ? { cityId: suggestion.id }
        : suggestion.kind === "state"
          ? { stateId: suggestion.id }
          : { countryId: suggestion.id };
      const response = await saveProfileLocation({ ...payload, source }, token, locale);
      if (!response.success) throw new Error(response.message);
      await dispatch(fetchUser(token));
      toast.success(response.location?.displayName || suggestion.displayName);
      onSaved(response.location);
    } catch (error: unknown) {
      const failure = axios.isAxiosError<ApiFailure>(error) ? error.response?.data : undefined;
      toast.error(failure?.message || t("location.save_failed", "The location could not be saved."));
    } finally {
      setSaving(false);
    }
  }, [dispatch, getToken, locale, onSaved, saving, source, t]);

  /**
   * Reads the browser position and offers the nearest settlement. Nothing is
   * written until the member confirms, and Nearby stays untouched.
   */
  const detectCurrentLocation = useCallback(async () => {
    const result = await requestFix();
    if (result.outcome !== "granted" || !result.fix) {
      const messages: Record<string, string> = {
        denied: t("location.permission_denied", "Location permission is needed to detect your city. You can also search for it instead."),
        blocked: t("location.permission_blocked", "Location is blocked for MotionMeet in your browser. Allow it from the address bar, or search for your city instead."),
        insecure_context: t("location.insecure_context", "Browsers only share your position over https. Search for your city instead."),
        unavailable: t("location.fix_unavailable", "Your position could not be read right now. Please try again, or search for your city."),
        timeout: t("location.fix_timeout", "Reading your position took too long. Please try again, or search for your city."),
      };
      toast.error(messages[result.outcome] ?? messages.unavailable);
      return;
    }

    try {
      const token = await getToken();
      if (!token) return;
      const response = await resolveCoordinates({ latitude: result.fix.latitude, longitude: result.fix.longitude }, token, locale);
      if (!response.success || !response.suggestion) {
        toast.error(t("location.no_match", "No known place matched your position. Please search for your city instead."));
        return;
      }
      setProposal(response.suggestion);
    } catch (error: unknown) {
      const failure = axios.isAxiosError<ApiFailure>(error) ? error.response?.data : undefined;
      toast.error(failure?.message || t("location.current_failed", "Could not detect your location"));
    }
  }, [getToken, locale, requestFix, t]);

  const listed = trimmed.length >= MIN_QUERY_LENGTH ? results : recent;
  const listHeading = trimmed.length >= MIN_QUERY_LENGTH
    ? t("location.results", "Results")
    : recent.length
      ? t("location.recent", "Recently used")
      : "";

  const emptyState = () => {
    if (searching) {
      return (
        <Stack spacing={1.25} sx={{ py: 4, alignItems: "center" }}>
          <CircularProgress size={24} />
          <Typography variant="body2" color="text.secondary">{t("location.searching", "Searching…")}</Typography>
        </Stack>
      );
    }
    if (failed) {
      return (
        <Stack spacing={0.75} sx={{ py: 4, px: 3, alignItems: "center", textAlign: "center" }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{t("location.offline_title", "No connection")}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t("location.offline_body", "Locations could not be loaded. Check your connection and try again.")}
          </Typography>
        </Stack>
      );
    }
    if (trimmed.length >= MIN_QUERY_LENGTH) {
      return (
        <Stack spacing={0.75} sx={{ py: 4, px: 3, alignItems: "center", textAlign: "center" }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{t("location.no_results_title", "No matches")}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t("location.no_results_body", "Try the city name, or the province it belongs to.")}
          </Typography>
        </Stack>
      );
    }
    return (
      <Stack spacing={0.75} sx={{ py: 4, px: 3, alignItems: "center", textAlign: "center" }}>
        <MapPin size={22} />
        <Typography variant="body2" color="text.secondary">
          {t("location.hint", "Type at least two letters to find your city, district or country.")}
        </Typography>
      </Stack>
    );
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 800 }}>
        <Box sx={{ flex: 1 }}>{t("location.picker_title", "Choose location")}</Box>
        <IconButton aria-label={t("common.close", "Close")} onClick={onClose} disabled={saving}>
          <CloseRounded />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <TextField
          autoFocus
          fullWidth
          size="small"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("location.search_placeholder", "City, district or country")}
          slotProps={{
            htmlInput: { maxLength: 80 },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />

        <Button
          fullWidth
          variant="outlined"
          disabled={locating || saving}
          startIcon={locating ? <CircularProgress size={15} /> : <Navigation size={16} />}
          onClick={() => { void detectCurrentLocation(); }}
          sx={{ mt: 1.5, justifyContent: "flex-start", py: 1.25 }}
        >
          <Box sx={{ textAlign: "left" }}>
            <Typography variant="body2" sx={{ fontWeight: 800 }}>{t("location.use_current", "Use my current location")}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t("location.use_current_hint", "Suggests a city. Nothing is saved until you confirm.")}
            </Typography>
          </Box>
        </Button>

        {proposal && (
          <Paper variant="outlined" sx={{ mt: 1.5, p: 1.75, borderColor: "primary.main" }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {t("location.proposal_title", "Set your profile location to this?")}
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 0.5 }}>
              {proposal.countryEmoji} {proposal.displayName}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
              <Button fullWidth variant="contained" disabled={saving} onClick={() => { void select(proposal); }}>
                {t("common.confirm", "Confirm")}
              </Button>
              <Button fullWidth variant="outlined" color="inherit" onClick={() => setProposal(null)}>
                {t("common.cancel", "Cancel")}
              </Button>
            </Stack>
          </Paper>
        )}

        {listHeading && (
          <Typography variant="overline" color="text.secondary" sx={{ display: "block", mt: 2, fontWeight: 900 }}>
            {listHeading}
          </Typography>
        )}

        <Paper variant="outlined" sx={{ mt: 1, overflow: "hidden", maxHeight: 320, overflowY: "auto" }}>
          {listed.length === 0
            ? emptyState()
            : listed.map((item) => (
                <ListItemButton
                  key={`${item.kind}:${item.id}`}
                  disabled={saving}
                  onClick={() => { void select(item); }}
                  sx={{ gap: 1.5, borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 } }}
                >
                  <Typography sx={{ fontSize: 20 }}>{item.countryEmoji || "📍"}</Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>{item.name}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>{item.displayName}</Typography>
                  </Box>
                  <ChevronRightRounded fontSize="small" sx={{ color: "text.disabled" }} />
                </ListItemButton>
              ))}
        </Paper>

        {/* ODbL requires the source to stay visible wherever the data is shown. */}
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5, textAlign: "center" }}>
          {t("location.attribution", "Place data by Countries States Cities Database · ODbL v1.0")}
        </Typography>
      </DialogContent>
    </Dialog>
  );
};

export default LocationPickerDialog;
