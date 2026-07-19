import { useAuthContext } from "../context/AuthProvider";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
} from "@mui/material";
import { Sparkle, TextIcon, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import api from "~/api/axios";

const BACKGROUND_COLORS = ["#0f172a", "#1e1b4b", "#312e81", "#4c1d95", "#581c87", "#701a75", "#831843"];
const MAX_VIDEO_DURATION = 60;
const MAX_MEDIA_SIZE_MB = 50;

const StoryModal = ({ setShowModal, fetchStories }) => {
  const { t } = useTranslation();
  const { getToken } = useAuthContext();
  const [mode, setMode] = useState("text");
  const [background, setBackground] = useState(BACKGROUND_COLORS[0]);
  const [text, setText] = useState("");
  const [media, setMedia] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const selectMedia = (file) => {
    setMedia(file);
    setPreviewUrl(URL.createObjectURL(file));
    setText("");
    setMode("media");
  };

  const handleMediaUpload = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_MEDIA_SIZE_MB * 1024 * 1024) {
      toast.error(`${t("common.error")}: Max ${MAX_MEDIA_SIZE_MB}MB`);
      return;
    }

    if (file.type.startsWith("video")) {
      const video = document.createElement("video");
      const metadataUrl = URL.createObjectURL(file);
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(metadataUrl);
        if (video.duration > MAX_VIDEO_DURATION) toast.error(t("feed.video_too_long"));
        else selectMedia(file);
      };
      video.onerror = () => URL.revokeObjectURL(metadataUrl);
      video.src = metadataUrl;
    } else if (file.type.startsWith("image")) {
      selectMedia(file);
    }
  };

  const handleCreateStory = async () => {
    const mediaType = mode === "media" ? (media?.type.startsWith("image") ? "image" : "video") : "text";

    if (mediaType === "text" && !text.trim()) {
      toast.error(t("feed.add_text_error"));
      return;
    }
    if (mode === "media" && !media) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("content", text);
    formData.append("media_type", mediaType);
    if (media) formData.append("media", media);
    formData.append("background_color", background);

    try {
      const { data } = await api.post("/api/story/create", formData, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });

      if (data.success) {
        setShowModal(false);
        toast.success(t("feed.story_created"));
        fetchStories();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const switchToText = () => {
    setMode("text");
    setMedia(null);
    setPreviewUrl(null);
  };

  return (
    <Dialog open onClose={() => setShowModal(false)} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontWeight: 800 }}>
        {t("feed.create_story")}
        <IconButton onClick={() => setShowModal(false)} aria-label="Close">
          <X size={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          <Box
            sx={{
              width: "100%",
              maxHeight: 360,
              aspectRatio: "9 / 16",
              mx: "auto",
              overflow: "hidden",
              borderRadius: 2.5,
              bgcolor: mode === "text" ? background : "common.black",
              border: 1,
              borderColor: "divider",
            }}
          >
            {mode === "text" ? (
              <TextField
                multiline
                fullWidth
                placeholder={t("feed.whats_on_mind")}
                value={text}
                onChange={(event) => setText(event.target.value)}
                slotProps={{ input: { disableUnderline: true } }}
                variant="standard"
                sx={{ height: "100%", "& .MuiInputBase-root": { height: "100%", alignItems: "center", color: "common.white", px: 3, fontSize: 20, fontWeight: 800, textAlign: "center" }, "& textarea": { textAlign: "center" } }}
              />
            ) : previewUrl ? (
              <Box
                component={media?.type.startsWith("image") ? "img" : "video"}
                src={previewUrl}
                alt={media?.type.startsWith("image") ? "Preview" : undefined}
                autoPlay={media?.type.startsWith("video") ? true : undefined}
                muted={media?.type.startsWith("video") ? true : undefined}
                loop={media?.type.startsWith("video") ? true : undefined}
                sx={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : null}
          </Box>

          {mode === "text" && (
            <Stack direction="row" spacing={1} sx={{ justifyContent: "center" }}>
              {BACKGROUND_COLORS.map((color) => (
                <IconButton
                  key={color}
                  onClick={() => setBackground(color)}
                  aria-label={`Background ${color}`}
                  sx={{ width: 32, height: 32, borderRadius: 1.25, bgcolor: color, border: 2, borderColor: background === color ? "common.white" : "transparent", outline: background === color ? "2px solid rgba(255,255,255,.28)" : "none", "&:hover": { bgcolor: color, opacity: 0.85 } }}
                />
              ))}
            </Stack>
          )}

          <Stack direction="row" spacing={1.5}>
            <Button fullWidth variant={mode === "text" ? "contained" : "outlined"} startIcon={<TextIcon size={18} />} onClick={switchToText}>
              {t("feed.text")}
            </Button>
            <Button fullWidth component="label" variant={mode === "media" ? "contained" : "outlined"} startIcon={<Upload size={18} />}>
              {t("feed.photo_video")}
              <Box component="input" type="file" accept="image/*,video/*" onChange={handleMediaUpload} sx={{ display: "none" }} />
            </Button>
          </Stack>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2.5 }}>
        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handleCreateStory}
          disabled={loading || (mode === "media" && !media)}
          startIcon={loading ? <CircularProgress size={17} color="inherit" /> : <Sparkle size={18} />}
        >
          {t("feed.share_story")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StoryModal;
