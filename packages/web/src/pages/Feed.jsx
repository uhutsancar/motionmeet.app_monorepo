import { useAuthContext } from "../context/AuthProvider";
import { Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
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
import { API_ROUTES } from "@motionmeet/shared";

const Feed = () => {
  const { t } = useTranslation();
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const { getToken } = useAuthContext();

  const fetchFeeds = useCallback(async ({ cursor = null, append = false } = {}) => {
    try {
      if (append) setLoadingMore(true);
      const { data } = await api.get(API_ROUTES.post.feed, {
        params: cursor ? { cursor } : undefined,
        headers: {
          Authorization: `Bearer ${await getToken()}`,
        },
      });

      if (data.success) {
        setFeeds((currentFeeds) => {
          if (!append) return data.posts;
          const knownIds = new Set(currentFeeds.map((post) => post._id));
          return [
            ...currentFeeds,
            ...data.posts.filter((post) => !knownIds.has(post._id)),
          ];
        });
        setNextCursor(data.nextCursor);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      if (append) setLoadingMore(false);
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
    <Box sx={{ minHeight: "100%", py: { xs: 2, md: 4 }, px: { xs: 1.5, sm: 2.5, md: 3 } }}>
      <Box
        sx={{
          mx: "auto",
          maxWidth: 1120,
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 680px)", xl: "minmax(0, 680px) 328px" },
          justifyContent: "center",
          alignItems: "start",
          gap: { md: 3, xl: 4 },
        }}
      >
        <Stack spacing={{ xs: 1.5, sm: 2.25 }} sx={{ minWidth: 0 }}>
          <Box sx={{ display: { xs: "none", md: "block" }, mb: 0.5 }}>
            <Typography variant="overline" color="primary" sx={{ fontWeight: 800, letterSpacing: "0.12em" }}>
              YOUR COMMUNITY
            </Typography>
            <Typography variant="h4" sx={{ mt: 0.25 }}>
              Keep moving together.
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              Fresh sessions, progress and ideas from athletes you follow.
            </Typography>
          </Box>
          <StoriesBar />
          <CreatePost onSuccess={() => fetchFeeds()} />
          {feeds.length > 0 ? (
            feeds.map((post) => <PostCard key={post._id} post={post} />)
          ) : (
            <Paper variant="outlined" sx={{ py: 10, px: 3, borderRadius: 5, textAlign: "center" }}>
              <Typography variant="h6" sx={{ mb: 0.5 }}>
                {t("feed.no_posts")}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                Follow athletes or publish the first update in your community.
              </Typography>
            </Paper>
          )}
          {nextCursor && (
            <Button
              variant="outlined"
              onClick={() => fetchFeeds({ cursor: nextCursor, append: true })}
              disabled={loadingMore}
              startIcon={loadingMore ? <CircularProgress size={16} /> : null}
              sx={{ alignSelf: "center" }}
            >
              {t("common.load_more", "Load more")}
            </Button>
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
