import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import { memo, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { NearbyUser } from "@motionmeet/shared";
import { getNearbySettings, getNearbyUsers } from "~/api/endpoints";
import { useAuthContext } from "~/context/AuthProvider";
import { useAppSelector } from "~/app/hooks";
import { BAND_LABELS } from "~/config/nearbyLabels";
import UserCard from "./UserCard";

/**
 * Nearby athletes, as a rail on the feed.
 *
 * It only ever reads what the backend already stored. Asking the browser for a
 * position here would fire the permission prompt at someone who opened the app
 * to read their feed, so the section stays hidden until the member has turned
 * Nearby on from its own page, where the ask is explained.
 */
const NEARBY_FEED_LIMIT = 12;

/**
 * Mounting the feed twice in a session must not mean two requests — one of them
 * a proximity query — so the last answer is cached briefly.
 */
const CACHE_TTL_MS = 60_000;
/** Keyed by account so a sign-out never leaves one member's list on another's feed. */
let cache: { at: number; userId: string; users: NearbyUser[] } | null = null;

const cachedFor = (userId: string | undefined): NearbyUser[] | null =>
  userId && cache && cache.userId === userId && Date.now() - cache.at < CACHE_TTL_MS
    ? cache.users
    : null;

const NearbyAthletes = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getToken } = useAuthContext();
  const currentUserId = useAppSelector((state) => state.user.value?._id);
  const [users, setUsers] = useState<NearbyUser[]>(() => cachedFor(currentUserId) ?? []);

  const load = useCallback(async () => {
    if (!currentUserId) return;
    const cached = cachedFor(currentUserId);
    if (cached) {
      setUsers(cached);
      return;
    }
    try {
      const token = await getToken();
      if (!token) return;
      const settings = await getNearbySettings(token);
      // A stale fix would put people in front of a distance that is no longer
      // true, so the rail waits for the member to refresh it on Nearby.
      const found = !settings.success || !settings.settings?.enabled || settings.settings.stale
        ? []
        : (await getNearbyUsers(token, NEARBY_FEED_LIMIT)).users ?? [];
      cache = { at: Date.now(), userId: currentUserId, users: found };
      setUsers(found);
    } catch {
      // The feed stays usable when proximity data cannot be loaded.
    }
  }, [currentUserId, getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (users.length === 0) return null;

  return (
    <Stack spacing={1.25}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {t("nearby.section", "Nearby")}
        </Typography>
        <Button size="small" endIcon={<ChevronRightRounded />} onClick={() => navigate("/nearby")}>
          {t("nearby.see_all", "See all")}
        </Button>
      </Stack>
      <Box
        className="no-scrollbar"
        sx={{ display: "flex", gap: 1.5, overflowX: "auto", pb: 0.5, scrollSnapType: "x proximity" }}
      >
        {users.map((user) => (
          <UserCard
            key={user._id}
            user={user}
            badge={t(BAND_LABELS[user.distanceBand].key, BAND_LABELS[user.distanceBand].fallback)}
            caption={user.approximateArea || user.location || ""}
          />
        ))}
      </Box>
    </Stack>
  );
};

export default memo(NearbyAthletes);
