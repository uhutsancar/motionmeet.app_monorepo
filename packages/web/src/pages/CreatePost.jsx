import { useAuthContext } from "../context/AuthProvider";
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Image, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import api from "~/api/axios";

const MediaPreview = ({ file, onRemove }) => {
  const [url, setUrl] = useState("");

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 2,
        border: 1,
        borderColor: "divider",
        bgcolor: "common.black",
      }}
    >
      <Box
        component={file.type.startsWith("video") ? "video" : "img"}
        src={url}
        alt={file.type.startsWith("video") ? undefined : "Preview"}
        sx={{ display: "block", width: file.type.startsWith("video") ? 160 : 112, height: 112, objectFit: "cover" }}
      />
      <IconButton
        size="small"
        onClick={onRemove}
        aria-label="Remove media"
        sx={{ position: "absolute", top: 6, right: 6, color: "common.white", bgcolor: "rgba(0,0,0,.65)", "&:hover": { bgcolor: "rgba(0,0,0,.85)" } }}
      >
        <X size={16} />
      </IconButton>
    </Box>
  );
};

const CreatePost = ({ onSuccess }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [content, setContent] = useState("");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const user = useSelector((state) => state.user.value);
  const { getToken } = useAuthContext();

  const handleSubmit = async () => {
    if (!images.length && !content.trim()) return toast.error(t("feed.whats_on_mind"));

    setLoading(true);
    const postType =
      images.length > 0 && images[0].type.startsWith("video")
        ? "video"
        : images.length && content
          ? "text_with_image"
          : images.length
            ? "image"
            : "text";

    try {
      const formData = new FormData();
      formData.append("content", content);
      formData.append("post_type", postType);
      images.forEach((image) => formData.append("images", image));

      const { data } = await api.post("/api/post/add", formData, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });

      if (!data.success) throw new Error(data.message);

      setContent("");
      setImages([]);
      toast.success(t("feed.post_published"));
      if (onSuccess) onSuccess();
      else navigate("/");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Box sx={onSuccess ? undefined : { minHeight: "100vh", bgcolor: "background.default", pt: 10, px: 2 }}>
      <Paper
        variant="outlined"
        sx={{ width: "100%", maxWidth: onSuccess ? "none" : 576, mx: "auto", p: { xs: 2, sm: 2.5 }, borderRadius: 3 }}
      >
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Box sx={{ position: "relative" }}>
              <Avatar src={user.profile_picture || undefined} alt={user.full_name} sx={{ width: 44, height: 44 }}>
                {user.full_name?.charAt(0)}
              </Avatar>
              <Box
                sx={{ position: "absolute", right: 0, bottom: 0, width: 12, height: 12, borderRadius: "50%", bgcolor: "success.main", border: 2, borderColor: "background.paper" }}
              />
            </Box>
            <Stack>
              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                {user.full_name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                @{user.username}
              </Typography>
            </Stack>
          </Stack>

          <TextField
            multiline
            minRows={3}
            maxRows={8}
            fullWidth
            variant="standard"
            placeholder={t("feed.whats_on_mind")}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            slotProps={{ input: { disableUnderline: true } }}
          />

          {images.length > 0 && (
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1.5 }}>
              {images.map((image, index) => (
                <MediaPreview
                  key={`${image.name}-${image.lastModified}-${index}`}
                  file={image}
                  onRemove={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                />
              ))}
            </Stack>
          )}

          <Stack direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "space-between", pt: 2, borderTop: 1, borderColor: "divider" }}>
            <Button component="label" startIcon={<Image size={20} />}>
              {t("feed.photo_video")}
              <Box
                component="input"
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(event) => {
                  setImages((current) => [...current, ...Array.from(event.target.files || [])]);
                  event.target.value = "";
                }}
                sx={{ display: "none" }}
              />
            </Button>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Send size={17} />}
              onClick={handleSubmit}
              disabled={loading || (!content.trim() && !images.length)}
            >
              {t("feed.post")}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
};

export default CreatePost;
