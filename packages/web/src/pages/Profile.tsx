import { useAuthContext } from "../context/AuthProvider";
import {
  Alert,
  Avatar,
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { Calendar as CalendarIcon, Dumbbell, LineChart, Lock, MapPin, Ruler, Share2, Target, Trophy } from "lucide-react";
import dayjs, { setDayjsLocale } from "../utils/dayjs";
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import {
  API_ROUTES,
  createOperationId,
  type ApiFailure,
  type Post,
  type UserProfile,
  type Workout,
} from "@motionmeet/shared";
import api from "~/api/axios";
import { useAppDispatch, useAppSelector } from "~/app/hooks";
import { createPost } from "~/api/endpoints";
import FollowButton from "~/components/FollowButton";
import Loading from "~/components/Loading";
import ProfileModal from "~/components/ProfileModal";
import { EmptyState, PageShell } from "~/components/AppPage";
import { setRelationship } from "~/features/relationships/relationshipsSlice";

const Profile = () => {
  const theme = useTheme();
  const currentUser = useAppSelector((state) => state.user.value);
  const dispatch = useAppDispatch();
  const { profileId } = useParams();
  const navigate = useNavigate();
  const { getToken } = useAuthContext();
  const { t, i18n } = useTranslation();
  const [publicProfile, setPublicProfile] = useState<UserProfile | null>(null);
  const [publicPosts, setPublicPosts] = useState<Post[]>([]);
  const [relationshipLoading, setRelationshipLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(Boolean(profileId));
  const [profileError, setProfileError] = useState("");
  const [activeStatTab, setActiveStatTab] = useState<"duration" | "volume" | "reps">("duration");
  const [showEdit, setShowEdit] = useState(false);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [workoutCursor, setWorkoutCursor] = useState<string | null>(null);
  const [loadingMoreWorkouts, setLoadingMoreWorkouts] = useState(false);
  const [chartData, setChartData] = useState<Array<{ name: string; amt: number }>>([]);
  const [sharingWorkoutId, setSharingWorkoutId] = useState<string | null>(null);
  const shareOperationIdsRef = useRef(new Map<string, string>());

  const isOwnProfile = !profileId || profileId === currentUser?._id;
  const user = isOwnProfile ? currentUser : publicProfile;
  const visibleWorkouts: Workout[] = isOwnProfile
    ? workouts
    : publicPosts
        .map((post) => post.workout)
        .filter((workout): workout is Workout => Boolean(workout) && typeof workout !== "string");
  const followersCount = user?.followers_count ?? 0;
  const followingCount = user?.following_count ?? 0;

  useEffect(() => {
    setDayjsLocale(i18n.language);
  }, [i18n.language]);

  useEffect(() => {
    if (!profileId || profileId === currentUser?._id) {
      setProfileError("");
      setProfileLoading(false);
      return undefined;
    }

    let active = true;
    const fetchProfile = async () => {
      setProfileLoading(true);
      setPublicProfile(null);
      setProfileError("");
      try {
        const token = await getToken();
        if (!token) throw new Error("Your session has expired");
        const { data } = await api.post<{ success: boolean; message?: string; profile: UserProfile; posts: Post[] }>(
          API_ROUTES.user_extras.profiles,
          { profileId },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (active && data.success) {
          setPublicProfile(data.profile);
          setPublicPosts(data.posts || []);
          // Seeds the shared store so the follow button here and the one on
          // this person's feed cards agree from the first render.
          dispatch(setRelationship({
            userId: data.profile._id,
            relationship: {
              isFollowing: Boolean(data.profile.isFollowing),
              isFollowedBy: Boolean(data.profile.isFollowedBy),
              requestSent: Boolean(data.profile.requestSent),
              requestReceived: Boolean(data.profile.requestReceived),
              isConnection: Boolean(data.profile.isConnection),
              connectionPending: Boolean(data.profile.connectionPending),
            },
          }));
        }
        if (active && !data.success) {
          setProfileError(data.message || "Profile could not be loaded");
          toast.error(data.message || "Profile could not be loaded");
        }
      } catch (error: unknown) {
        if (active) {
          const failure = axios.isAxiosError<ApiFailure>(error) ? error.response?.data : undefined;
          const message = failure?.message || (error instanceof Error ? error.message : "Profile could not be loaded");
          setProfileError(message);
          toast.error(message);
        }
      } finally {
        if (active) setProfileLoading(false);
      }
    };

    fetchProfile();
    return () => {
      active = false;
    };
  }, [currentUser?._id, dispatch, getToken, profileId]);

  useEffect(() => {
    if (!isOwnProfile) return undefined;

    const fetchWorkouts = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const { data } = await api.get<{ success: boolean; workouts: Workout[]; nextCursor: string | null }>(API_ROUTES.workout.base, {
          headers: { Authorization: `Bearer ${token}` },
          params: { limit: 100 },
        });
        if (data.success) {
          setWorkouts(data.workouts || []);
          setWorkoutCursor(data.nextCursor);
        }
      } catch (error) {
        console.error("Error fetching workouts", error);
      }
    };
    fetchWorkouts();
    return undefined;
  }, [getToken, isOwnProfile]);

  const loadMoreWorkouts = async () => {
    if (!workoutCursor || loadingMoreWorkouts) return;
    setLoadingMoreWorkouts(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Your session has expired");
      const { data } = await api.get<{ success: boolean; workouts: Workout[]; nextCursor: string | null }>(API_ROUTES.workout.base, {
        headers: { Authorization: `Bearer ${token}` },
        params: { cursor: workoutCursor, limit: 100 },
      });
      if (data.success) {
        setWorkouts((currentWorkouts) => {
          const knownIds = new Set(currentWorkouts.map((workout) => workout._id));
          return [
            ...currentWorkouts,
            ...(data.workouts || []).filter((workout) => !knownIds.has(workout._id)),
          ];
        });
        setWorkoutCursor(data.nextCursor);
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Workouts could not be loaded");
    } finally {
      setLoadingMoreWorkouts(false);
    }
  };

  useEffect(() => {
    const weeks: Array<{ start: dayjs.Dayjs; end: dayjs.Dayjs; name: string; amt: number }> = [];
    for (let index = 5; index >= 0; index -= 1) {
      const startOfWeek = dayjs().subtract(index, "weeks").startOf("isoWeek");
      weeks.push({
        start: startOfWeek,
        end: dayjs(startOfWeek).endOf("isoWeek"),
        name: startOfWeek.format("MMM DD"),
        amt: 0,
      });
    }

    visibleWorkouts.forEach((workout) => {
      const workoutDate = dayjs(workout.startTime);
      const week = weeks.find((item) => workoutDate.isBetween(item.start, item.end));
      if (!week) return;

      if (activeStatTab === "duration") week.amt += workout.durationMinutes || 0;
      if (activeStatTab === "volume") week.amt += workout.volumeKg || 0;
      if (activeStatTab === "reps") {
        workout.exercises?.forEach((exercise) => {
          exercise.sets?.forEach((set) => {
            week.amt += set.reps || 0;
          });
        });
      }
    });

    setChartData(weeks.map(({ name, amt }) => ({ name, amt })));
  }, [visibleWorkouts, activeStatTab]);

  const shareWorkout = async (workout: Workout) => {
    if (!workout?._id || sharingWorkoutId) return;
    setSharingWorkoutId(workout._id);
    try {
      const token = await getToken();
      if (!token) throw new Error("Your session has expired");
      let operationId = shareOperationIdsRef.current.get(workout._id);
      if (!operationId) {
        operationId = createOperationId("post");
        shareOperationIdsRef.current.set(workout._id, operationId);
      }
      const data = await createPost({
        operationId,
        post_type: "workout",
        workout: workout._id,
        content:
          t("feed.workout_post_content", { name: workout.name }) ||
          `Just finished my ${workout.name} workout!`,
      }, token);
      if (data.success) toast.success(t("feed.post_published", "Shared to feed!"));
      if (data.success) shareOperationIdsRef.current.delete(workout._id);
      else throw new Error(data.message || "Failed to share");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("feed.publish_failed", "Failed to share"));
    } finally {
      setSharingWorkoutId(null);
    }
  };

  if (profileLoading) return <Loading />;
  if (!user) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", minHeight: "60vh", p: 3 }}>
        <Box sx={{ width: "min(100%, 520px)" }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {profileError || t("profile.not_found", "Profile not found")}
          </Alert>
          <Button fullWidth variant="outlined" onClick={() => window.history.back()}>
            {t("common.back", "Back")}
          </Button>
        </Box>
      </Box>
    );
  }

  // A private account the viewer does not follow shows its header and nothing
  // else. The backend already withholds the posts; this keeps the page honest
  // about why it is empty instead of looking broken.
  const contentLocked = !isOwnProfile && publicProfile?.isPrivate === true && publicProfile?.canViewContent === false;
  const profileLocation = user?.location?.trim() || "";

  const profileStats = [
    {
      label: t("profile.workouts"),
      value: user?.statistics?.totalWorkouts ?? visibleWorkouts.length,
      highlight: true,
      route: null as string | null,
    },
    { label: t("profile.followers"), value: followersCount, highlight: false, route: isOwnProfile ? "/connections?section=Followers" : null },
    { label: t("profile.following"), value: followingCount, highlight: false, route: isOwnProfile ? "/connections?section=Following" : null },
  ];
  const insights = [
    { label: t("profile.stats"), icon: LineChart, route: "/statistics" },
    { label: t("menu.exercises"), icon: Dumbbell, route: "/exercises" },
    { label: t("profile.awards"), icon: Trophy, route: "/statistics/records" },
    { label: t("profile.events"), icon: CalendarIcon, route: "/statistics/history" },
    { label: t("measurements.title", "Measurements"), icon: Ruler, route: "/measurements" },
    { label: t("connections.title", "Connections"), icon: Target, route: "/connections" },
  ];
  const currentAmount = chartData.at(-1)?.amt || 0;
  const currentUnit = activeStatTab === "duration" ? t("common.minutes_short") : activeStatTab === "volume" ? t("common.kg") : t("profile.reps");

  /**
   * The follow graph is owned by `FollowButton` and the relationships slice.
   * What remains here is the older two-way connection request, which has its
   * own queue and its own accept step.
   */
  const updateRelationship = async (route: string) => {
    if (!profileId || relationshipLoading) return;
    setRelationshipLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Your session has expired");
      const { data } = await api.post<{ success: boolean; message?: string }>(
        route,
        { id: profileId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!data.success) throw new Error(data.message);
      setPublicProfile((profile) => (profile ? { ...profile, connectionPending: true } : profile));
      toast.success(data.message || "Profile updated");
    } catch (error: unknown) {
      const failure = axios.isAxiosError<ApiFailure>(error) ? error.response?.data : undefined;
      toast.error(failure?.message || (error instanceof Error ? error.message : "Profile could not be updated"));
    } finally {
      setRelationshipLoading(false);
    }
  };

  return (
    <PageShell maxWidth={935}>
      {/* Instagram's profile header: a large round picture on the left, the
          username with its one or two buttons, the counts as a single line of
          text, then the name and bio. No panel around it, no gradient band
          standing in for a missing cover photo. */}
      {user.cover_photo && (
        <Box
          component="img"
          src={user.cover_photo}
          alt=""
          sx={{ width: "100%", height: { xs: 110, sm: 160 }, display: "block", objectFit: "cover", borderRadius: 3 }}
        />
      )}
      <Stack
        direction="row"
        spacing={{ xs: 2.5, sm: 6 }}
        sx={{ alignItems: { xs: "center", sm: "flex-start" }, px: { xs: 0.5, sm: 4 }, pt: { xs: 1, sm: 2 } }}
      >
        <Avatar
          src={user.profile_picture || undefined}
          alt={user.full_name}
          sx={{ width: { xs: 80, sm: 150 }, height: { xs: 80, sm: 150 }, fontSize: { xs: 30, sm: 52 }, fontWeight: 500, bgcolor: "action.hover", color: "text.secondary" }}
        >
          {user.full_name?.charAt(0).toUpperCase() || "U"}
        </Avatar>
        <Stack spacing={{ xs: 1, sm: 2 }} sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
            <Typography sx={{ fontSize: { xs: 18, sm: 20 }, fontWeight: 400, mr: 1 }} noWrap>
              {user.username || user.full_name}
            </Typography>
            {publicProfile?.isPrivate && <Lock size={15} />}
            {isOwnProfile ? (
              <Stack direction="row" spacing={1} sx={{ display: { xs: "none", sm: "flex" } }}>
                <Button variant="outlined" size="small" onClick={() => setShowEdit(true)}>
                  {t("profile.edit_profile")}
                </Button>
                <Button variant="outlined" size="small" onClick={() => navigate("/settings")}>
                  {t("settings.title", "Ayarlar")}
                </Button>
              </Stack>
            ) : (
              <Stack direction="row" spacing={1} sx={{ display: { xs: "none", sm: "flex" } }}>
                <FollowButton
                  userId={publicProfile?._id}
                  seed={{
                    isFollowing: Boolean(publicProfile?.isFollowing),
                    isFollowedBy: Boolean(publicProfile?.isFollowedBy),
                    requestSent: Boolean(publicProfile?.requestSent),
                    requestReceived: Boolean(publicProfile?.requestReceived),
                  }}
                />
                {publicProfile?.canMessage !== false && (
                  <Button variant="outlined" size="small" onClick={() => navigate(`/messages/${publicProfile?._id}`)}>
                    {t("common.message_action", "Message")}
                  </Button>
                )}
                {!user.isConnection && (
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={relationshipLoading || user.connectionPending}
                    onClick={() => updateRelationship(API_ROUTES.user_extras.connect)}
                  >
                    {user.connectionPending ? t("profile.connection_pending", "Pending") : t("profile.connect", "Connect")}
                  </Button>
                )}
              </Stack>
            )}
          </Stack>
          <Stack direction="row" spacing={{ xs: 2, sm: 4 }}>
            {profileStats.map((stat) => (
              <Typography
                key={stat.label}
                variant="body2"
                onClick={stat.route ? () => navigate(stat.route as string) : undefined}
                sx={{ cursor: stat.route ? "pointer" : "default", fontSize: { xs: 13.5, sm: 15 } }}
              >
                <Box component="span" sx={{ fontWeight: 600 }}>{stat.value}</Box> {stat.label}
              </Typography>
            ))}
          </Stack>
          <Box sx={{ display: { xs: "none", sm: "block" } }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{user.full_name}</Typography>
            {user.bio && <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>{user.bio}</Typography>}
            {profileLocation && (
              <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", color: "text.secondary", mt: 0.25 }}>
                <MapPin size={13} />
                <Typography variant="caption">{profileLocation}</Typography>
              </Stack>
            )}
          </Box>
        </Stack>
      </Stack>
      {/* On a phone the name, bio and buttons drop under the picture row, as
          Instagram's mobile web does. */}
      <Box sx={{ display: { xs: "block", sm: "none" }, px: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{user.full_name}</Typography>
        {user.bio && <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>{user.bio}</Typography>}
        {profileLocation && (
          <Typography variant="caption" color="text.secondary">{profileLocation}</Typography>
        )}
        <Stack direction="row" spacing={0.75} sx={{ mt: 1.5 }}>
          {isOwnProfile ? (
            <>
              <Button fullWidth variant="outlined" size="small" onClick={() => setShowEdit(true)}>
                {t("profile.edit_profile")}
              </Button>
              <Button fullWidth variant="outlined" size="small" onClick={() => navigate("/settings")}>
                {t("settings.title", "Ayarlar")}
              </Button>
            </>
          ) : (
            <>
              <FollowButton
                fullWidth
                userId={publicProfile?._id}
                seed={{
                  isFollowing: Boolean(publicProfile?.isFollowing),
                  isFollowedBy: Boolean(publicProfile?.isFollowedBy),
                  requestSent: Boolean(publicProfile?.requestSent),
                  requestReceived: Boolean(publicProfile?.requestReceived),
                }}
              />
              {publicProfile?.canMessage !== false && (
                <Button fullWidth variant="outlined" size="small" onClick={() => navigate(`/messages/${publicProfile?._id}`)}>
                  {t("common.message_action", "Message")}
                </Button>
              )}
            </>
          )}
        </Stack>
      </Box>

      {contentLocked ? (
        <EmptyState
          icon={Lock}
          title={t("profile.private_title", "This account is private")}
          description={t("profile.private_body", "Follow this athlete to see their workouts, posts and stories.")}
          minHeight={260}
        />
      ) : (
        <>
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", justifyContent: "space-between" }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
              <Typography sx={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {currentAmount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {currentUnit}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {t("profile.weekly_activity")}
            </Typography>
          </Stack>

          <Box sx={{ width: "100%", height: 168, mt: 2 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="30%">
                <XAxis dataKey="name" stroke={theme.palette.text.disabled} fontSize={11} tickLine={false} axisLine={false} tickMargin={8} />
                <Tooltip
                  cursor={{ fill: theme.palette.action.hover }}
                  contentStyle={{ backgroundColor: theme.palette.background.paper, color: theme.palette.text.primary, border: `1px solid ${theme.palette.divider}`, borderRadius: 8, boxShadow: "none", fontSize: 12 }}
                  itemStyle={{ fontWeight: 600, color: theme.palette.text.primary }}
                />
                <Bar dataKey="amt" fill={theme.palette.primary.main} radius={[3, 3, 0, 0]} maxBarSize={22}>
                  {chartData.map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} fill={theme.palette.primary.main} fillOpacity={index === chartData.length - 1 ? 1 : 0.35} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>

          <Stack direction="row" spacing={0.75} sx={{ mt: 2 }}>
            {["duration", "volume", "reps"].map((tab) => (
              <Button
                key={tab}
                size="small"
                variant={activeStatTab === tab ? "contained" : "outlined"}
                onClick={() => setActiveStatTab(tab as typeof activeStatTab)}
                sx={{ borderRadius: 99, minWidth: 0, px: 1.75 }}
              >
                {t(`profile.${tab}`)}
              </Button>
            ))}
          </Stack>
        </Paper>

        {/* Hevy's dashboard: the places people go from a profile as short
            soft buttons, not a grid of cards with an icon in a tinted tile. */}
        {isOwnProfile && (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)" }, gap: 1 }}>
            {insights.map(({ label, icon: Icon, route }) => (
              <Button
                key={label}
                variant="outlined"
                onClick={() => navigate(route)}
                startIcon={<Icon size={17} />}
                sx={{ justifyContent: "flex-start", minHeight: 40, px: 1.5 }}
              >
                <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</Box>
              </Button>
            ))}
          </Box>
        )}

        <Stack spacing={1}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, px: 0.5 }}>
            {t("profile.recent_workouts", "Son antrenmanlar")}
          </Typography>

          {visibleWorkouts.length > 0 ? (
            <Paper variant="outlined" sx={{ overflow: "hidden" }}>
              {visibleWorkouts.map((workout, index) => (
                <Stack
                  key={workout._id}
                  direction="row"
                  spacing={2}
                  sx={{
                    px: 2,
                    py: 1.25,
                    alignItems: "center",
                    borderTop: index ? 1 : 0,
                    borderColor: "divider",
                  }}
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                      {workout.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                      {dayjs(workout.startTime).format("D MMM YYYY")} · {workout.durationMinutes} {t("common.minutes_short", "dk")} · {workout.volumeKg} kg
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => shareWorkout(workout)}
                    disabled={sharingWorkoutId === workout._id}
                    title={t("feed.share", "Share to feed")}
                  >
                    <Share2 size={17} />
                  </IconButton>
                </Stack>
              ))}
            </Paper>
          ) : (
            <EmptyState
              icon={Dumbbell}
              title={t("profile.no_workouts_yet")}
              description={t("profile.start_journey")}
            />
          )}
          {isOwnProfile && workoutCursor && (
            <Button
              variant="outlined"
              size="small"
              onClick={loadMoreWorkouts}
              disabled={loadingMoreWorkouts}
              sx={{ alignSelf: "center" }}
            >
              {loadingMoreWorkouts
                ? t("common.loading", "Loading...")
                : t("common.load_more", "Load more")}
            </Button>
          )}
        </Stack>
        </>
      )}
      {isOwnProfile && showEdit && <ProfileModal setShowEdit={setShowEdit} />}
    </PageShell>
  );
};

export default Profile;
