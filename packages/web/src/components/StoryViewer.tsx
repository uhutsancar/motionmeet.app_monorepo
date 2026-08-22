import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import FavoriteBorderRounded from "@mui/icons-material/FavoriteBorderRounded";
import KeyboardArrowUpRounded from "@mui/icons-material/KeyboardArrowUpRounded";
import SendRounded from "@mui/icons-material/SendRounded";
import moment from "moment";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
import { deleteStory, getStoryViewers, markStoryViewed, sendMessage } from "~/api/endpoints";
import { useAppSelector } from "~/app/hooks";
import { useAuthContext } from "~/context/AuthProvider";
import StoryOverlayLayer from "./story/StoryOverlayLayer";
import type { Story, StoryViewer as StoryViewerEntry } from "@motionmeet/shared";

interface StoryViewerProps {
  /** Every story by one author, oldest first. */
  stories: Story[];
  open: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}

/** How long a photo stays on screen before the viewer advances. */
const STORY_DURATION = 5000;
const PROGRESS_TICK = 50;

/**
 * The story viewer.
 *
 * Playback pauses whenever something is layered over the story — the audience
 * sheet, the reply box — so a frame never advances out from under whatever the
 * viewer is reading or typing.
 */
const StoryViewer = ({ stories, open, onClose, onDeleted }: StoryViewerProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getToken } = useAuthContext();
  const currentUserId = useAppSelector((state) => state.user.value?._id);

  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState<StoryViewerEntry[]>([]);
  const [viewersLoading, setViewersLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [replyFocused, setReplyFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const [frameWidth, setFrameWidth] = useState(360);

  const frameRef = useRef<HTMLDivElement>(null);
  const recordedViews = useRef<Set<string>>(new Set());

  const story = stories[index];
  const author = story && typeof story.user !== "string" ? story.user : null;
  const authorId = author?._id ?? (typeof story?.user === "string" ? story.user : undefined);
  const isOwnStory = Boolean(authorId && authorId === currentUserId);
  const paused = viewersOpen || replyFocused || sending;
  const overlays = useMemo(() => (Array.isArray(story?.overlays) ? story.overlays : []), [story]);

  useEffect(() => {
    if (open) {
      setIndex(0);
      setProgress(0);
      setViewersOpen(false);
      setReply("");
    }
  }, [open, stories]);

  useEffect(() => {
    const element = frameRef.current;
    if (!element || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setFrameWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [open]);

  const goNext = useCallback(() => {
    setIndex((current) => {
      if (current + 1 < stories.length) {
        setProgress(0);
        return current + 1;
      }
      onClose();
      return current;
    });
  }, [onClose, stories.length]);

  const goPrev = useCallback(() => {
    setProgress(0);
    setIndex((current) => Math.max(0, current - 1));
  }, []);

  // Opening someone else's story counts as a view exactly once per session.
  useEffect(() => {
    const storyId = story?._id;
    if (!open || !storyId || isOwnStory || recordedViews.current.has(storyId)) return;
    recordedViews.current.add(storyId);
    void (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        await markStoryViewed(storyId, token);
      } catch {
        // A missed view receipt is not worth interrupting playback for.
      }
    })();
  }, [getToken, isOwnStory, open, story?._id]);

  // Photo timer. Videos advance on their own `ended` event.
  useEffect(() => {
    if (!open || paused || !story || story.media_type === "video") return undefined;

    setProgress(0);
    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += PROGRESS_TICK;
      setProgress((elapsed / STORY_DURATION) * 100);
      if (elapsed >= STORY_DURATION) {
        clearInterval(interval);
        goNext();
      }
    }, PROGRESS_TICK);

    return () => clearInterval(interval);
  }, [goNext, index, open, paused, story]);

  const openViewers = async () => {
    const storyId = story?._id;
    if (!storyId || !isOwnStory) return;
    setViewersOpen(true);
    setViewers([]);
    setViewersLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const response = await getStoryViewers(storyId, token);
      if (response.success) setViewers(response.viewers ?? []);
    } catch {
      // The list simply stays empty when it cannot be loaded.
    } finally {
      setViewersLoading(false);
    }
  };

  const openProfile = (userId?: string) => {
    if (!userId) return;
    onClose();
    navigate(`/profile/${userId}`);
  };

  /**
   * Replies to the story as a direct message.
   *
   * The heart passes its emoji straight in rather than typing it into the box:
   * a reaction is one tap in every story app, and making it a two-step edit
   * would be the odd behaviour here.
   */
  const sendReply = async (override?: string) => {
    const text = (override ?? reply).trim();
    if (!text || !authorId || sending) return;
    setSending(true);
    try {
      const token = await getToken();
      if (!token) return;
      const result = await sendMessage({ to_user_id: authorId, text }, token);
      if (result.success) {
        if (!override) setReply("");
        toast.success(t("story.reply_sent", "Reply sent"));
      } else {
        toast.error(t("story.reply_failed", "The reply could not be sent"));
      }
    } catch {
      toast.error(t("story.reply_failed", "The reply could not be sent"));
    } finally {
      setSending(false);
    }
  };

  const removeStory = async () => {
    const storyId = story?._id;
    if (!storyId) return;
    try {
      const token = await getToken();
      if (!token) return;
      const data = await deleteStory(storyId, token);
      if (!data.success) {
        toast.error(data.message || t("story.delete_failed", "The story could not be deleted"));
        return;
      }
      onDeleted?.();
      onClose();
    } catch {
      toast.error(t("story.delete_failed", "The story could not be deleted"));
    }
  };

  if (!open || !story) return null;

  return (
    <Dialog open fullScreen onClose={onClose} slotProps={{ paper: { sx: { bgcolor: "#000000" } } }}>
      <Box sx={{ height: "100dvh", display: "grid", placeItems: "center", p: { xs: 0, sm: 2 } }}>
        <Box
          ref={frameRef}
          sx={{
            position: "relative",
            height: { xs: "100dvh", sm: "min(94dvh, 900px)" },
            width: { xs: "100%", sm: "auto" },
            aspectRatio: { sm: "9 / 16" },
            maxWidth: "100%",
            overflow: "hidden",
            borderRadius: { xs: 0, sm: 3 },
            bgcolor: story.background_color || "common.black",
          }}
        >
          {story.media_type !== "text" && story.media_url && (
            <Box
              component={story.media_type === "image" ? "img" : "video"}
              src={story.media_url}
              alt=""
              autoPlay={story.media_type === "video" ? true : undefined}
              playsInline={story.media_type === "video" ? true : undefined}
              onEnded={story.media_type === "video" ? goNext : undefined}
              // Cover, not contain: the story fills its frame edge to edge
              // instead of sitting inside letterbox bars.
              sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
          )}

          {/* Text-only stories predate the overlay composer and still render. */}
          {story.media_type === "text" && story.content && (
            <Typography
              sx={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                p: 4,
                color: "common.white",
                fontSize: 30,
                fontWeight: 800,
                textAlign: "center",
              }}
            >
              {story.content}
            </Typography>
          )}

          <StoryOverlayLayer overlays={overlays} frameWidth={frameWidth} />

          {/* Progress bars — one per story in the group */}
          <Stack direction="row" spacing={0.5} sx={{ position: "absolute", top: 12, left: 10, right: 10, zIndex: 3 }}>
            {stories.map((entry, position) => (
              <Box
                key={entry._id || position}
                sx={{ flex: 1, height: 2.5, borderRadius: 1, overflow: "hidden", bgcolor: "rgba(255,255,255,.35)" }}
              >
                <Box
                  sx={{
                    height: "100%",
                    bgcolor: "common.white",
                    width:
                      position < index ? "100%" : position === index ? `${Math.min(progress, 100)}%` : "0%",
                  }}
                />
              </Box>
            ))}
          </Stack>

          {/* Tap zones */}
          <Box
            onClick={goPrev}
            sx={{ position: "absolute", top: 0, bottom: 90, left: 0, width: "32%", zIndex: 2, cursor: "pointer" }}
          />
          <Box
            onClick={goNext}
            sx={{ position: "absolute", top: 0, bottom: 90, left: "32%", right: 0, zIndex: 2, cursor: "pointer" }}
          />

          {/* Header */}
          <Stack
            direction="row"
            spacing={1}
            sx={{ position: "absolute", top: 26, left: 12, right: 12, alignItems: "center", zIndex: 4 }}
          >
            <Stack
              direction="row"
              spacing={1.25}
              onClick={() => openProfile(authorId)}
              sx={{ flex: 1, minWidth: 0, alignItems: "center", cursor: "pointer" }}
            >
              <Avatar
                src={author?.profile_picture || undefined}
                alt={author?.full_name}
                sx={{ width: 38, height: 38, border: 2, borderColor: "common.white" }}
              >
                {author?.full_name?.charAt(0)}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ color: "common.white", fontSize: 14.5, fontWeight: 700 }}>
                  {author?.full_name || author?.username || "MotionMeet"}
                </Typography>
                <Typography sx={{ color: "rgba(255,255,255,.75)", fontSize: 12 }}>
                  {moment(story.createdAt).fromNow()}
                </Typography>
              </Box>
            </Stack>

            {isOwnStory && (
              <IconButton onClick={removeStory} aria-label={t("story.delete", "Delete story")} sx={{ color: "common.white" }}>
                <DeleteOutlineRounded />
              </IconButton>
            )}
            <IconButton onClick={onClose} aria-label={t("common.close", "Close")} sx={{ color: "common.white" }}>
              <CloseRounded />
            </IconButton>
          </Stack>

          {/* Author: how many people opened it. Everyone else: reply and react. */}
          {isOwnStory ? (
            <Stack
              onClick={openViewers}
              sx={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 14,
                alignItems: "center",
                zIndex: 4,
                cursor: "pointer",
                color: "common.white",
              }}
            >
              <KeyboardArrowUpRounded />
              <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>
                {typeof story.view_count === "number"
                  ? t("stories.viewers_count", "{{count}} views", { count: story.view_count })
                  : t("feed.swipe_up_viewers", "See who viewed this")}
              </Typography>
            </Stack>
          ) : (
            <Stack
              direction="row"
              spacing={0.75}
              sx={{ position: "absolute", left: 12, right: 12, bottom: 14, alignItems: "center", zIndex: 4 }}
            >
              <Box
                sx={{
                  flex: 1,
                  minWidth: 0,
                  height: 46,
                  px: 2.25,
                  display: "flex",
                  alignItems: "center",
                  borderRadius: 23,
                  border: "1.2px solid rgba(255,255,255,.6)",
                }}
              >
                <InputBase
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  onFocus={() => setReplyFocused(true)}
                  onBlur={() => setReplyFocused(false)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void sendReply();
                  }}
                  placeholder={t("story.reply_placeholder", "Send a message...")}
                  inputProps={{ maxLength: 500, "aria-label": t("story.reply_placeholder", "Send a message...") }}
                  sx={{ width: "100%", color: "common.white", fontSize: 14.5, "& input::placeholder": { color: "rgba(255,255,255,.65)", opacity: 1 } }}
                />
              </Box>

              {reply.trim() ? (
                <IconButton
                  onClick={() => void sendReply()}
                  disabled={sending}
                  aria-label={t("story.send_reply", "Send")}
                  sx={{ color: "common.white" }}
                >
                  {sending ? <CircularProgress size={20} color="inherit" /> : <SendRounded />}
                </IconButton>
              ) : (
                <>
                  <IconButton
                    onClick={() => setReply((current) => `${current}❤️`)}
                    aria-label={t("story.react", "Like")}
                    sx={{ color: "common.white" }}
                  >
                    <FavoriteBorderRounded />
                  </IconButton>
                  <IconButton
                    onClick={() => {
                      if (!authorId) return;
                      onClose();
                      navigate(`/messages/${authorId}`);
                    }}
                    aria-label={t("story.send_message", "Send message")}
                    sx={{ color: "common.white" }}
                  >
                    <SendRounded sx={{ transform: "rotate(-20deg)" }} />
                  </IconButton>
                </>
              )}
            </Stack>
          )}
        </Box>
      </Box>

      {/* Audience sheet — deliberately over two thirds of the screen so the list
          is readable instead of a strip at the bottom. */}
      <Drawer
        anchor="bottom"
        open={viewersOpen}
        onClose={() => setViewersOpen(false)}
        slotProps={{ paper: { sx: { height: "72dvh", borderTopLeftRadius: 20, borderTopRightRadius: 20 } } }}
      >
        <Box sx={{ p: 2, height: "100%", overflowY: "auto" }}>
          <Box sx={{ width: 40, height: 4, mx: "auto", mb: 1.5, borderRadius: 2, bgcolor: "divider" }} />
          <Typography sx={{ mb: 1.5, fontWeight: 800 }}>
            {t("feed.story_viewers", "Viewed by")}
            {viewers.length ? ` · ${viewers.length}` : ""}
          </Typography>

          {viewersLoading ? (
            <Stack sx={{ alignItems: "center", py: 5 }}>
              <CircularProgress size={24} />
            </Stack>
          ) : viewers.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
              {t("feed.story_no_viewers", "No one has viewed this yet")}
            </Typography>
          ) : (
            viewers.map((entry) => (
              <Stack
                key={`${entry.user._id}-${entry.viewedAt}`}
                direction="row"
                spacing={1.5}
                onClick={() => openProfile(entry.user._id)}
                sx={{ py: 1, alignItems: "center", cursor: "pointer", borderRadius: 2, "&:hover": { bgcolor: "action.hover" } }}
              >
                <Avatar src={entry.user.profile_picture || undefined} alt={entry.user.full_name} sx={{ width: 44, height: 44 }}>
                  {entry.user.full_name?.charAt(0)}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                    {entry.user.full_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                    @{entry.user.username} · {moment(entry.viewedAt).fromNow()}
                  </Typography>
                </Box>
                <ChevronRightRounded fontSize="small" color="disabled" />
              </Stack>
            ))
          )}
        </Box>
      </Drawer>
    </Dialog>
  );
};

export default StoryViewer;
