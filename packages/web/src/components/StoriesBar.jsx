import { useAuthContext } from "../context/AuthProvider";
import { Avatar, Box, Card, CardActionArea, Stack, Typography } from "@mui/material";
import { Plus } from "lucide-react";
import moment from "moment";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "~/api/axios";
import StoryModal from "./StoryModal";
import StoryViewer from "./StoryViewer";

const StoriesBar = () => {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuthContext();
  const [stories, setStories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [viewStory, setViewStory] = useState(null);

  useEffect(() => {
    moment.locale(i18n.language.startsWith("tr") ? "tr" : "en");
  }, [i18n.language]);

  const fetchStories = useCallback(async () => {
    try {
      const token = await getToken();
      const { data } = await api.get("/api/story/get", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setStories(data.stories);
    } catch (error) {
      console.error(error.message);
    }
  }, [getToken]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  return (
    <>
      <Box className="no-scrollbar" sx={{ width: "100%", overflowX: "auto", pb: 0.25 }}>
        <Stack direction="row" spacing={1.25} sx={{ width: "max-content", pb: 1 }}>
          <Card
            variant="outlined"
            sx={{
              width: { xs: 94, sm: 104 },
              height: { xs: 144, sm: 156 },
              flexShrink: 0,
              borderRadius: 4,
              background: (theme) => `linear-gradient(155deg, ${theme.palette.background.paper}, ${theme.palette.action.hover})`,
            }}
          >
            <CardActionArea onClick={() => setShowModal(true)} sx={{ height: "100%", p: 1.5 }}>
              <Stack spacing={2} sx={{ height: "100%", textAlign: "center", alignItems: "center", justifyContent: "center" }}>
                <Box sx={{ width: 44, height: 44, borderRadius: 3, bgcolor: "primary.main", color: "primary.contrastText", display: "grid", placeItems: "center", boxShadow: "0 8px 20px rgba(101,88,245,.24)" }}>
                  <Plus size={22} />
                </Box>
                <Typography variant="caption" sx={{ fontWeight: 800, lineHeight: 1.25 }}>
                  {t("feed.create_story")}
                </Typography>
              </Stack>
            </CardActionArea>
          </Card>

          {stories.map((story, index) => (
            <Card
              key={story._id || `${story.user?._id}-${story.createdAt}-${index}`}
              variant="outlined"
              sx={{ width: { xs: 94, sm: 104 }, height: { xs: 144, sm: 156 }, flexShrink: 0, borderRadius: 4, bgcolor: "common.black" }}
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
                    muted={story.media_type === "video" ? true : undefined}
                    loop={story.media_type === "video" ? true : undefined}
                    autoPlay={story.media_type === "video" ? true : undefined}
                    sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  />
                )}
                <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.65), transparent 42%, rgba(0,0,0,.82))" }} />
                <Avatar src={story.user?.profile_picture || undefined} alt={story.user?.full_name} sx={{ position: "absolute", top: 9, left: 9, width: 34, height: 34, border: 2, borderColor: "primary.main" }}>
                  {story.user?.full_name?.charAt(0)}
                </Avatar>
                <Stack sx={{ position: "absolute", left: 11, right: 9, bottom: 10, color: "common.white" }}>
                  <Typography variant="caption" noWrap sx={{ fontWeight: 800 }}>
                    {story.user?.full_name?.split(" ")[0]}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: 9, opacity: 0.72 }}>
                    {moment(story.createdAt).fromNow()}
                  </Typography>
                </Stack>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      </Box>

      {showModal && <StoryModal setShowModal={setShowModal} fetchStories={fetchStories} />}
      {viewStory && <StoryViewer viewStory={viewStory} setViewStory={setViewStory} />}
    </>
  );
};

export default StoriesBar;
