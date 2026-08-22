import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "~/api/axios";
import { useAppSelector } from "~/app/hooks";
import { useAuthContext } from "~/context/AuthProvider";
import StoryComposer from "./StoryComposer";
import StoryViewer from "./StoryViewer";
import { API_ROUTES, type ApiFailure, type PublicUser, type Story } from "@motionmeet/shared";

interface StoriesResponse {
  success: boolean;
  stories: Story[];
}

interface StoryGroup {
  user: PublicUser;
  stories: Story[];
}

const RING_SIZE = 68;
const AVATAR_SIZE = RING_SIZE - 9;
/** The brand sweep, used for a story that has not been opened yet. */
const RING_GRADIENT = "linear-gradient(135deg, #F86FE8 0%, #9757FB 50%, #28E7F7 100%)";

const byOldestFirst = (left: Story, right: Story): number =>
  new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();

/**
 * The rail of story bubbles above the feed.
 *
 * The author's own bubble is the first one and it is the only one they get:
 * everything they posted in the last day lives inside it, and the plus badge
 * adds another. Their stories never appear again as a separate bubble.
 */
const StoriesBar = () => {
  const { t } = useTranslation();
  const { getToken } = useAuthContext();
  const currentUser = useAppSelector((state) => state.user.value);

  const [stories, setStories] = useState<Story[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewing, setViewing] = useState<Story[] | null>(null);

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
      console.error(
        failure?.message || (error instanceof Error ? error.message : "Stories could not be loaded"),
      );
    }
  }, [getToken]);

  useEffect(() => {
    void fetchStories();
  }, [fetchStories]);

  const { ownStories, otherGroups } = useMemo(() => {
    const valid = stories.filter(
      (story): story is Story & { user: PublicUser } =>
        Boolean(story?._id && story.user && typeof story.user === "object"),
    );

    const mine: Story[] = [];
    const byUser = new Map<string, Story[]>();
    for (const story of valid) {
      if (currentUser?._id && story.user._id === currentUser._id) {
        mine.push(story);
        continue;
      }
      const bucket = byUser.get(story.user._id);
      if (bucket) bucket.push(story);
      else byUser.set(story.user._id, [story]);
    }

    mine.sort(byOldestFirst);
    for (const bucket of byUser.values()) bucket.sort(byOldestFirst);

    // Rail order follows who posted most recently; each bubble plays that
    // person's stories oldest first.
    const groups: StoryGroup[] = [];
    const seen = new Set<string>();
    for (const story of [...valid].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )) {
      if (currentUser?._id && story.user._id === currentUser._id) continue;
      if (seen.has(story.user._id)) continue;
      seen.add(story.user._id);
      groups.push({ user: story.user, stories: byUser.get(story.user._id) ?? [] });
    }

    return { ownStories: mine, otherGroups: groups };
  }, [currentUser?._id, stories]);

  const bubble = (
    key: string,
    picture: string | null | undefined,
    fallback: string,
    label: string,
    ringed: boolean,
    onOpen: () => void,
    badge?: () => void,
  ) => (
    <Stack
      key={key}
      spacing={0.75}
      sx={{ width: RING_SIZE + 10, flexShrink: 0, alignItems: "center" }}
    >
      <Box
        onClick={onOpen}
        role="button"
        tabIndex={0}
        aria-label={label}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") onOpen();
        }}
        sx={{
          position: "relative",
          display: "grid",
          placeItems: "center",
          width: RING_SIZE,
          height: RING_SIZE,
          borderRadius: "50%",
          cursor: "pointer",
          background: ringed ? RING_GRADIENT : "transparent",
        }}
      >
        <Avatar
          src={picture || undefined}
          alt={label}
          sx={{
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            border: 2.5,
            borderColor: "background.paper",
            fontWeight: 800,
          }}
        >
          {fallback}
        </Avatar>

        {badge && (
          <Box
            component="button"
            type="button"
            aria-label={t("feed.create_story", "Create story")}
            onClick={(event) => {
              event.stopPropagation();
              badge();
            }}
            sx={{
              position: "absolute",
              right: 0,
              bottom: 0,
              display: "grid",
              placeItems: "center",
              width: 22,
              height: 22,
              p: 0,
              borderRadius: "50%",
              cursor: "pointer",
              color: "primary.contrastText",
              bgcolor: "primary.main",
              border: 2.5,
              borderColor: "background.paper",
            }}
          >
            <AddRounded sx={{ fontSize: 14 }} />
          </Box>
        )}
      </Box>
      <Typography variant="caption" noWrap sx={{ maxWidth: "100%", color: "text.secondary" }}>
        {label}
      </Typography>
    </Stack>
  );

  return (
    <>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Box className="no-scrollbar" sx={{ width: "100%", overflowX: "auto" }}>
          <Stack direction="row" spacing={1.5} sx={{ width: "max-content", pb: 0.5 }}>
            {bubble(
              "own",
              currentUser?.profile_picture,
              currentUser?.full_name?.charAt(0)?.toUpperCase() || "U",
              t("feed.your_story", "Your story"),
              ownStories.length > 0,
              () => (ownStories.length ? setViewing(ownStories) : setComposerOpen(true)),
              () => setComposerOpen(true),
            )}

            {otherGroups.map(({ user, stories: group }) =>
              bubble(
                user._id,
                user.profile_picture,
                (user.full_name || user.username || "?").charAt(0).toUpperCase(),
                user.full_name?.split(" ")[0] || user.username,
                true,
                () => setViewing(group),
              ),
            )}
          </Stack>
        </Box>
      </Paper>

      <StoryComposer open={composerOpen} onClose={() => setComposerOpen(false)} onCreated={fetchStories} />

      <StoryViewer
        stories={viewing ?? []}
        open={Boolean(viewing?.length)}
        onClose={() => setViewing(null)}
        onDeleted={() => {
          setViewing(null);
          void fetchStories();
        }}
      />
    </>
  );
};

export default StoriesBar;
