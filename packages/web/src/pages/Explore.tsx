import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import CollectionsRounded from "@mui/icons-material/CollectionsRounded";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { PageHeader, PageShell } from "~/components/AppPage";
import PostCard from "~/components/PostCard";
import { discoverUsers, getFeed } from "~/api/endpoints";
import { useAuthContext } from "~/context/AuthProvider";
import type { Post, PublicUser } from "@motionmeet/shared";

/** Instagram's grid, and the one people already know how to read. */
const COLUMNS = 3;
/** Long enough that a fast typist makes one request, short enough to feel live. */
const SEARCH_DEBOUNCE_MS = 280;

const firstMedia = (post: Post): { url: string; isVideo: boolean; count: number } | null => {
  const entry = post.media?.find((item) => typeof item.url === "string" && item.url.trim());
  if (entry) {
    return { url: entry.url.trim(), isVideo: entry.mediaType === "video", count: post.media?.length ?? 1 };
  }
  const legacy = post.image_urls?.find((url) => typeof url === "string" && url.trim());
  return legacy ? { url: legacy.trim(), isVideo: false, count: post.image_urls?.length ?? 1 } : null;
};

/**
 * Keşfet: a grid of what the community is posting, and the way to find people.
 *
 * The grid only carries posts that have a picture — a wall of text tiles reads
 * as broken — while text-only posts stay discoverable in the feed itself.
 */
const Explore = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getToken } = useAuthContext();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [openPost, setOpenPost] = useState<Post | null>(null);

  // Only the newest search may write to the list: a slow request for "uh" must
  // not land on top of the results for "uhut".
  const searchSequence = useRef(0);

  const loadPosts = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await getFeed(token, undefined, "discover");
      if (data.success) setPosts((data.posts || []).filter((post) => Boolean(firstMedia(post))));
    } catch {
      // The empty state covers a failed load.
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      searchSequence.current += 1;
      setResults([]);
      setSearching(false);
      return undefined;
    }

    const sequence = (searchSequence.current += 1);
    setSearching(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const token = await getToken();
          if (!token) return;
          const data = await discoverUsers(term, token);
          if (sequence !== searchSequence.current) return;
          setResults(data.success ? data.users || [] : []);
        } catch {
          if (sequence === searchSequence.current) setResults([]);
        } finally {
          if (sequence === searchSequence.current) setSearching(false);
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [getToken, query]);

  const searchMode = query.trim().length > 0;

  return (
    <PageShell maxWidth={760}>
      <PageHeader title={t("menu.explore", "Keşfet")} />
      <Stack spacing={2}>
        <Paper
          variant="outlined"
          sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.75, height: 46, borderRadius: 23 }}
        >
          <SearchRounded fontSize="small" color="disabled" />
          <InputBase
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("explore.search_placeholder", "Search")}
            inputProps={{ maxLength: 60, "aria-label": t("explore.search_placeholder", "Search") }}
            sx={{ flex: 1, minWidth: 0 }}
          />
          {searchMode && (
            <IconButton size="small" onClick={() => setQuery("")} aria-label={t("common.clear", "Clear")}>
              <CloseRounded fontSize="small" />
            </IconButton>
          )}
        </Paper>

        {searchMode ? (
          searching ? (
            <Stack sx={{ alignItems: "center", py: 6 }}>
              <CircularProgress size={26} />
            </Stack>
          ) : query.trim().length < 2 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 5, textAlign: "center" }}>
              {t("explore.search_hint", "Type at least two letters to search.")}
            </Typography>
          ) : results.length === 0 ? (
            <Stack spacing={0.5} sx={{ alignItems: "center", py: 5 }}>
              <Typography sx={{ fontWeight: 700 }}>{t("explore.no_results", "No results")}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t("explore.no_results_hint", "Check the username or the name.")}
              </Typography>
            </Stack>
          ) : (
            <Paper variant="outlined">
              {results.map((user) => (
                <Stack
                  key={user._id}
                  direction="row"
                  spacing={1.5}
                  onClick={() => navigate(`/profile/${user._id}`)}
                  sx={{
                    px: 2,
                    py: 1.25,
                    alignItems: "center",
                    cursor: "pointer",
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <Avatar src={user.profile_picture || undefined} alt={user.full_name} sx={{ width: 46, height: 46 }}>
                    {(user.full_name || user.username || "?").charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 700, fontSize: 14.5 }}>
                      {user.full_name || user.username}
                    </Typography>
                    <Typography noWrap variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      @{user.username}
                    </Typography>
                  </Box>
                  <ChevronRightRounded fontSize="small" color="disabled" />
                </Stack>
              ))}
            </Paper>
          )
        ) : loading ? (
          <Stack sx={{ alignItems: "center", py: 6 }}>
            <CircularProgress size={26} />
          </Stack>
        ) : posts.length === 0 ? (
          <Stack spacing={0.5} sx={{ alignItems: "center", py: 6 }}>
            <Typography sx={{ fontWeight: 700 }}>
              {t("explore.empty", "Nothing to explore yet")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("explore.empty_hint", "Share the first photo, or follow a few people.")}
            </Typography>
          </Stack>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`, gap: "2px" }}>
            {posts.map((post) => {
              const media = firstMedia(post);
              if (!media) return null;
              return (
                <Box
                  key={post._id}
                  onClick={() => setOpenPost(post)}
                  role="button"
                  tabIndex={0}
                  aria-label={post.content || t("explore.open_post", "Open post")}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") setOpenPost(post);
                  }}
                  sx={{
                    position: "relative",
                    aspectRatio: "1 / 1",
                    overflow: "hidden",
                    cursor: "pointer",
                    bgcolor: "action.hover",
                    "&:hover img": { transform: "scale(1.04)" },
                  }}
                >
                  <Box
                    component="img"
                    src={media.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    sx={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transition: "transform .2s ease",
                    }}
                  />
                  {media.isVideo ? (
                    <PlayArrowRounded sx={{ position: "absolute", top: 6, right: 6, color: "common.white" }} />
                  ) : media.count > 1 ? (
                    <CollectionsRounded
                      sx={{ position: "absolute", top: 6, right: 6, fontSize: 18, color: "common.white" }}
                    />
                  ) : null}
                </Box>
              );
            })}
          </Box>
        )}
      </Stack>

      <Dialog open={Boolean(openPost)} onClose={() => setOpenPost(null)} fullWidth maxWidth="sm">
        <Stack direction="row" sx={{ p: 1, alignItems: "center", justifyContent: "space-between" }}>
          <Typography sx={{ pl: 1.5, fontWeight: 800 }}>{t("explore.post_title", "Post")}</Typography>
          <IconButton onClick={() => setOpenPost(null)} aria-label={t("common.close", "Close")}>
            <CloseRounded />
          </IconButton>
        </Stack>
        {openPost && <PostCard post={openPost} />}
      </Dialog>
    </PageShell>
  );
};

export default Explore;
