import { Avatar, Box, Button, Dialog, Drawer, IconButton, LinearProgress, Stack, Typography } from "@mui/material";
import { BadgeCheck, Eye, X } from "lucide-react";
import moment from "moment";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Dispatch, SetStateAction } from "react";
import type { Story, StoryViewer as StoryViewerEntry } from "@motionmeet/shared";
import { getStoryViewers, markStoryViewed } from "~/api/endpoints";
import { useAppSelector } from "~/app/hooks";
import { useAuthContext } from "~/context/AuthProvider";

interface StoryViewerProps {
  viewStory: Story | null;
  setViewStory: Dispatch<SetStateAction<Story | null>>;
}

const StoryViewer = ({ viewStory, setViewStory }: StoryViewerProps) => {
  const { t } = useTranslation();
  const { getToken } = useAuthContext();
  const currentUserId = useAppSelector((state) => state.user.value?._id);
  const [progress, setProgress] = useState(0);
  const [viewers, setViewers] = useState<StoryViewerEntry[]>([]);
  const [viewersOpen, setViewersOpen] = useState(false);

  const storyId = viewStory?._id;
  const authorId = viewStory && typeof viewStory.user !== "string" ? viewStory.user._id : viewStory?.user;
  const isOwnStory = Boolean(authorId && authorId === currentUserId);

  // Opening the story is what counts as viewing it, so the receipt is sent
  // here rather than waiting for the progress bar to run out.
  useEffect(() => {
    if (!storyId || isOwnStory) return undefined;
    let active = true;
    void (async () => {
      const token = await getToken();
      if (!active || !token) return;
      try {
        await markStoryViewed(storyId, token);
      } catch {
        // A missed view receipt is not worth interrupting playback for.
      }
    })();
    return () => { active = false; };
  }, [getToken, isOwnStory, storyId]);

  const loadViewers = useCallback(async () => {
    if (!storyId) return;
    const token = await getToken();
    if (!token) return;
    try {
      const response = await getStoryViewers(storyId, token);
      if (response.success) setViewers(response.viewers ?? []);
    } catch {
      // The list simply stays empty when it cannot be loaded.
    }
  }, [getToken, storyId]);

  useEffect(() => {
    if (!viewersOpen) return;
    void loadViewers();
  }, [loadViewers, viewersOpen]);

  useEffect(() => {
    // A story that just closed must not leave the previous one's viewers behind.
    setViewers([]);
    setViewersOpen(false);
  }, [storyId]);

  useEffect(() => {
    // The auto-advance timer would fight the viewers sheet for attention.
    if (!viewStory || viewStory.media_type === "video" || viewersOpen) return undefined;

    setProgress(0);
    const duration = 10000;
    const intervalDuration = 50;
    let elapsed = 0;
    const progressInterval = setInterval(() => {
      elapsed += intervalDuration;
      setProgress((elapsed / duration) * 100);
    }, intervalDuration);
    const timer = setTimeout(() => setViewStory(null), duration);

    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, [viewStory, setViewStory, viewersOpen]);

  if (!viewStory) return null;
  const author = typeof viewStory.user === "string" ? null : viewStory.user;

  return (
    <Dialog
      open
      fullScreen
      onClose={() => setViewStory(null)}
      slotProps={{ paper: { sx: { bgcolor: "rgba(0,0,0,.96)", color: "common.white" } } }}
    >
      <LinearProgress
        variant="determinate"
        value={viewStory.media_type === "video" ? 0 : Math.min(progress, 100)}
        sx={{ position: "absolute", zIndex: 2, top: 18, left: 24, right: 24, width: "auto", height: 4, borderRadius: 2, bgcolor: "rgba(255,255,255,.2)", "& .MuiLinearProgress-bar": { bgcolor: "common.white" } }}
      />

      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", position: "absolute", zIndex: 2, top: 40, left: 24, right: 24 }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", py: 0.75, pl: 0.75, pr: 2, borderRadius: 99, bgcolor: "rgba(0,0,0,.35)" }}>
          <Avatar src={author?.profile_picture || undefined} alt={author?.full_name} sx={{ width: 40, height: 40, border: 2, borderColor: "rgba(255,255,255,.25)" }}>
            {author?.full_name?.charAt(0)}
          </Avatar>
          <Stack>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                {author?.full_name}
              </Typography>
              <BadgeCheck size={16} />
            </Stack>
            <Typography variant="caption" sx={{ opacity: 0.65 }}>
              {viewStory.createdAt ? moment(viewStory.createdAt).fromNow() : moment().fromNow()}
            </Typography>
          </Stack>
        </Stack>
        <IconButton onClick={() => setViewStory(null)} aria-label="Close story" sx={{ color: "common.white", bgcolor: "rgba(255,255,255,.12)", "&:hover": { bgcolor: "rgba(255,255,255,.2)" } }}>
          <X size={24} />
        </IconButton>
      </Stack>

      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", px: 2, py: 8 }}>
        <Box
          sx={{
            height: { xs: "min(76vh, 720px)", sm: "min(84vh, 800px)" },
            maxWidth: "100%",
            aspectRatio: "9 / 16",
            overflow: "hidden",
            borderRadius: { xs: 2, sm: 4 },
            bgcolor: viewStory.media_type === "text" ? viewStory.background_color : "common.black",
            border: "1px solid rgba(255,255,255,.08)",
            display: "grid",
            placeItems: "center",
          }}
        >
          {viewStory.media_type === "text" ? (
            <Typography variant="h4" sx={{ p: 4, color: "common.white", fontWeight: 800, textAlign: "center" }}>
              {viewStory.content}
            </Typography>
          ) : (
            <Box
              component={viewStory.media_type === "image" ? "img" : "video"}
              src={viewStory.media_url}
              alt={viewStory.media_type === "image" ? "Story" : undefined}
              autoPlay={viewStory.media_type === "video" ? true : undefined}
              playsInline={viewStory.media_type === "video" ? true : undefined}
              controls={viewStory.media_type === "video" ? true : undefined}
              onEnded={viewStory.media_type === "video" ? () => setViewStory(null) : undefined}
              sx={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          )}
        </Box>
      </Box>

      {/* View receipts are the author's data only, so the control is theirs. */}
      {isOwnStory && (
        <Stack sx={{ position: "absolute", bottom: 24, left: 0, right: 0, alignItems: "center" }}>
          <Button
            startIcon={<Eye size={17} />}
            onClick={() => setViewersOpen(true)}
            sx={{ color: "common.white", bgcolor: "rgba(255,255,255,.14)", "&:hover": { bgcolor: "rgba(255,255,255,.22)" } }}
          >
            {t("stories.viewers_count", "{{count}} views", { count: viewStory.view_count ?? 0 })}
          </Button>
        </Stack>
      )}

      <Drawer anchor="bottom" open={viewersOpen} onClose={() => setViewersOpen(false)}>
        <Box sx={{ p: 2, maxHeight: "60vh", overflowY: "auto" }}>
          <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 800 }}>
            {t("stories.viewers", "Viewers")}
          </Typography>
          {viewers.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t("stories.no_viewers", "Nobody has seen this story yet.")}
            </Typography>
          ) : (
            viewers.map((entry) => (
              <Stack key={entry.user._id} direction="row" spacing={1.5} sx={{ py: 1, alignItems: "center" }}>
                <Avatar src={entry.user.profile_picture || undefined} alt={entry.user.full_name} sx={{ width: 36, height: 36 }}>
                  {entry.user.full_name?.charAt(0)}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>{entry.user.full_name}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                    @{entry.user.username} · {moment(entry.viewedAt).fromNow()}
                  </Typography>
                </Box>
              </Stack>
            ))
          )}
        </Box>
      </Drawer>
    </Dialog>
  );
};

export default StoryViewer;
