import { useAuthContext } from "../context/AuthProvider";
import { Box, Button, CircularProgress, Stack } from "@mui/material";
import { Dumbbell, Newspaper } from "lucide-react";
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
import { useNavigate } from "react-router";
import { EmptyState, PageHeader, PageShell } from "~/components/AppPage";

const Feed = () => {
  const { t } = useTranslation();
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const { getToken } = useAuthContext();
  const navigate = useNavigate();

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
    <PageShell maxWidth={1200} sx={{ gap: 2.5 }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 720px)", xl: "minmax(0, 2fr) minmax(292px, 1fr)" },
          justifyContent: "center",
          alignItems: "start",
          gap: 3,
        }}
      >
        <Stack spacing={2} sx={{ minWidth: 0 }}>
          <PageHeader
            title={t("menu.feed", "Feed")}
            description="Recent training updates from your community."
            action={(
              <Button
                variant="contained"
                onClick={() => navigate("/routines")}
                startIcon={<Dumbbell size={17} />}
                sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
              >
                Start workout
              </Button>
            )}
          />
          <StoriesBar />
          <CreatePost onSuccess={() => fetchFeeds()} />
          {feeds.length > 0 ? (
            feeds.map((post) => <PostCard key={post._id} post={post} />)
          ) : (
            <EmptyState
              icon={Newspaper}
              title={t("feed.no_posts")}
              description="Follow athletes or publish the first update in your community."
              minHeight={220}
            />
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
          spacing={2}
          sx={{ display: { xs: "none", xl: "flex" }, position: "sticky", top: 24, minWidth: 0 }}
        >
          <QuickProfile />
          <SuggestedAthletes />
          <RecentMessages />
        </Stack>
      </Box>
    </PageShell>
  );
};

export default Feed;
