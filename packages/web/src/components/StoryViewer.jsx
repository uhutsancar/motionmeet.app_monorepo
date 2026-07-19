import { Avatar, Box, Dialog, IconButton, LinearProgress, Stack, Typography } from "@mui/material";
import { BadgeCheck, X } from "lucide-react";
import moment from "moment";
import { useEffect, useState } from "react";

const StoryViewer = ({ viewStory, setViewStory }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!viewStory || viewStory.media_type === "video") return undefined;

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
  }, [viewStory, setViewStory]);

  if (!viewStory) return null;

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
          <Avatar src={viewStory.user?.profile_picture || undefined} alt={viewStory.user?.full_name} sx={{ width: 40, height: 40, border: 2, borderColor: "rgba(255,255,255,.25)" }}>
            {viewStory.user?.full_name?.charAt(0)}
          </Avatar>
          <Stack>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                {viewStory.user?.full_name}
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
    </Dialog>
  );
};

export default StoryViewer;
