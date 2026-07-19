import { useAuthContext } from "../context/AuthProvider";
import { Box, Paper, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import api from "~/api/axios";
import Loading from "~/components/Loading";
import PostCard from "~/components/PostCard";
import QuickProfile from "~/components/QuickProfile";
import RecentMessages from "~/components/RecentMessages";
import StoriesBar from "~/components/StoriesBar";
import SuggestedAthletes from "~/components/SuggestedAthletes";
import CreatePost from "./CreatePost";

const Feed = () => {
  const { t } = useTranslation();
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const { getToken } = useAuthContext();

  const fetchFeeds = useCallback(async () => {
    try {
      const { data } = await api.get("/api/post/feed", {
        headers: {
          Authorization: `Bearer ${await getToken()}`,
        },
      });

      if (data.success) {
        setFeeds(data.posts);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  }, [getToken]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchFeeds();
      setLoading(false);
    };
    init();
  }, [fetchFeeds]);

  if (loading) return <Loading />;

  return (
    <Box sx={{ height: "100%", overflowY: "auto", py: { xs: 3, md: 5 }, px: { xs: 2, md: 3 } }}>
      <Box
        sx={{
          mx: "auto",
          maxWidth: 1040,
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 672px)", xl: "minmax(0, 672px) 320px" },
          justifyContent: "center",
          alignItems: "start",
          gap: 4,
        }}
      >
        <Stack spacing={3} sx={{ minWidth: 0 }}>
          <StoriesBar />
          <CreatePost onSuccess={fetchFeeds} />
          {feeds.length > 0 ? (
            feeds.map((post) => <PostCard key={post._id} post={post} />)
          ) : (
            <Paper variant="outlined" sx={{ py: 10, px: 3, borderRadius: 3, textAlign: "center" }}>
              <Typography color="text.secondary" sx={{ fontWeight: 600 }}>
                {t("feed.no_posts")}
              </Typography>
            </Paper>
          )}
        </Stack>

        <Stack
          spacing={3}
          sx={{ display: { xs: "none", xl: "flex" }, position: "sticky", top: 32, minWidth: 0 }}
        >
          <QuickProfile />
          <SuggestedAthletes />
          <RecentMessages />
        </Stack>
      </Box>
    </Box>
  );
};

export default Feed;
