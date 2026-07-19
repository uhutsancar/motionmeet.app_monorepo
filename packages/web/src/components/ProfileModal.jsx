import { useAuthContext } from "../context/AuthProvider";
import {
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
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { updateUser } from "~/features/user/userSlice";

const useObjectUrl = (file, fallback) => {
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

const ProfileModal = ({ setShowEdit }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { getToken } = useAuthContext();
  const user = useSelector((state) => state.user.value);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    username: user.username || "",
    bio: user.bio || "",
    location: user.location || "",
    profile_picture: null,
    cover_photo: null,
    full_name: user.full_name || "",
    weight: user.weight || 0,
    height: user.height || 0,
  });
  const profilePreview = useObjectUrl(editForm.profile_picture, user.profile_picture);
  const coverPreview = useObjectUrl(editForm.cover_photo, user.cover_photo);

  const updateField = (field) => (event) => {
    setEditForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const userData = new FormData();
      const { full_name, username, bio, location, profile_picture, cover_photo, weight, height } = editForm;
      userData.append("username", username);
      userData.append("bio", bio);
      userData.append("location", location);
      userData.append("full_name", full_name);
      userData.append("weight", weight);
      userData.append("height", height);
      if (profile_picture) userData.append("profile", profile_picture);
      if (cover_photo) userData.append("cover", cover_photo);

      const token = await getToken();
      await dispatch(updateUser({ userData, token })).unwrap();
      setShowEdit(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={() => !saving && setShowEdit(false)} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={handleSaveProfile}>
        <DialogTitle sx={{ fontWeight: 800 }}>{t("profile.edit_profile")}</DialogTitle>
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
                  accept="image/*"
                  onChange={(event) => setEditForm((current) => ({ ...current, profile_picture: event.target.files?.[0] || null }))}
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
                  accept="image/*"
                  onChange={(event) => setEditForm((current) => ({ ...current, cover_photo: event.target.files?.[0] || null }))}
                  sx={{ display: "none" }}
                />
              </ButtonBase>
            </Stack>

            <TextField label={t("profile.full_name", "Full Name")} placeholder={t("profile.enter_full_name", "Please enter your full name")} value={editForm.full_name} onChange={updateField("full_name")} fullWidth />
            <TextField label={t("profile.username", "Username")} placeholder={t("profile.enter_username", "Please enter your username")} value={editForm.username} onChange={updateField("username")} fullWidth />
            <TextField label={t("profile.bio", "Bio")} placeholder={t("profile.enter_bio", "Please enter a short bio")} value={editForm.bio} onChange={updateField("bio")} multiline rows={3} fullWidth />
            <TextField label={t("profile.location", "Location")} placeholder={t("profile.enter_location", "Please enter your location")} value={editForm.location} onChange={updateField("location")} fullWidth />
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
