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
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router";
import { uploadMedia } from "~/api/mediaUpload";
import { createPost } from "~/api/endpoints";
import {
  CONTENT_LIMITS,
  createOperationId,
} from "@motionmeet/shared";


const MediaPreview = ({ file, onRemove, disabled = false }) => {
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
        disabled={disabled}
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
  const operationIdRef = useRef(null);
  const uploadCacheRef = useRef(null);

  const resetPendingSubmission = () => {
    operationIdRef.current = null;
    uploadCacheRef.current = null;
  };

  const replaceImages = (updater) => {
    setImages((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      resetPendingSubmission();
      return next;
    });
  };

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
      const token = await getToken();
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      const mediaSignature = images
        .map((image) => `${image.name}:${image.size}:${image.lastModified}`)
        .join("|");
      let uploadedKeys = uploadCacheRef.current?.signature === mediaSignature
        ? uploadCacheRef.current.keys
        : null;
      if (!uploadedKeys) {
        uploadedKeys = await Promise.all(
          images.map((image) => uploadMedia(image, "posts", token))
        );
        uploadCacheRef.current = { signature: mediaSignature, keys: uploadedKeys };
      }
      operationIdRef.current ||= createOperationId("post");
      const data = await createPost({
        operationId: operationIdRef.current,
        content,
        post_type: postType,
        uploadedKeys,
      }, token);

      if (!data.success) throw new Error(data.message);

      setContent("");
      setImages([]);
      resetPendingSubmission();
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
        sx={{
          width: "100%",
          maxWidth: onSuccess ? "none" : 576,
          mx: "auto",
          p: { xs: 1.5, sm: 2 },
          borderRadius: 3.5,
        }}
      >
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ position: "relative" }}>
              <Avatar src={user.profile_picture || undefined} alt={user.full_name} sx={{ width: 42, height: 42 }}>
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
            minRows={1}
            maxRows={8}
            fullWidth
            variant="standard"
            placeholder={t("feed.whats_on_mind")}
            value={content}
            disabled={loading}
            onChange={(event) => {
              setContent(event.target.value);
              operationIdRef.current = null;
            }}
            slotProps={{
              htmlInput: { maxLength: CONTENT_LIMITS.post },
              input: {
                disableUnderline: true,
                sx: { fontSize: 14, lineHeight: 1.55 },
              },
            }}
          />

          {images.length > 0 && (
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1.5 }}>
              {images.map((image, index) => (
                <MediaPreview
                  key={`${image.name}-${image.lastModified}-${index}`}
                  file={image}
                  disabled={loading}
                  onRemove={() => replaceImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                />
              ))}
            </Stack>
          )}

          <Stack direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "space-between", pt: 1.25, borderTop: 1, borderColor: "divider" }}>
            <Button component="label" color="inherit" startIcon={<Image size={19} />} disabled={loading}>
              {t("feed.photo_video")}
              <Box
                component="input"
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(event) => {
                  const selected = Array.from(event.target.files || []);
                  const oversized = selected.find((file) => file.size > 20 * 1024 * 1024);
                  if (oversized) {
                    toast.error("Each media file must be 20 MB or smaller.");
                    event.target.value = "";
                    return;
                  }
                  const videoCount = selected.filter((file) => file.type.startsWith("video/")).length;
                  replaceImages((current) => {
                    const hasExistingVideo = current.some((file) => file.type.startsWith("video/"));
                    if (
                      videoCount > 1 ||
                      (videoCount === 1 && (selected.length > 1 || current.length > 0)) ||
                      (hasExistingVideo && selected.length > 0)
                    ) {
                      toast.error("A video post can contain one video and no additional media.");
                      return current;
                    }
                    const next = [...current, ...selected].slice(0, CONTENT_LIMITS.postMediaItems);
                    if (current.length + selected.length > CONTENT_LIMITS.postMediaItems) {
                      toast.error(`A post can contain at most ${CONTENT_LIMITS.postMediaItems} media files.`);
                    }
                    return next;
                  });
                  event.target.value = "";
                }}
                sx={{ display: "none" }}
              />
            </Button>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Send size={16} />}
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
