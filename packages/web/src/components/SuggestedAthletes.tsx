import { useAuthContext } from "../context/AuthProvider";
import { Avatar, Button, ButtonBase, Card, CardContent, Skeleton, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import api from "~/api/axios";
import { fetchUser } from "~/features/user/userSlice";
import { API_ROUTES, type PublicUser } from "@motionmeet/shared";
import { useAppDispatch } from "~/app/hooks";

const SuggestedAthletes = () => {
  const { t } = useTranslation();
  const { getToken } = useAuthContext();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSuggested = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const { data } = await api.get<{ success: boolean; users: PublicUser[] }>(API_ROUTES.user_extras.suggested, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setUsers(data.users);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const handleFollow = async (userId: string) => {
    try {
      const token = await getToken();
      if (!token) throw new Error("Your session has expired");
      const { data } = await api.post<{ success: boolean; message?: string }>(
        API_ROUTES.user_extras.follow,
        { id: userId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (data.success) {
        toast.success(data.message || "Athlete followed");
        dispatch(fetchUser(token));
        setUsers((currentUsers) => currentUsers.filter((user) => user._id !== userId));
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Athlete could not be followed");
    }
  };

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
        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 800 }}>
          {t("feed.suggested_athletes")}
        </Typography>
        <Stack spacing={2}>
          {users.map((user) => (
            <Stack key={user._id} direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
              <ButtonBase
                onClick={() => navigate(`/profile/${user._id}`)}
                sx={{ minWidth: 0, borderRadius: 2, justifyContent: "flex-start", textAlign: "left" }}
              >
                <Stack direction="row" spacing={1.5} sx={{ minWidth: 0, alignItems: "center" }}>
                  <Avatar src={user.profile_picture || undefined} alt={user.full_name} sx={{ width: 42, height: 42 }}>
                    {user.username?.charAt(0).toUpperCase()}
                  </Avatar>
                  <Stack sx={{ minWidth: 0 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 800 }}>
                      {user.username}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {user.full_name}
                    </Typography>
                  </Stack>
                </Stack>
              </ButtonBase>
              <Button size="small" onClick={() => handleFollow(user._id)}>
                {t("feed.follow")}
              </Button>
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default SuggestedAthletes;
