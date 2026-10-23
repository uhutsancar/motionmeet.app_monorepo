import { useAuthContext } from "../context/AuthProvider";
import { uploadMedia, validateProfileImage } from "../api/mediaUpload";
import {
  Autocomplete,
  Avatar,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Pencil } from "lucide-react";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { updateUser } from "~/features/user/userSlice";
import { useAppDispatch, useAppSelector } from "~/app/hooks";
import { clearProfileLocation, saveProfileLocation, searchLocations } from "~/api/endpoints";
import type { ApiFailure, LocationSuggestion } from "@motionmeet/shared";

interface ProfileModalProps { setShowEdit: (show: boolean) => void }
interface EditForm {
  username: string; bio: string; full_name: string;
  weight: number | string; height: number | string;
  profile_picture: File | null; cover_photo: File | null;
}

/** Long enough to swallow a burst of typing, short enough to feel immediate. */
const LOCATION_DEBOUNCE_MS = 280;
const MIN_LOCATION_QUERY = 2;
type ImageField = "profile_picture" | "cover_photo";
type TextFieldName = Exclude<keyof EditForm, ImageField>;

const useObjectUrl = (file: File | null, fallback?: string): string => {
  const [url, setUrl] = useState(fallback || "");

  useEffect(() => {
    if (!file) {
      setUrl(fallback || "");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [fallback, file]);

  return url;
};

const ProfileModal = ({ setShowEdit }: ProfileModalProps) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("tr") ? "tr" : "en";
  const dispatch = useAppDispatch();
  const { getToken } = useAuthContext();
  const user = useAppSelector((state) => state.user.value);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    username: user?.username || "",
    bio: user?.bio || "",
    profile_picture: null,
    cover_photo: null,
    full_name: user?.full_name || "",
    weight: user?.weight || 0,
    height: user?.height || 0,
  });
  const profilePreview = useObjectUrl(editForm.profile_picture, user?.profile_picture);
  const coverPreview = useObjectUrl(editForm.cover_photo, user?.cover_photo);

  // Location is not a form field: the member picks a record from the reference
  // dataset and the backend renders the label. `null` means "clear it".
  const [locationChoice, setLocationChoice] = useState<LocationSuggestion | null>(null);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationOptions, setLocationOptions] = useState<LocationSuggestion[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationTouched, setLocationTouched] = useState(false);
  const currentLocationLabel = user?.location || "";

  useEffect(() => {
    const query = locationQuery.trim();
    if (query.length < MIN_LOCATION_QUERY) {
      setLocationOptions([]);
      setLocationLoading(false);
      return undefined;
    }

    setLocationLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const token = await getToken();
          if (!token) return;
          const response = await searchLocations(query, token, { locale: locale, limit: 15, signal: controller.signal });
          if (!controller.signal.aborted) setLocationOptions(response.results ?? []);
        } catch {
          // An aborted request is a newer keystroke, not a failure.
          if (!controller.signal.aborted) setLocationOptions([]);
        } finally {
          if (!controller.signal.aborted) setLocationLoading(false);
        }
      })();
    }, LOCATION_DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [getToken, locale, locationQuery]);

  const updateField = (field: TextFieldName) => (event: ChangeEvent<HTMLInputElement>) => {
    setEditForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const selectImage = (field: ImageField) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      validateProfileImage(file);
      setEditForm((current) => ({ ...current, [field]: file }));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Invalid image");
    }
  };

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const userData = new FormData();
      const { full_name, username, bio, profile_picture, cover_photo, weight, height } = editForm;
      userData.append("username", username);
      userData.append("bio", bio);
      userData.append("full_name", full_name);
      userData.append("weight", String(weight));
      userData.append("height", String(height));
      const token = await getToken();
      if (!token) throw new Error("Your session has expired");
      if (profile_picture) validateProfileImage(profile_picture);
      if (cover_photo) validateProfileImage(cover_photo);
      if (profile_picture) {
        userData.append(
          "uploadedProfileKey",
          await uploadMedia(profile_picture, "profiles", token)
        );
      }
      if (cover_photo) {
        userData.append(
          "uploadedCoverKey",
          await uploadMedia(cover_photo, "covers", token)
        );
      }
      // Location travels on its own endpoint, which validates the id against
      // the dataset and writes the label itself.
      if (locationTouched) {
        if (locationChoice) {
          const payload = locationChoice.kind === "city"
            ? { cityId: locationChoice.id }
            : locationChoice.kind === "state"
              ? { stateId: locationChoice.id }
              : { countryId: locationChoice.id };
          await saveProfileLocation({ ...payload, source: "profile_update" }, token, locale);
        } else {
          await clearProfileLocation(token);
        }
      }
      await dispatch(updateUser({ userData, token })).unwrap();
      setShowEdit(false);
    } catch (error: unknown) {
      const failure = axios.isAxiosError<ApiFailure>(error) ? error.response?.data : undefined;
      toast.error(failure?.message || (error instanceof Error ? error.message : t("common.error", "Something went wrong")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={() => !saving && setShowEdit(false)} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={handleSaveProfile}>
        <DialogTitle sx={{ fontWeight: 700 }}>{t("profile.edit_profile")}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            <Stack spacing={1}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {t("profile.profile_picture", "Profile Picture")}
              </Typography>
              <ButtonBase component="label" sx={{ width: 96, height: 96, borderRadius: "50%", position: "relative", overflow: "hidden" }}>
                <Avatar src={profilePreview || undefined} alt={editForm.full_name} sx={{ width: 96, height: 96, border: 2, borderColor: "divider" }}>
                  {editForm.full_name?.charAt(0)}
                </Avatar>
                <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "common.white", bgcolor: "rgba(0,0,0,.38)", opacity: 0, transition: "opacity .2s", "&:hover": { opacity: 1 } }}>
                  <Pencil size={20} />
                </Box>
                <Box
                  component="input"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.gif,.heic,.heif,image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                  onChange={selectImage("profile_picture")}
                  sx={{ display: "none" }}
                />
              </ButtonBase>
            </Stack>

            <Stack spacing={1}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {t("profile.cover_photo", "Cover Photo")}
              </Typography>
              <ButtonBase component="label" sx={{ width: "100%", height: 160, borderRadius: 2, overflow: "hidden", position: "relative", bgcolor: "action.hover", background: coverPreview ? undefined : "linear-gradient(110deg, rgba(59,130,246,.24), rgba(168,85,247,.2), rgba(236,72,153,.2))" }}>
                {coverPreview && <Box component="img" src={coverPreview} alt="Cover" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "common.white", bgcolor: "rgba(0,0,0,.32)", opacity: 0, transition: "opacity .2s", "&:hover": { opacity: 1 } }}>
                  <Pencil size={22} />
                </Box>
                <Box
                  component="input"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.gif,.heic,.heif,image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                  onChange={selectImage("cover_photo")}
                  sx={{ display: "none" }}
                />
              </ButtonBase>
            </Stack>

            <TextField label={t("profile.full_name", "Full Name")} placeholder={t("profile.enter_full_name", "Please enter your full name")} value={editForm.full_name} onChange={updateField("full_name")} fullWidth />
            <TextField label={t("profile.username", "Username")} placeholder={t("profile.enter_username", "Please enter your username")} value={editForm.username} onChange={updateField("username")} fullWidth />
            <TextField label={t("profile.bio", "Bio")} placeholder={t("profile.enter_bio", "Please enter a short bio")} value={editForm.bio} onChange={updateField("bio")} multiline rows={3} fullWidth />
            {/* Free text is deliberately not accepted here: only a record from
                the world city dataset can become a profile location. */}
            <Autocomplete<LocationSuggestion>
              value={locationChoice}
              onChange={(_event, choice) => { setLocationChoice(choice); setLocationTouched(true); }}
              onInputChange={(_event, value, reason) => { if (reason === "input") setLocationQuery(value); }}
              options={locationOptions}
              filterOptions={(options) => options}
              getOptionLabel={(option) => option.displayName}
              isOptionEqualToValue={(option, selected) => option.kind === selected.kind && option.id === selected.id}
              loading={locationLoading}
              noOptionsText={locationQuery.trim().length < MIN_LOCATION_QUERY
                ? t("location.hint", "Type at least two letters to find your city, district or country.")
                : t("location.no_results_title", "No matches")}
              renderOption={(props, option) => (
                <Box component="li" {...props} key={`${option.kind}:${option.id}`} sx={{ display: "flex", gap: 1.25 }}>
                  <span>{option.countryEmoji || "📍"}</span>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{option.name}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>{option.displayName}</Typography>
                  </Box>
                </Box>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t("profile.location", "Location")}
                  placeholder={currentLocationLabel || t("location.search_placeholder", "City, district or country")}
                  helperText={locationTouched
                    ? undefined
                    : currentLocationLabel
                      ? t("location.current_value", "Shown on your profile") + `: ${currentLocationLabel}`
                      : t("location.not_set", "Not set")}
                  slotProps={{
                    input: {
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {locationLoading ? <CircularProgress size={16} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    },
                  }}
                />
              )}
              fullWidth
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: -1.5 }}>
              {t("location.attribution", "Place data by Countries States Cities Database · ODbL v1.0")}
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label={t("profile.weight", "Weight (kg)")} type="number" value={editForm.weight} onChange={updateField("weight")} fullWidth />
              <TextField label={t("profile.height", "Height (cm)")} type="number" value={editForm.height} onChange={updateField("height")} fullWidth />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setShowEdit(false)} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="contained" disabled={saving} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}>
            {saving ? t("common.saving", "Saving...") : t("profile.save_changes", "Save Changes")}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

export default ProfileModal;
