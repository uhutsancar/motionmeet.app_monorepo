import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import { Compass, MapPin, Navigation } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import axios from "axios";
import { NEARBY_SCOPES, type ApiFailure, type NearbyScope, type NearbySettings, type NearbyUser } from "@motionmeet/shared";
import { getNearbySettings, getNearbyUsers, updateNearbyPosition, updateNearbySettings } from "~/api/endpoints";
import { PageHeader, PageShell } from "~/components/AppPage";
import FollowButton from "~/components/FollowButton";
import { BAND_LABELS, SCOPE_LABELS } from "~/config/nearbyLabels";
import { useAuthContext } from "~/context/AuthProvider";
import { useDeviceLocation, type LocationOutcome } from "~/hooks/useDeviceLocation";

/**
 * Nearby athletes.
 *
 * The page never sees a coordinate come back. It sends one fix when the member
 * opens it or refreshes, and renders whatever distance band the backend decided
 * each person is willing to expose.
 *
 * Every permission outcome the browser can produce has its own copy and its own
 * recovery action, because "dismissed the prompt", "blocked for this site" and
 * "the page is not on https" need three different things from the member.
 */

/** A fix this fresh is not worth asking the browser for again. */
const FIX_REUSE_MS = 15 * 60 * 1000;

const errorMessage = (error: unknown, fallback: string): string => {
  const failure = axios.isAxiosError<ApiFailure>(error) ? error.response?.data : undefined;
  return failure?.message || (error instanceof Error ? error.message : fallback);
};

const Nearby = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getToken } = useAuthContext();
  const { busy: locating, requestFix, checkPermission } = useDeviceLocation();

  const [settings, setSettings] = useState<NearbySettings | null>(null);
  const [users, setUsers] = useState<NearbyUser[]>([]);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState<LocationOutcome | null>(null);
  const [toggling, setToggling] = useState(false);
  // Prevents the mount effect and a manual refresh from racing each other.
  const loadingRef = useRef(false);

  const enabled = settings?.enabled ?? false;

  const loadList = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const response = await getNearbyUsers(token, 30);
    if (!response.success) throw new Error(response.message);
    setSettings(response.settings);
    setUsers(response.users ?? []);
    setReason(response.reason);
  }, [getToken]);

  /**
   * Sends a fix only when the stored one is missing or old. Opening the page
   * repeatedly must not turn into a stream of position updates.
   */
  const refreshPosition = useCallback(async (current: NearbySettings | null, { force = false } = {}): Promise<boolean> => {
    const age = current?.locationUpdatedAt
      ? Date.now() - new Date(current.locationUpdatedAt).getTime()
      : Number.POSITIVE_INFINITY;
    if (!force && age < FIX_REUSE_MS) return true;

    const result = await requestFix();
    setPermission(result.outcome);
    if (result.outcome !== "granted" || !result.fix) return false;

    const token = await getToken();
    if (!token) return false;
    const response = await updateNearbyPosition({
      latitude: result.fix.latitude,
      longitude: result.fix.longitude,
      accuracy: result.fix.accuracy,
      source: result.fix.source,
      permissionStatus: "granted",
    }, token);
    if (response.success) setSettings(response.settings);
    return response.success;
  }, [getToken, requestFix]);

  const load = useCallback(async ({ force = false } = {}) => {
    // A refresh that arrives while one is already running is dropped, so the
    // spinner is only owned by the call that actually does the work.
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const current = await getNearbySettings(token);
      if (current.success) setSettings(current.settings);
      setPermission(await checkPermission());

      if (current.settings?.enabled) {
        await refreshPosition(current.settings, { force });
        await loadList();
      } else {
        setUsers([]);
        setReason("disabled");
      }
    } catch (error) {
      toast.error(errorMessage(error, t("nearby.load_failed", "Nearby athletes could not be loaded.")));
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [checkPermission, getToken, loadList, refreshPosition, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const outcomeCopy = useMemo((): Partial<Record<LocationOutcome, { title: string; body: string; action: string }>> => ({
    denied: {
      title: t("nearby.denied_title", "Location permission is off"),
      body: t("nearby.denied_body", "Nearby needs your location while the page is open. You can allow it any time."),
      action: t("nearby.allow", "Allow"),
    },
    blocked: {
      title: t("nearby.blocked_title", "Allow location for this site"),
      body: t("nearby.blocked_web_body", "Your browser is blocking location for MotionMeet. Allow it from the padlock icon in the address bar, then try again."),
      action: t("nearby.retry", "Try again"),
    },
    insecure_context: {
      title: t("nearby.insecure_title", "Secure connection required"),
      body: t("nearby.insecure_body", "Browsers only share your position over https. Open MotionMeet on its secure address to use Nearby."),
      action: t("nearby.retry", "Try again"),
    },
    unavailable: {
      title: t("nearby.unavailable_title", "No position yet"),
      body: t("nearby.unavailable_body", "Your position could not be read. Please try again in a moment."),
      action: t("nearby.retry", "Try again"),
    },
    timeout: {
      title: t("nearby.timeout_title", "Taking too long"),
      body: t("nearby.timeout_body", "Reading your position took too long. Please try again."),
      action: t("nearby.retry", "Try again"),
    },
  }), [t]);

  /**
   * Turning the feature on is the moment the browser prompt is justified, so
   * the permission request and the first fix happen here. If the member
   * declines, the switch goes straight back off rather than leaving the account
   * marked as opted in with nothing behind it.
   */
  const toggleFeature = useCallback(async (next: boolean) => {
    if (toggling) return;
    setToggling(true);
    try {
      const token = await getToken();
      if (!token) return;

      if (!next) {
        const response = await updateNearbySettings({ enabled: false }, token);
        if (response.success) setSettings(response.settings);
        setUsers([]);
        setReason("disabled");
        return;
      }

      const result = await requestFix();
      setPermission(result.outcome);
      if (result.outcome !== "granted" || !result.fix) {
        toast.error(outcomeCopy[result.outcome]?.body ?? outcomeCopy.unavailable!.body);
        return;
      }

      const position = await updateNearbyPosition({
        latitude: result.fix.latitude,
        longitude: result.fix.longitude,
        accuracy: result.fix.accuracy,
        source: result.fix.source,
        permissionStatus: "granted",
      }, token);
      if (position.success) setSettings(position.settings);
      await loadList();
    } catch (error) {
      toast.error(errorMessage(error, t("nearby.load_failed", "Nearby athletes could not be loaded.")));
    } finally {
      setToggling(false);
    }
  }, [getToken, loadList, outcomeCopy, requestFix, t, toggling]);

  const changeScope = useCallback(async (scope: NearbyScope) => {
    try {
      const token = await getToken();
      if (!token) return;
      const response = await updateNearbySettings({ scope }, token);
      if (response.success) setSettings(response.settings);
      await loadList();
    } catch (error) {
      toast.error(errorMessage(error, t("nearby.load_failed", "Nearby athletes could not be loaded.")));
    }
  }, [getToken, loadList, t]);

  const lastUpdatedLabel = useMemo(() => {
    if (!settings?.locationUpdatedAt) return null;
    const minutes = Math.round((Date.now() - new Date(settings.locationUpdatedAt).getTime()) / 60_000);
    if (minutes < 1) return t("nearby.updated_now", "Updated just now");
    if (minutes < 60) return t("nearby.updated_minutes", "Updated {{count}} min ago", { count: minutes });
    return t("nearby.updated_hours", "Updated {{count}} h ago", { count: Math.round(minutes / 60) });
  }, [settings?.locationUpdatedAt, t]);

  const notice = enabled && permission && permission !== "granted" ? outcomeCopy[permission] : undefined;

  const emptyCopy = {
    disabled: {
      title: t("nearby.off_title", "Nearby is off"),
      body: t("nearby.off_body", "Turn it on to see athletes training close to you."),
    },
    no_fix: {
      title: t("nearby.no_fix_title", "No position yet"),
      body: t("nearby.no_fix_web_body", "Refresh to read your position and load the list."),
    },
    stale_fix: {
      title: t("nearby.stale_title", "Your position is out of date"),
      body: t("nearby.stale_web_body", "Refresh to update it."),
    },
    no_results: {
      title: t("nearby.empty_title", "Nobody here yet"),
      body: t("nearby.empty_body", "Try a wider radius — MotionMeet is still growing in your area."),
    },
  }[reason ?? "no_results"] ?? {
    title: t("nearby.empty_title", "Nobody here yet"),
    body: t("nearby.empty_body", "Try a wider radius — MotionMeet is still growing in your area."),
  };

  return (
    <PageShell maxWidth={820}>
      <PageHeader
        icon={Compass}
        eyebrow={t("nearby.eyebrow", "DISCOVER")}
        title={t("nearby.title", "Nearby")}
        description={t("nearby.description", "Athletes training close to you, shown as distance ranges only.")}
        action={(
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              disabled={loading || locating}
              startIcon={loading || locating ? <CircularProgress size={15} /> : <Navigation size={16} />}
              onClick={() => { void load({ force: true }); }}
            >
              {t("common.refresh", "Refresh")}
            </Button>
            <Button variant="outlined" startIcon={<SettingsOutlined fontSize="small" />} onClick={() => navigate("/settings/location")}>
              {t("location.settings_title", "Location")}
            </Button>
          </Stack>
        )}
      />

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {t("nearby.feature_title", "Show athletes near me")}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("nearby.feature_body", "Your exact position is never shown to anyone and is only read while this page is open.")}
            </Typography>
          </Box>
          <Switch
            checked={enabled}
            disabled={toggling || locating}
            onChange={(event) => { void toggleFeature(event.target.checked); }}
            slotProps={{ input: { "aria-label": t("nearby.feature_title", "Show athletes near me") } }}
          />
        </Stack>
        {enabled && settings?.approximateArea && (
          <Stack direction="row" spacing={0.75} sx={{ mt: 1.25, alignItems: "center", color: "text.secondary" }}>
            <MapPin size={14} />
            <Typography variant="caption" noWrap>
              {settings.approximateArea}{lastUpdatedLabel ? ` · ${lastUpdatedLabel}` : ""}
            </Typography>
          </Stack>
        )}
      </Paper>

      {notice && (
        <Alert
          severity="warning"
          action={(
            <Button
              color="inherit"
              size="small"
              onClick={() => { void load({ force: true }); }}
            >
              {notice.action}
            </Button>
          )}
        >
          <AlertTitle sx={{ fontWeight: 700 }}>{notice.title}</AlertTitle>
          {notice.body}
        </Alert>
      )}

      {enabled && (
        <Stack spacing={1}>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
            {t("nearby.radius", "Radius")}
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            {NEARBY_SCOPES.map((scope) => (
              <Chip
                key={scope}
                label={t(SCOPE_LABELS[scope].key, SCOPE_LABELS[scope].fallback)}
                onClick={() => { void changeScope(scope); }}
                color={settings?.scope === scope ? "primary" : "default"}
                variant={settings?.scope === scope ? "filled" : "outlined"}
                sx={{ fontWeight: 700 }}
              />
            ))}
          </Stack>
        </Stack>
      )}

      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        {loading || locating ? (
          <Stack spacing={1.5} sx={{ minHeight: 220, alignItems: "center", justifyContent: "center" }}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">{t("nearby.loading", "Looking around you…")}</Typography>
          </Stack>
        ) : !enabled || users.length === 0 ? (
          <Stack spacing={1} sx={{ minHeight: 220, alignItems: "center", justifyContent: "center", textAlign: "center", p: 3 }}>
            <Compass size={28} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{emptyCopy.title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380 }}>{emptyCopy.body}</Typography>
          </Stack>
        ) : (
          users.map((user) => (
            <Stack
              key={user._id}
              direction="row"
              spacing={1.5}
              sx={{ px: 2, py: 1.5, alignItems: "center", borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 } }}
            >
              <ButtonBase
                onClick={() => navigate(`/profile/${user._id}`)}
                sx={{ flex: 1, minWidth: 0, borderRadius: 2, justifyContent: "flex-start", textAlign: "left" }}
              >
                <Stack direction="row" spacing={1.5} sx={{ minWidth: 0, alignItems: "center" }}>
                  <Avatar src={user.profile_picture || undefined} alt={user.full_name} sx={{ width: 46, height: 46 }}>
                    {(user.full_name || "U").charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>{user.full_name}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>@{user.username}</Typography>
                    {user.approximateArea && (
                      <Typography variant="caption" color="text.disabled" noWrap sx={{ display: "block" }}>
                        {user.approximateArea}
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </ButtonBase>
              <Chip
                size="small"
                label={t(BAND_LABELS[user.distanceBand].key, BAND_LABELS[user.distanceBand].fallback)}
                sx={{ fontWeight: 700 }}
              />
              <FollowButton
                userId={user._id}
                seed={{
                  isFollowing: Boolean(user.isFollowing),
                  isFollowedBy: Boolean(user.isFollowedBy),
                  requestSent: Boolean(user.requestSent),
                  requestReceived: Boolean(user.requestReceived),
                }}
              />
            </Stack>
          ))
        )}
      </Paper>

      <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
        {t("nearby.privacy_note", "Distances are shown as ranges, never as an exact figure. MotionMeet does not track you in the background and keeps no location history.")}
      </Typography>
    </PageShell>
  );
};

export default Nearby;
