import { Box, Button, CircularProgress, Stack, Tab, Tabs } from "@mui/material";
import { Dumbbell, Newspaper } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import Loading from "~/components/Loading";
import NearbyAthletes from "~/components/NearbyAthletes";
import PostCard from "~/components/PostCard";
import QuickProfile from "~/components/QuickProfile";
import RecentMessages from "~/components/RecentMessages";
import StoriesBar from "~/components/StoriesBar";
import SuggestedAthletes from "~/components/SuggestedAthletes";
import CreatePost from "./CreatePost";
import { EmptyState, PageHeader, PageShell } from "~/components/AppPage";
import { useAppDispatch, useAppSelector } from "~/app/hooks";
import { fetchPosts } from "~/features/posts/postsSlice";
import { useAuthContext } from "../context/AuthProvider";

type FeedMode = "discover" | "following";

const Feed = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { getToken } = useAuthContext();
  const { posts, nextCursor, loading, loadingMore } = useAppSelector((state) => state.posts);
  const [mode, setMode] = useState<FeedMode>("discover");
  // Only the very first load blanks the page; a mode switch keeps the shell.
  const [ready, setReady] = useState(false);

  const load = useCallback(async (options: { cursor?: string | null; mode: FeedMode }) => {
    const token = await getToken();
    if (!token) return;
    try {
      await dispatch(fetchPosts({ token, cursor: options.cursor ?? null, mode: options.mode })).unwrap();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("feed.load_failed", "Feed could not be loaded"));
    }
  }, [dispatch, getToken, t]);

  useEffect(() => {
    let active = true;
    void (async () => {
      await load({ mode });
      if (active) setReady(true);
    })();
    return () => { active = false; };
  }, [load, mode]);

  if (!ready && loading) return <Loading />;

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
            description={t("feed.description", "Recent training updates from your community.")}
            action={(
              <Button
                variant="contained"
                onClick={() => navigate("/routines")}
                startIcon={<Dumbbell size={17} />}
                sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
              >
                {t("feed.start_workout", "Start workout")}
              </Button>
            )}
          />

          {/* Discover is everyone; Following is only the accounts the member
              chose, which is what makes a private account worth following. */}
          <Tabs
            value={mode}
            onChange={(_, value: FeedMode) => setMode(value)}
            sx={{ minHeight: 40, borderBottom: 1, borderColor: "divider" }}
          >
            <Tab value="discover" label={t("feed.home_discover", "Discover")} sx={{ fontWeight: 700, minHeight: 40 }} />
            <Tab value="following" label={t("feed.home_following", "Following")} sx={{ fontWeight: 700, minHeight: 40 }} />
          </Tabs>

          <StoriesBar />
          <NearbyAthletes />
          <CreatePost onSuccess={() => load({ mode })} />

          {loading && posts.length === 0 ? (
            <Stack sx={{ minHeight: 200, alignItems: "center", justifyContent: "center" }}>
              <CircularProgress size={28} />
            </Stack>
          ) : posts.length > 0 ? (
            posts.map((post) => <PostCard key={post._id} post={post} />)
          ) : (
            <EmptyState
              icon={Newspaper}
              title={t("feed.no_posts", "No posts yet")}
              description={
                mode === "following"
                  ? t("feed.no_following_posts", "Follow athletes to see their training here.")
                  : t("feed.no_posts_description", "Follow athletes or publish the first update in your community.")
              }
              minHeight={220}
            />
          )}

          {nextCursor && (
            <Button
              variant="outlined"
              onClick={() => load({ cursor: nextCursor, mode })}
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
