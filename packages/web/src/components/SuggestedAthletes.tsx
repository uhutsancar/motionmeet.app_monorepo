import { Avatar, Box, Button, ButtonBase, Card, CardContent, Skeleton, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { PublicUser, RelationshipState } from "@motionmeet/shared";
import { getSuggestedUsers } from "~/api/endpoints";
import { useAuthContext } from "../context/AuthProvider";
import FollowButton from "./FollowButton";

type SuggestedUser = PublicUser & Partial<RelationshipState> & { followers_count?: number };

const SuggestedAthletes = () => {
  const { t } = useTranslation();
  const { getToken } = useAuthContext();
  const navigate = useNavigate();
  const [users, setUsers] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSuggested = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await getSuggestedUsers(token);
      if (data.success) setUsers(data.users as SuggestedUser[]);
    } catch {
      // The rail simply stays empty when suggestions cannot be loaded.
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchSuggested();
  }, [fetchSuggested]);

  if (loading) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Skeleton width="55%" height={30} />
          <Stack spacing={2} sx={{ mt: 2 }}>
            {[0, 1, 2].map((item) => (
              <Stack key={item} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                <Skeleton variant="circular" width={48} height={48} />
                <Skeleton sx={{ flex: 1 }} />
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (users.length === 0) return null;

  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Stack direction="row" sx={{ mb: 2, alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            {t("feed.suggested_athletes")}
          </Typography>
          <Button size="small" onClick={() => navigate("/connections")}>
            {t("connections.title", "Connections")}
          </Button>
        </Stack>
        <Stack spacing={1.75}>
          {users.map((user) => (
            <Stack key={user._id} direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
              <ButtonBase
                onClick={() => navigate(`/profile/${user._id}`)}
                sx={{ minWidth: 0, flex: 1, borderRadius: 2, justifyContent: "flex-start", textAlign: "left" }}
              >
                <Stack direction="row" spacing={1.5} sx={{ minWidth: 0, alignItems: "center" }}>
                  <Avatar src={user.profile_picture || undefined} alt={user.full_name} sx={{ width: 42, height: 42 }}>
                    {user.username?.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 800 }}>
                      {user.username}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                      {user.full_name}
                    </Typography>
                  </Box>
                </Stack>
              </ButtonBase>
              <FollowButton
                userId={user._id}
                seed={{
                  isFollowing: Boolean(user.isFollowing),
                  isFollowedBy: Boolean(user.isFollowedBy),
                  requestSent: Boolean(user.requestSent),
                  requestReceived: Boolean(user.requestReceived),
                }}
                sx={{ minWidth: 88 }}
              />
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default SuggestedAthletes;
