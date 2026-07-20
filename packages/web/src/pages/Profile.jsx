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
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useParams } from "react-router-dom";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import api from "~/api/axios";
import Loading from "~/components/Loading";
import ProfileModal from "~/components/ProfileModal";

const EMPTY_WORKOUTS = [];

const Profile = () => {
  const theme = useTheme();
  const currentUser = useSelector((state) => state.user.value);
  const { profileId } = useParams();
  const { getToken } = useAuthContext();
  const { t, i18n } = useTranslation();
  const [publicProfile, setPublicProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(Boolean(profileId));
  const [profileError, setProfileError] = useState("");
  const [activeStatTab, setActiveStatTab] = useState("duration");
  const [showEdit, setShowEdit] = useState(false);
  const [workouts, setWorkouts] = useState([]);
  const [chartData, setChartData] = useState([]);

  const isOwnProfile = !profileId || profileId === currentUser?._id;
  const user = isOwnProfile ? currentUser : publicProfile;
  const visibleWorkouts = isOwnProfile ? workouts : EMPTY_WORKOUTS;
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
          "/api/user/profiles",
          { profileId },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (active && data.success) setPublicProfile(data.profile);
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
        const { data } = await api.get("/api/workout", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (data.success) setWorkouts(data.workouts || []);
      } catch (error) {
        console.error("Error fetching workouts", error);
      }
    };
    fetchWorkouts();
    return undefined;
  }, [getToken, isOwnProfile]);

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
    try {
      const token = await getToken();
      const { data } = await api.post(
        "/api/post/add",
        {
          post_type: "workout",
          workout: workout._id,
          content: t("feed.workout_post_content", { name: workout.name }) || `Just finished my ${workout.name} workout!`,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (data.success) toast.success(t("feed.post_published", "Shared to feed!"));
    } catch {
      toast.error(t("feed.publish_failed", "Failed to share"));
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
    { label: t("profile.workouts"), value: visibleWorkouts.length, highlight: true },
    { label: t("profile.followers"), value: followersCount },
    { label: t("profile.following"), value: followingCount },
  ];
  const insights = [
    { label: t("profile.stats"), icon: LineChart },
    { label: t("menu.exercises"), icon: Dumbbell },
    { label: t("profile.awards"), icon: Trophy },
    { label: t("profile.events"), icon: CalendarIcon },
  ];
  const currentAmount = chartData.at(-1)?.amt || 0;
  const currentUnit = activeStatTab === "duration" ? t("common.minutes_short") : activeStatTab === "volume" ? t("common.kg") : t("profile.reps");

  return (
    <Box sx={{ width: "100%", minHeight: "100vh", overflowY: "auto", py: { xs: 2, sm: 3 }, pb: { xs: 10, sm: 5 } }}>
      <Stack spacing={3} sx={{ maxWidth: 896, mx: "auto", px: { xs: 2, sm: 4 } }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ py: 2, alignItems: { xs: "center", sm: "center" }, justifyContent: "space-between", textAlign: { xs: "center", sm: "left" } }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5} sx={{ alignItems: "center" }}>
            <Box sx={{ position: "relative" }}>
              <Avatar src={user.profile_picture || undefined} alt={user.full_name} variant="rounded" sx={{ width: 80, height: 80, borderRadius: 3, fontSize: 30, fontWeight: 800, border: 1, borderColor: "divider", boxShadow: 2 }}>
                {user.full_name?.charAt(0).toUpperCase() || "U"}
              </Avatar>
              <Box sx={{ position: "absolute", right: -3, bottom: -3, width: 22, height: 22, bgcolor: "success.main", borderRadius: "50%", border: 4, borderColor: "background.default" }} />
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
          {isOwnProfile && (
            <Button variant="outlined" onClick={() => setShowEdit(true)} sx={{ width: { xs: "100%", sm: "auto" } }}>
              {t("profile.edit_profile")}
            </Button>
          )}
        </Stack>

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
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

        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} sx={{ px: 1, alignItems: "center" }}>
            <Target size={16} />
            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 900 }}>
              {t("profile.insights")}
            </Typography>
          </Stack>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" }, gap: 2 }}>
            {insights.map(({ label, icon: Icon }) => (
              <Card key={label} variant="outlined" sx={{ borderRadius: 3 }}>
                <CardActionArea sx={{ p: 2.5, height: "100%" }}>
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
        </Stack>

        <Stack spacing={2}>
          <Stack direction="row" sx={{ px: 1, alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 900 }}>
              {t("profile.workouts")}
            </Typography>
            <Chip label={visibleWorkouts.length} size="small" />
          </Stack>

          {visibleWorkouts.length > 0 ? (
            visibleWorkouts.map((workout) => (
              <Paper key={workout._id} variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      {workout.name}
                    </Typography>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                      <IconButton onClick={() => shareWorkout(workout)} title={t("feed.share", "Share to feed")}>
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
            <Paper variant="outlined" sx={{ p: 6, borderRadius: 3, textAlign: "center" }}>
              <Avatar sx={{ width: 72, height: 72, mx: "auto", mb: 2, bgcolor: "action.hover", color: "text.disabled" }}>
                <Dumbbell size={36} />
              </Avatar>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {t("profile.no_workouts_yet")}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {t("profile.start_journey")}
              </Typography>
            </Paper>
          )}
        </Stack>
      </Stack>

      {isOwnProfile && showEdit && <ProfileModal setShowEdit={setShowEdit} />}
    </Box>
  );
};

export default Profile;
