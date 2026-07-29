import { useAuthContext } from "../context/AuthProvider";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  IconButton,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from "@mui/material";
import { Calendar as CalendarIcon, Dumbbell, LineChart, Share2, Target, TrendingUp, Trophy } from "lucide-react";
import moment from "moment";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { API_ROUTES, createOperationId } from "@motionmeet/shared";
import api from "~/api/axios";
import { createPost } from "~/api/endpoints";
import Loading from "~/components/Loading";
import ProfileModal from "~/components/ProfileModal";
import { EmptyState, PageShell, SectionHeader } from "~/components/AppPage";

const Profile = () => {
  const theme = useTheme();
  const currentUser = useSelector((state) => state.user.value);
  const { profileId } = useParams();
  const navigate = useNavigate();
  const { getToken } = useAuthContext();
  const { t, i18n } = useTranslation();
  const [publicProfile, setPublicProfile] = useState(null);
  const [publicPosts, setPublicPosts] = useState([]);
  const [relationshipLoading, setRelationshipLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(Boolean(profileId));
  const [profileError, setProfileError] = useState("");
  const [activeStatTab, setActiveStatTab] = useState("duration");
  const [showEdit, setShowEdit] = useState(false);
  const [workouts, setWorkouts] = useState([]);
  const [workoutCursor, setWorkoutCursor] = useState(null);
  const [loadingMoreWorkouts, setLoadingMoreWorkouts] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [sharingWorkoutId, setSharingWorkoutId] = useState(null);
  const shareOperationIdsRef = useRef(new Map());

  const isOwnProfile = !profileId || profileId === currentUser?._id;
  const user = isOwnProfile ? currentUser : publicProfile;
  const visibleWorkouts = isOwnProfile
    ? workouts
    : publicPosts.map((post) => post.workout).filter(Boolean);
  const followersCount = user?.followers_count ?? user?.followers?.length ?? 0;
  const followingCount = user?.following_count ?? user?.following?.length ?? 0;

  useEffect(() => {
    moment.locale(i18n.language.startsWith("tr") ? "tr" : "en");
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
        const { data } = await api.post(
          API_ROUTES.user_extras.profiles,
          { profileId },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (active && data.success) {
          setPublicProfile(data.profile);
          setPublicPosts(data.posts || []);
        }
        if (active && !data.success) {
          setProfileError(data.message || "Profile could not be loaded");
          toast.error(data.message);
        }
      } catch (error) {
        if (active) {
          const message = error.response?.data?.message || error.message || "Profile could not be loaded";
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
  }, [currentUser?._id, getToken, profileId]);

  useEffect(() => {
    if (!isOwnProfile) return undefined;

    const fetchWorkouts = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const { data } = await api.get(API_ROUTES.workout.base, {
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
      const { data } = await api.get(API_ROUTES.workout.base, {
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
    } catch (error) {
      toast.error(error.message || "Workouts could not be loaded");
    } finally {
      setLoadingMoreWorkouts(false);
    }
  };

  useEffect(() => {
    const weeks = [];
    for (let index = 5; index >= 0; index -= 1) {
      const startOfWeek = moment().subtract(index, "weeks").startOf("isoWeek");
      weeks.push({
        start: startOfWeek,
        end: moment(startOfWeek).endOf("isoWeek"),
        name: startOfWeek.format("MMM DD"),
        amt: 0,
      });
    }

    visibleWorkouts.forEach((workout) => {
      const workoutDate = moment(workout.startTime);
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

  const shareWorkout = async (workout) => {
    if (!workout?._id || sharingWorkoutId) return;
    setSharingWorkoutId(workout._id);
    try {
      const token = await getToken();
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
    } catch (error) {
      toast.error(error.message || t("feed.publish_failed", "Failed to share"));
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

  const profileStats = [
    {
      label: t("profile.workouts"),
      value: user?.statistics?.totalWorkouts ?? visibleWorkouts.length,
      highlight: true,
    },
    { label: t("profile.followers"), value: followersCount },
    { label: t("profile.following"), value: followingCount },
  ];
  const insights = [
    { label: t("profile.stats"), icon: LineChart, route: "/statistics" },
    { label: t("menu.exercises"), icon: Dumbbell, route: "/exercises" },
    { label: t("profile.awards"), icon: Trophy, route: "/statistics/records" },
    { label: t("profile.events"), icon: CalendarIcon, route: "/statistics/history" },
  ];
  const currentAmount = chartData.at(-1)?.amt || 0;
  const currentUnit = activeStatTab === "duration" ? t("common.minutes_short") : activeStatTab === "volume" ? t("common.kg") : t("profile.reps");

  const updateRelationship = async (route) => {
    if (!profileId || relationshipLoading) return;
    setRelationshipLoading(true);
    try {
      const token = await getToken();
      const { data } = await api.post(
        route,
        { id: profileId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!data.success) throw new Error(data.message);
      setPublicProfile((profile) => ({
        ...profile,
        isFollowing:
          route === API_ROUTES.user_extras.follow
            ? true
            : route === API_ROUTES.user_extras.unfollow
              ? false
              : profile.isFollowing,
        followers_count:
          route === API_ROUTES.user_extras.follow
            ? (profile.followers_count || 0) + 1
            : route === API_ROUTES.user_extras.unfollow
              ? Math.max(0, (profile.followers_count || 0) - 1)
              : profile.followers_count,
        connectionPending:
          route === API_ROUTES.user_extras.connect
            ? true
            : profile.connectionPending,
      }));
      toast.success(data.message);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setRelationshipLoading(false);
    }
  };

  return (
    <PageShell maxWidth={1120}>
      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        <Box
          sx={{
            position: "relative",
            height: { xs: 112, sm: 156 },
            background: "linear-gradient(115deg, rgba(101,88,245,.28), rgba(59,130,246,.18), rgba(0,169,143,.18))",
          }}
        >
          {user.cover_photo && (
            <Box
              component="img"
              src={user.cover_photo}
              alt=""
              sx={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }}
            />
          )}
          <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 45%, rgba(9,10,13,.34))" }} />
        </Box>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{
            p: { xs: 2, sm: 3 },
            pt: { xs: 0, sm: 0 },
            alignItems: "center",
            justifyContent: "space-between",
            textAlign: { xs: "center", sm: "left" },
          }}
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5} sx={{ alignItems: "center", mt: { xs: -5, sm: -4 } }}>
            <Box sx={{ position: "relative" }}>
              <Avatar src={user.profile_picture || undefined} alt={user.full_name} variant="rounded" sx={{ width: 88, height: 88, borderRadius: 3, fontSize: 30, fontWeight: 800, border: 4, borderColor: "background.paper", bgcolor: "background.paper", boxShadow: 3 }}>
                {user.full_name?.charAt(0).toUpperCase() || "U"}
              </Avatar>
            </Box>
            <Stack spacing={1}>
              <Typography variant="h5" sx={{ fontWeight: 900 }}>
                {user.full_name || user.username}
              </Typography>
              <Stack direction="row" spacing={2} divider={<Box sx={{ width: "1px", height: 32, bgcolor: "divider" }} />} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                {profileStats.map((stat) => (
                  <Stack key={stat.label}>
                    <Typography variant="h6" color={stat.highlight ? "primary.main" : "text.primary"} sx={{ fontWeight: 900, lineHeight: 1 }}>
                      {stat.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                      {stat.label}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </Stack>
          {isOwnProfile ? (
            <Button variant="outlined" onClick={() => setShowEdit(true)} sx={{ width: { xs: "100%", sm: "auto" } }}>
              {t("profile.edit_profile")}
            </Button>
          ) : (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ width: { xs: "100%", sm: "auto" } }}>
              <Button
                variant={user.isFollowing ? "outlined" : "contained"}
                disabled={relationshipLoading}
                onClick={() => updateRelationship(
                  user.isFollowing
                    ? API_ROUTES.user_extras.unfollow
                    : API_ROUTES.user_extras.follow
                )}
              >
                {user.isFollowing ? t("profile.unfollow", "Unfollow") : t("profile.follow", "Follow")}
              </Button>
              {!user.isConnection && (
                <Button
                  variant="outlined"
                  disabled={relationshipLoading || user.connectionPending}
                  onClick={() => updateRelationship(API_ROUTES.user_extras.connect)}
                >
                  {user.connectionPending
                    ? t("profile.connection_pending", "Pending")
                    : t("profile.connect", "Connect")}
                </Button>
              )}
            </Stack>
          )}
        </Stack>
      </Paper>

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack direction="row" spacing={1.5} sx={{ mb: 3, alignItems: "flex-start" }}>
            <Avatar variant="rounded" sx={{ bgcolor: "action.hover", color: "primary.main" }}>
              <TrendingUp size={20} />
            </Avatar>
            <Stack>
              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800, lineHeight: 1.5 }}>
                {t("profile.weekly_activity")}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
                <Typography variant="h4" sx={{ fontWeight: 900 }}>
                  {currentAmount}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                  {currentUnit}
                </Typography>
              </Stack>
            </Stack>
          </Stack>

          <Box sx={{ width: "100%", height: 192 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke={theme.palette.text.disabled} fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} tickMargin={10} />
                <Tooltip
                  cursor={{ fill: theme.palette.action.hover }}
                  contentStyle={{ backgroundColor: theme.palette.background.paper, color: theme.palette.text.primary, border: `1px solid ${theme.palette.divider}`, borderRadius: 12, boxShadow: theme.shadows[3] }}
                  itemStyle={{ fontWeight: 700, color: theme.palette.text.primary }}
                />
                <Bar dataKey="amt" fill={theme.palette.primary.main} radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} fill={theme.palette.primary.main} fillOpacity={index === chartData.length - 1 ? 1 : 0.3} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>

          <ToggleButtonGroup
            exclusive
            size="small"
            value={activeStatTab}
            onChange={(_, value) => value && setActiveStatTab(value)}
            sx={{ mt: 3, bgcolor: "action.hover", p: 0.5, borderRadius: 2, "& .MuiToggleButton-root": { border: 0, borderRadius: 1.5, px: 2.5, fontWeight: 700 } }}
          >
            {["duration", "volume", "reps"].map((tab) => (
              <ToggleButton key={tab} value={tab}>
                {t(`profile.${tab}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Paper>

        {isOwnProfile && <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} sx={{ px: 1, alignItems: "center" }}>
            <Target size={16} />
            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 900 }}>
              {t("profile.insights")}
            </Typography>
          </Stack>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" }, gap: 2 }}>
            {insights.map(({ label, icon: Icon, route }) => (
              <Card key={label} variant="outlined">
                <CardActionArea onClick={() => navigate(route)} sx={{ p: 2, height: "100%" }}>
                  <Stack spacing={1.5} sx={{ alignItems: "center" }}>
                    <Avatar variant="rounded" sx={{ bgcolor: "action.hover", color: "text.secondary" }}>
                      <Icon size={20} />
                    </Avatar>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textAlign: "center" }}>
                      {label}
                    </Typography>
                  </Stack>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        </Stack>}

        <Stack spacing={2}>
          <SectionHeader
            title={t("profile.workouts")}
            description="Your latest completed sessions"
            action={<Chip label={user?.statistics?.totalWorkouts ?? visibleWorkouts.length} size="small" />}
          />

          {visibleWorkouts.length > 0 ? (
            visibleWorkouts.map((workout) => (
              <Paper key={workout._id} variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      {workout.name}
                    </Typography>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                      <IconButton
                        onClick={() => shareWorkout(workout)}
                        disabled={sharingWorkoutId === workout._id}
                        title={t("feed.share", "Share to feed")}
                      >
                        <Share2 size={18} />
                      </IconButton>
                      <Stack sx={{ alignItems: "flex-end" }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                          {t("profile.history")}
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>
                          {moment(workout.startTime).format("MMM DD, YYYY")}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Stack>
                  <Stack direction="row" spacing={3}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>• {workout.durationMinutes} min</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>• {workout.volumeKg} kg</Typography>
                  </Stack>
                </Stack>
              </Paper>
            ))
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
      {isOwnProfile && showEdit && <ProfileModal setShowEdit={setShowEdit} />}
    </PageShell>
  );
};

export default Profile;
