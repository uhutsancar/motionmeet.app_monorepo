import { useAuthContext } from "../context/AuthProvider";
import { Avatar, Box, Card, CardActionArea, Paper, Stack, Typography } from "@mui/material";
import { Plus } from "lucide-react";
import moment from "moment";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "~/api/axios";
import axios from "axios";
import StoryModal from "./StoryModal";
import StoryViewer from "./StoryViewer";
import { API_ROUTES, type ApiFailure, type Story } from "@motionmeet/shared";

interface StoriesResponse {
  success: boolean;
  stories: Story[];
}

const StoriesBar = () => {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuthContext();
  const [stories, setStories] = useState<Story[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [viewStory, setViewStory] = useState<Story | null>(null);

  useEffect(() => {
    moment.locale(i18n.language.startsWith("tr") ? "tr" : "en");
  }, [i18n.language]);

  const fetchStories = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const { data } = await api.get<StoriesResponse>(API_ROUTES.story.get, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setStories(data.stories);
    } catch (error: unknown) {
      const failure = axios.isAxiosError<ApiFailure>(error) ? error.response?.data : undefined;
      console.error(failure?.message || (error instanceof Error ? error.message : "Stories could not be loaded"));
    }
  }, [getToken]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  return (
    <>
      <Paper variant="outlined" sx={{ p: 1.25 }}>
        <Typography variant="subtitle2" sx={{ px: 0.25, mb: 1, fontWeight: 800 }}>
          {t("feed.stories", "Stories")}
        </Typography>
      <Box className="no-scrollbar" sx={{ width: "100%", overflowX: "auto" }}>
        <Stack direction="row" spacing={1} sx={{ width: "max-content", pb: 0.75 }}>
          <Card
            variant="outlined"
            sx={{
              width: 88,
              height: 96,
              flexShrink: 0,
              borderRadius: 3,
              bgcolor: "background.paper",
            }}
          >
            <CardActionArea onClick={() => setShowModal(true)} sx={{ height: "100%", p: 1 }}>
              <Stack spacing={1} sx={{ height: "100%", textAlign: "center", alignItems: "center", justifyContent: "center" }}>
                <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: "primary.main", color: "primary.contrastText", display: "grid", placeItems: "center" }}>
                  <Plus size={19} />
                </Box>
                <Typography variant="caption" sx={{ fontWeight: 800, lineHeight: 1.25 }}>
                  {t("feed.create_story")}
                </Typography>
              </Stack>
            </CardActionArea>
          </Card>

          {stories.map((story, index) => {
            const author = typeof story.user === "string" ? null : story.user;
            return (
            <Card
              key={story._id || `${author?._id}-${story.createdAt}-${index}`}
              variant="outlined"
              sx={{ width: 88, height: 96, flexShrink: 0, borderRadius: 3, bgcolor: "common.black" }}
            >
              <CardActionArea onClick={() => setViewStory(story)} sx={{ height: "100%", position: "relative" }}>
                {story.media_type === "text" ? (
                  <Box sx={{ position: "absolute", inset: 0, bgcolor: story.background_color, color: "common.white", display: "grid", placeItems: "center", p: 2 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, textAlign: "center" }}>
                      {story.content}
                    </Typography>
                  </Box>
                ) : (
                  <Box
                    component={story.media_type === "image" ? "img" : "video"}
                    src={story.media_url}
                    alt={story.media_type === "image" ? "Story" : undefined}
                    loading={story.media_type === "image" ? "lazy" : undefined}
                    decoding={story.media_type === "image" ? "async" : undefined}
                    muted={story.media_type === "video" ? true : undefined}
                    playsInline={story.media_type === "video" ? true : undefined}
                    preload={story.media_type === "video" ? "metadata" : undefined}
                    sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  />
                )}
                <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.65), transparent 42%, rgba(0,0,0,.82))" }} />
                <Avatar src={author?.profile_picture || undefined} alt={author?.full_name} sx={{ position: "absolute", top: 7, left: 7, width: 28, height: 28, border: 2, borderColor: "primary.main" }}>
                  {author?.full_name?.charAt(0)}
                </Avatar>
                <Stack sx={{ position: "absolute", left: 11, right: 9, bottom: 10, color: "common.white" }}>
                  <Typography variant="caption" noWrap sx={{ fontWeight: 800 }}>
                    {author?.full_name?.split(" ")[0]}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: 9, opacity: 0.72 }}>
                    {moment(story.createdAt).fromNow()}
                  </Typography>
                </Stack>
              </CardActionArea>
            </Card>
            );
          })}
        </Stack>
      </Box>
      </Paper>

      {showModal && <StoryModal setShowModal={setShowModal} fetchStories={fetchStories} />}
      {viewStory && <StoryViewer viewStory={viewStory} setViewStory={setViewStory} />}
    </>
  );
};

export default StoriesBar;
