import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import FormatAlignCenterRounded from "@mui/icons-material/FormatAlignCenterRounded";
import FormatAlignLeftRounded from "@mui/icons-material/FormatAlignLeftRounded";
import FormatAlignRightRounded from "@mui/icons-material/FormatAlignRightRounded";
import FormatColorFillRounded from "@mui/icons-material/FormatColorFillRounded";
import ImageOutlined from "@mui/icons-material/ImageOutlined";
import PlaceOutlined from "@mui/icons-material/PlaceOutlined";
import TextFieldsRounded from "@mui/icons-material/TextFieldsRounded";
import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, PointerEvent as ReactPointerEvent } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import api from "~/api/axios";
import { uploadMedia } from "~/api/mediaUpload";
import { useAuthContext } from "~/context/AuthProvider";
import {
  API_ROUTES,
  STORY_OVERLAY_LIMITS,
  createOperationId,
  type ApiFailure,
  type StoryOverlay,
  type StoryOverlayAlignment,
  type StoryOverlayBackdrop,
} from "@motionmeet/shared";
import StoryOverlayView from "./story/StoryOverlayView";
import { STORY_FONTS, STORY_TEXT_COLORS } from "./story/storyTypography";

interface StoryComposerProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
}

const MAX_VIDEO_DURATION = 60;
const MAX_MEDIA_SIZE_MB = 20;
/** Bottom band of the frame that deletes whatever is dropped into it. */
const TRASH_BAND = 0.86;

const NEXT_ALIGN: Record<StoryOverlayAlignment, StoryOverlayAlignment> = {
  center: "left",
  left: "right",
  right: "center",
};

const NEXT_BACKDROP: Record<StoryOverlayBackdrop, StoryOverlayBackdrop> = {
  none: "plate",
  plate: "translucent",
  translucent: "none",
};

const ALIGN_ICON = {
  left: FormatAlignLeftRounded,
  center: FormatAlignCenterRounded,
  right: FormatAlignRightRounded,
};

let overlaySequence = 0;

const newTextOverlay = (): StoryOverlay => ({
  id: `draft-${Date.now()}-${(overlaySequence += 1)}`,
  kind: "text",
  text: "",
  x: 0.5,
  y: 0.42,
  scale: 1,
  rotation: 0,
  font: "classic",
  color: "#FFFFFF",
  align: "center",
  backdrop: "none",
});

/**
 * The story composer.
 *
 * It opens straight into the file picker, because a story here always starts
 * from a picture rather than a blank coloured canvas. Captions are then dragged
 * onto the frame and stored as fractions of it, so what is composed in a browser
 * lands in the same place when the story is opened on a phone.
 */
const StoryComposer = ({ open, onClose, onCreated }: StoryComposerProps) => {
  const { t } = useTranslation();
  const { getToken } = useAuthContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const operationIdRef = useRef(createOperationId("story"));
  const uploadedRef = useRef<{ signature: string; key: string } | null>(null);
  const dragRef = useRef<{ id: string; pointerId: number } | null>(null);
  // True once the picker has been offered for the current opening.
  const launchedRef = useRef(false);

  const [media, setMedia] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [overlays, setOverlays] = useState<StoryOverlay[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationDraft, setLocationDraft] = useState("");
  const [dragging, setDragging] = useState(false);
  const [overTrash, setOverTrash] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [frameWidth, setFrameWidth] = useState(360);

  const editing = useMemo(
    () => overlays.find((overlay) => overlay.id === editingId) ?? null,
    [editingId, overlays],
  );

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  // The frame is the unit every caption size is measured against, so it is
  // tracked rather than assumed.
  useEffect(() => {
    const element = frameRef.current;
    if (!element || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setFrameWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [previewUrl]);

  const reset = useCallback(() => {
    setMedia(null);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setOverlays([]);
    setEditingId(null);
    setLocationOpen(false);
    setLocationDraft("");
    setDragging(false);
    setOverTrash(false);
    operationIdRef.current = createOperationId("story");
    uploadedRef.current = null;
  }, []);

  const close = useCallback(() => {
    if (publishing) return;
    reset();
    onClose();
  }, [onClose, publishing, reset]);

  // Opening the composer is the same gesture as opening the picker.
  //
  // The ref makes it exactly once per opening. Watching the draft instead would
  // reopen the picker on the way out, because publishing clears the draft while
  // the dialog is still mounted.
  useEffect(() => {
    if (!open) {
      launchedRef.current = false;
      reset();
      return;
    }
    if (launchedRef.current) return;
    launchedRef.current = true;
    fileInputRef.current?.click();
  }, [open, reset]);

  const selectFile = (file: File) => {
    setMedia(file);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    uploadedRef.current = null;
    operationIdRef.current = createOperationId("story");
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      // Cancelling the very first pick means there is no story to compose.
      if (!media) close();
      return;
    }

    if (file.size > MAX_MEDIA_SIZE_MB * 1024 * 1024) {
      toast.error(`${t("common.error")}: Max ${MAX_MEDIA_SIZE_MB}MB`);
      if (!media) close();
      return;
    }

    if (file.type.startsWith("video")) {
      const video = document.createElement("video");
      const metadataUrl = URL.createObjectURL(file);
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(metadataUrl);
        if (video.duration > MAX_VIDEO_DURATION) toast.error(t("feed.video_too_long"));
        else selectFile(file);
      };
      video.onerror = () => URL.revokeObjectURL(metadataUrl);
      video.src = metadataUrl;
      return;
    }

    if (file.type.startsWith("image")) selectFile(file);
  };

  const updateOverlay = (id: string, patch: Partial<StoryOverlay>) => {
    setOverlays((current) =>
      current.map((overlay) => (overlay.id === id ? { ...overlay, ...patch } : overlay)),
    );
  };

  const addText = () => {
    if (overlays.length >= STORY_OVERLAY_LIMITS.maxPerStory) return;
    const overlay = newTextOverlay();
    setOverlays((current) => [...current, overlay]);
    setEditingId(overlay.id);
  };

  const addLocation = () => {
    const place = locationDraft.trim().slice(0, 48);
    if (!place) return;
    setLocationOpen(false);
    setLocationDraft("");
    setOverlays((current) => [
      ...current,
      { ...newTextOverlay(), kind: "location", text: place, y: 0.72, scale: 0.6 },
    ]);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>, overlay: StoryOverlay) => {
    if (editing) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id: overlay.id, pointerId: event.pointerId };
    setDragging(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const frame = frameRef.current;
    if (!drag || !frame || drag.pointerId !== event.pointerId) return;

    const bounds = frame.getBoundingClientRect();
    const x = Math.min(0.96, Math.max(0.04, (event.clientX - bounds.left) / bounds.width));
    const y = Math.min(0.94, Math.max(0.06, (event.clientY - bounds.top) / bounds.height));
    updateOverlay(drag.id, { x, y });
    setOverTrash(y > TRASH_BAND && Math.abs(x - 0.5) < 0.22);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (overTrash) setOverlays((current) => current.filter((overlay) => overlay.id !== drag.id));
    setOverTrash(false);
  };

  const publish = async () => {
    if (!media || publishing) return;
    setPublishing(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Your session has expired");

      const signature = `${media.name}:${media.size}:${media.lastModified}`;
      let uploadedKey = uploadedRef.current?.signature === signature ? uploadedRef.current.key : undefined;
      if (!uploadedKey) {
        uploadedKey = await uploadMedia(media, "stories", token);
        uploadedRef.current = { signature, key: uploadedKey };
      }

      const operationId = operationIdRef.current;
      const { data } = await api.post<{ success: boolean; message?: string }>(
        API_ROUTES.story.create,
        {
          operationId,
          content: "",
          media_type: media.type.startsWith("image") ? "image" : "video",
          background_color: "",
          overlays: overlays.filter((overlay) => overlay.text.trim().length > 0),
          uploadedKey,
        },
        { headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": operationId } },
      );

      if (!data.success) {
        toast.error(data.message || t("feed.story_create_failed", "Story could not be created"));
        return;
      }

      toast.success(t("feed.story_created"));
      reset();
      await onCreated();
      onClose();
    } catch (error: unknown) {
      const failure = axios.isAxiosError<ApiFailure>(error) ? error.response?.data : undefined;
      toast.error(
        failure?.message ||
          (error instanceof Error ? error.message : t("feed.story_create_failed", "Story could not be created")),
      );
    } finally {
      setPublishing(false);
    }
  };

  const AlignIcon = ALIGN_ICON[editing?.align ?? "center"];

  return (
    <>
      <Box
        component="input"
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileChange}
        sx={{ display: "none" }}
      />

      <Dialog
        open={open && Boolean(previewUrl)}
        onClose={close}
        fullScreen
        slotProps={{ paper: { sx: { bgcolor: "#000000" } } }}
      >
        <Box sx={{ position: "relative", height: "100dvh", display: "grid", placeItems: "center", p: { xs: 0, sm: 2 } }}>
          <Box
            ref={frameRef}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            sx={{
              position: "relative",
              height: { xs: "100dvh", sm: "min(94dvh, 900px)" },
              width: { xs: "100%", sm: "auto" },
              aspectRatio: { sm: "9 / 16" },
              maxWidth: "100%",
              overflow: "hidden",
              borderRadius: { xs: 0, sm: 3 },
              bgcolor: "common.black",
              touchAction: "none",
            }}
          >
            {previewUrl && (
              <Box
                component={media?.type.startsWith("image") ? "img" : "video"}
                src={previewUrl}
                alt=""
                autoPlay={media?.type.startsWith("video") ? true : undefined}
                muted={media?.type.startsWith("video") ? true : undefined}
                loop={media?.type.startsWith("video") ? true : undefined}
                playsInline={media?.type.startsWith("video") ? true : undefined}
                sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
              />
            )}

            {overlays.map((overlay) => (
              <Box
                key={overlay.id}
                onPointerDown={(event) => onPointerDown(event, overlay)}
                onDoubleClick={() => setEditingId(overlay.id)}
                sx={{
                  position: "absolute",
                  left: `${overlay.x * 100}%`,
                  top: `${overlay.y * 100}%`,
                  maxWidth: "88%",
                  transform: `translate(-50%, -50%) rotate(${overlay.rotation}deg)`,
                  cursor: "grab",
                  touchAction: "none",
                  userSelect: "none",
                  opacity: dragging && dragRef.current?.id === overlay.id && overTrash ? 0.45 : 1,
                }}
              >
                <StoryOverlayView overlay={overlay} frameWidth={frameWidth} />
              </Box>
            ))}

            {/* Tools */}
            {!editing && (
              <>
                <IconButton
                  onClick={close}
                  aria-label={t("common.close", "Close")}
                  sx={{ position: "absolute", top: 14, left: 14, color: "common.white", bgcolor: "rgba(20,20,26,.55)" }}
                >
                  <CloseRounded />
                </IconButton>

                <Stack spacing={1.25} sx={{ position: "absolute", top: 14, right: 14 }}>
                  <IconButton
                    onClick={addText}
                    aria-label={t("story.add_text", "Add text")}
                    sx={{ color: "common.white", bgcolor: "rgba(20,20,26,.55)" }}
                  >
                    <TextFieldsRounded />
                  </IconButton>
                  <IconButton
                    onClick={() => setLocationOpen(true)}
                    aria-label={t("story.add_location", "Add location")}
                    sx={{ color: "common.white", bgcolor: "rgba(20,20,26,.55)" }}
                  >
                    <PlaceOutlined />
                  </IconButton>
                  <IconButton
                    onClick={() => fileInputRef.current?.click()}
                    aria-label={t("story.change_media", "Change photo")}
                    sx={{ color: "common.white", bgcolor: "rgba(20,20,26,.55)" }}
                  >
                    <ImageOutlined />
                  </IconButton>
                </Stack>
              </>
            )}

            {/* Drop target */}
            {dragging && (
              <Stack
                spacing={0.75}
                sx={{ position: "absolute", left: 0, right: 0, bottom: 34, alignItems: "center", pointerEvents: "none" }}
              >
                <Box
                  sx={{
                    display: "grid",
                    placeItems: "center",
                    width: overTrash ? 66 : 54,
                    height: overTrash ? 66 : 54,
                    borderRadius: "50%",
                    color: "common.white",
                    bgcolor: overTrash ? "rgba(217,66,73,.92)" : "rgba(20,20,26,.62)",
                    border: "1.5px solid rgba(255,255,255,.75)",
                    transition: "all .12s ease",
                  }}
                >
                  <DeleteOutlineRounded />
                </Box>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,.9)", fontWeight: 700 }}>
                  {t("story.drag_to_delete", "Drag here to delete")}
                </Typography>
              </Stack>
            )}

            {/* Share row */}
            {!editing && !dragging && (
              <Stack
                direction="row"
                spacing={1.25}
                sx={{ position: "absolute", left: 14, right: 14, bottom: 16, alignItems: "center" }}
              >
                <Box
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    height: 50,
                    px: 2,
                    display: "flex",
                    alignItems: "center",
                    borderRadius: 25,
                    color: "common.white",
                    bgcolor: "rgba(20,20,26,.62)",
                    border: "1px solid rgba(255,255,255,.14)",
                    fontWeight: 700,
                  }}
                >
                  {t("feed.your_story", "Your story")}
                </Box>
                <IconButton
                  onClick={publish}
                  disabled={publishing}
                  aria-label={t("feed.share_story", "Share story")}
                  sx={{ width: 50, height: 50, color: "common.white", bgcolor: "#7A4DF5", "&:hover": { bgcolor: "#6A3DE5" } }}
                >
                  {publishing ? <CircularProgress size={20} color="inherit" /> : <ArrowForwardRounded />}
                </IconButton>
              </Stack>
            )}

            {/* Caption editor */}
            {editing && (
              <Box sx={{ position: "absolute", inset: 0, bgcolor: "rgba(0,0,0,.62)", display: "flex", flexDirection: "column" }}>
                <Stack direction="row" spacing={1.25} sx={{ p: 1.75, alignItems: "center" }}>
                  <IconButton
                    onClick={() => updateOverlay(editing.id, { align: NEXT_ALIGN[editing.align] })}
                    aria-label={t("story.align", "Alignment")}
                    sx={{ color: "common.white", bgcolor: "rgba(255,255,255,.16)" }}
                  >
                    <AlignIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => updateOverlay(editing.id, { backdrop: NEXT_BACKDROP[editing.backdrop] })}
                    aria-label={t("story.text_background", "Text background")}
                    sx={{
                      color: editing.backdrop === "none" ? "common.white" : "#101014",
                      bgcolor: editing.backdrop === "none" ? "rgba(255,255,255,.16)" : "common.white",
                    }}
                  >
                    <FormatColorFillRounded />
                  </IconButton>
                  <Box sx={{ flex: 1 }} />
                  <Button
                    onClick={() => {
                      if (!editing.text.trim()) {
                        setOverlays((current) => current.filter((overlay) => overlay.id !== editing.id));
                      }
                      setEditingId(null);
                    }}
                    sx={{ color: "common.white", fontWeight: 800 }}
                  >
                    {t("story.done", "Done")}
                  </Button>
                </Stack>

                <Box sx={{ flex: 1, display: "grid", placeItems: "center", px: 3 }}>
                  <TextField
                    autoFocus
                    multiline
                    variant="standard"
                    value={editing.text}
                    onChange={(event) => updateOverlay(editing.id, { text: event.target.value })}
                    slotProps={{
                      htmlInput: { maxLength: STORY_OVERLAY_LIMITS.maxTextLength },
                      input: { disableUnderline: true },
                    }}
                    sx={{
                      width: "100%",
                      "& .MuiInputBase-input": {
                        color: editing.backdrop === "plate" ? "#101014" : editing.color,
                        textAlign: editing.align,
                        fontSize: 30,
                        fontWeight: 800,
                      },
                    }}
                  />
                </Box>

                <Stack spacing={1.25} sx={{ p: 1.75 }}>
                  <Stack direction="row" spacing={1} sx={{ overflowX: "auto" }} className="no-scrollbar">
                    {STORY_FONTS.map((font) => (
                      <Button
                        key={font.key}
                        size="small"
                        onClick={() => updateOverlay(editing.id, { font: font.key })}
                        sx={{
                          flexShrink: 0,
                          borderRadius: 16,
                          color: editing.font === font.key ? "#101014" : "common.white",
                          bgcolor: editing.font === font.key ? "common.white" : "rgba(255,255,255,.16)",
                          "&:hover": { bgcolor: editing.font === font.key ? "common.white" : "rgba(255,255,255,.26)" },
                          ...font.style,
                        }}
                      >
                        {font.sample}
                      </Button>
                    ))}
                  </Stack>
                  <Stack direction="row" spacing={1.25} sx={{ overflowX: "auto" }} className="no-scrollbar">
                    {STORY_TEXT_COLORS.map((color) => (
                      <Box
                        key={color}
                        component="button"
                        type="button"
                        aria-label={color}
                        onClick={() => updateOverlay(editing.id, { color })}
                        sx={{
                          flexShrink: 0,
                          width: 28,
                          height: 28,
                          p: 0,
                          borderRadius: "50%",
                          cursor: "pointer",
                          bgcolor: color,
                          border: editing.color === color ? "3px solid #FFFFFF" : "2px solid rgba(255,255,255,.55)",
                        }}
                      />
                    ))}
                  </Stack>
                </Stack>
              </Box>
            )}
          </Box>
        </Box>
      </Dialog>

      <Dialog open={locationOpen} onClose={() => setLocationOpen(false)} fullWidth maxWidth="xs">
        <Stack spacing={2} sx={{ p: 2.5 }}>
          <Typography sx={{ fontWeight: 800 }}>{t("story.add_location", "Add location")}</Typography>
          <TextField
            autoFocus
            fullWidth
            value={locationDraft}
            onChange={(event) => setLocationDraft(event.target.value)}
            placeholder={t("story.location_placeholder", "Type a place")}
            slotProps={{ htmlInput: { maxLength: 48 } }}
            onKeyDown={(event) => {
              if (event.key === "Enter") addLocation();
            }}
          />
          <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
            <Button onClick={() => setLocationOpen(false)}>{t("common.cancel", "Cancel")}</Button>
            <Button variant="contained" onClick={addLocation} disabled={!locationDraft.trim()}>
              {t("common.add", "Add")}
            </Button>
          </Stack>
        </Stack>
      </Dialog>
    </>
  );
};

export default StoryComposer;
