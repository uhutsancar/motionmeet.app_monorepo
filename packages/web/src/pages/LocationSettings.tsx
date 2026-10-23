import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import { MapPin } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import axios from "axios";
import type {
  ApiFailure,
  DistanceVisibility,
  NearbySettings,
  ProfileLocation,
  ProfileLocationVisibility,
} from "@motionmeet/shared";
import {
  clearProfileLocation,
  deleteNearbyPosition,
  getNearbySettings,
  getProfileLocation,
  setProfileLocationVisibility,
  updateNearbySettings,
} from "~/api/endpoints";
import { useAppDispatch } from "~/app/hooks";
import { PageHeader, PageShell } from "~/components/AppPage";
import LocationPickerDialog from "~/components/LocationPickerDialog";
import { useAuthContext } from "~/context/AuthProvider";
import { fetchUser } from "~/features/user/userSlice";

/**
 * One place to see and undo everything MotionMeet knows about where a member is.
 *
 * The two halves stay visually separate because they are separate: the profile
 * location is a public label the member chose, the nearby position is a private
 * fix that only ever leaves the server as a distance band. Each half has its own
 * visibility control and its own delete button, and neither affects the other.
 */

const errorMessage = (error: unknown, fallback: string): string => {
  const failure = axios.isAxiosError<ApiFailure>(error) ? error.response?.data : undefined;
  return failure?.message || (error instanceof Error ? error.message : fallback);
};

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <Stack spacing={1}>
    <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
      {title}
    </Typography>
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>{children}</Paper>
  </Stack>
);

interface ChoiceRowProps<T extends string> {
  disabled: boolean;
  label: string;
  description?: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T | undefined;
  onChange: (value: T) => void;
}

const ChoiceRow = <T extends string>({ disabled, label, description, options, value, onChange }: ChoiceRowProps<T>) => (
  <Box sx={{ px: 2, py: 1.75 }}>
    <Typography variant="body2" sx={{ fontWeight: 700 }}>{label}</Typography>
    {description && (
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
        {description}
      </Typography>
    )}
    <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1.25, flexWrap: "wrap" }}>
      {options.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          color={option.value === value ? "primary" : "default"}
          variant={option.value === value ? "filled" : "outlined"}
          sx={{ fontWeight: 700 }}
        />
      ))}
    </Stack>
  </Box>
);

const LocationSettings = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { getToken } = useAuthContext();

  const [profile, setProfile] = useState<ProfileLocation | null>(null);
  const [nearby, setNearby] = useState<NearbySettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirm, setConfirm] = useState<"profile" | "nearby" | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const [profileResponse, nearbyResponse] = await Promise.all([getProfileLocation(token), getNearbySettings(token)]);
      if (profileResponse.success) setProfile(profileResponse.location);
      if (nearbyResponse.success) setNearby(nearbyResponse.settings);
    } catch (error) {
      toast.error(errorMessage(error, t("location.load_failed", "Location settings could not be loaded.")));
    }
  }, [getToken, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const guarded = useCallback(async (work: (token: string) => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) return;
      await work(token);
    } catch (error) {
      toast.error(errorMessage(error, t("common.error", "Something went wrong")));
    } finally {
      setBusy(false);
    }
  }, [busy, getToken, t]);

  const changeProfileVisibility = (visibility: ProfileLocationVisibility) => void guarded(async (token) => {
    const response = await setProfileLocationVisibility(visibility, token);
    if (response.success) setProfile(response.location);
  });

  const removeProfileLocation = () => void guarded(async (token) => {
    const response = await clearProfileLocation(token);
    if (response.success) setProfile(response.location);
    await dispatch(fetchUser(token));
    toast.success(t("location.removed_body", "Your profile no longer shows a place."));
  });

  const changeNearby = (patch: { visible?: boolean; distanceVisibility?: DistanceVisibility }) => void guarded(async (token) => {
    const response = await updateNearbySettings(patch, token);
    if (response.success) setNearby(response.settings);
  });

  const deleteStoredPosition = () => void guarded(async (token) => {
    const response = await deleteNearbyPosition(token);
    if (response.success) setNearby(response.settings);
    toast.success(t("nearby.deleted_body", "Nothing about your position is stored any more."));
  });

  return (
    <PageShell maxWidth={760}>
      <PageHeader
        icon={MapPin}
        eyebrow={t("location.eyebrow", "PRIVACY")}
        title={t("location.settings_title", "Location")}
        description={t(
          "location.settings_intro",
          "MotionMeet keeps two things apart: the place you chose to show on your profile, and the position used to find athletes near you. They are stored separately and you control each one on its own.",
        )}
        onBack={() => navigate("/settings")}
      />

      <Section title={t("location.profile_section", "Profile location")}>
        <Box sx={{ px: 2, py: 1.75 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
            {t("location.current_value", "Shown on your profile")}
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {profile?.displayName || t("location.not_set", "Not set")}
          </Typography>
        </Box>
        <Divider />
        <ListItemButton disabled={busy} onClick={() => setPickerOpen(true)} sx={{ px: 2, py: 1.5 }}>
          <ListItemText
            primary={profile?.displayName ? t("location.change", "Change location") : t("location.add", "Add location")}
            secondary={t("location.change_hint", "Pick from the world city list")}
            slotProps={{ primary: { variant: "body2", sx: { fontWeight: 700 } }, secondary: { variant: "caption" } }}
          />
          <ChevronRightRounded fontSize="small" />
        </ListItemButton>
        <Divider />
        <ChoiceRow<ProfileLocationVisibility>
          disabled={busy}
          label={t("location.visibility", "Who can see it")}
          description={t("location.visibility_hint", "Applies to your profile, search results and suggestions.")}
          value={profile?.visibility}
          onChange={changeProfileVisibility}
          options={[
            { value: "public", label: t("location.visibility_public", "Everyone") },
            { value: "followers", label: t("location.visibility_followers", "Followers") },
            { value: "connections", label: t("location.visibility_connections", "Connections") },
            { value: "private", label: t("location.visibility_private", "Only me") },
          ]}
        />
        {profile?.displayName && (
          <>
            <Divider />
            <ListItemButton disabled={busy} onClick={() => setConfirm("profile")} sx={{ px: 2, py: 1.5, color: "error.main" }}>
              <ListItemText
                primary={t("location.remove", "Remove profile location")}
                slotProps={{ primary: { variant: "body2", sx: { fontWeight: 700 } } }}
              />
              <ChevronRightRounded fontSize="small" />
            </ListItemButton>
          </>
        )}
      </Section>

      <Section title={t("nearby.section", "Nearby")}>
        <Stack direction="row" spacing={2} sx={{ px: 2, py: 1.75, alignItems: "center" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{t("nearby.visible", "Appear in nearby results")}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t("nearby.visible_hint", "Turn this off to keep browsing without being listed by others.")}
            </Typography>
          </Box>
          <Switch
            checked={nearby?.visible ?? true}
            disabled={busy || !nearby}
            onChange={(event) => changeNearby({ visible: event.target.checked })}
            slotProps={{ input: { "aria-label": t("nearby.visible", "Appear in nearby results") } }}
          />
        </Stack>
        <Divider />
        <ChoiceRow<DistanceVisibility>
          disabled={busy}
          label={t("nearby.distance_visibility", "How much distance to show")}
          description={t("nearby.distance_visibility_hint", "Distances are always ranges. An exact figure is never shown to anyone.")}
          value={nearby?.distanceVisibility}
          onChange={(distanceVisibility) => changeNearby({ distanceVisibility })}
          options={[
            { value: "approximate", label: t("nearby.distance_approximate", "Range") },
            { value: "nearby_only", label: t("nearby.distance_nearby_only", "Only \"nearby\"") },
            { value: "hidden", label: t("nearby.distance_hidden", "Nothing") },
          ]}
        />
        <Divider />
        <ListItemButton disabled={busy} onClick={() => setConfirm("nearby")} sx={{ px: 2, py: 1.5, color: "error.main" }}>
          <ListItemText
            primary={t("nearby.delete", "Delete my stored location")}
            secondary={nearby?.locationUpdatedAt
              ? t("nearby.delete_hint", "Erases the saved position and switches the feature off.")
              : t("nearby.delete_none", "Nothing is stored right now.")}
            slotProps={{ primary: { variant: "body2", sx: { fontWeight: 700 } }, secondary: { variant: "caption" } }}
          />
          <ChevronRightRounded fontSize="small" />
        </ListItemButton>
      </Section>

      <Stack direction="row" spacing={1} sx={{ justifyContent: "center" }}>
        <Button variant="outlined" onClick={() => navigate("/nearby")}>{t("nearby.title", "Nearby")}</Button>
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
        {t(
          "location.privacy_footer_web",
          "MotionMeet reads your position only while the Nearby page is open, never in the background, and keeps no history of where you have been. Place data by Countries States Cities Database · ODbL v1.0.",
        )}
      </Typography>

      <LocationPickerDialog
        open={pickerOpen}
        source="profile_update"
        onClose={() => setPickerOpen(false)}
        onSaved={(location) => {
          setProfile(location);
          setPickerOpen(false);
        }}
      />

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)}>
        <DialogTitle>
          {confirm === "nearby"
            ? t("nearby.delete_title", "Delete stored location?")
            : t("location.remove_title", "Remove profile location?")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirm === "nearby"
              ? t("nearby.delete_body", "Your saved position and nearby preferences are erased and the feature is switched off. Your profile location is not affected.")
              : t("location.remove_body", "Your profile will no longer show a place. Nearby is not affected.")}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>{t("common.cancel", "Cancel")}</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (confirm === "nearby") deleteStoredPosition();
              else removeProfileLocation();
              setConfirm(null);
            }}
          >
            {confirm === "nearby" ? t("common.delete", "Delete") : t("common.remove", "Remove")}
          </Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
};

export default LocationSettings;
