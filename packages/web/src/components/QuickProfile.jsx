import { Avatar, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

const QuickProfile = () => {
  const user = useSelector((state) => state.user.value);
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (!user) return null;

  const statistics = [
    { label: t("feed.workouts"), value: user.statistics?.totalWorkouts || 0 },
    { label: t("feed.followers"), value: user.followers_count ?? user.followers?.length ?? 0 },
    { label: t("feed.following"), value: user.following_count ?? user.following?.length ?? 0 },
  ];

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
        <Stack spacing={2.5} sx={{ alignItems: "center" }}>
          <Avatar
            src={user.profile_picture || undefined}
            alt={user.username}
            sx={{ width: 80, height: 80, fontSize: 28, fontWeight: 800, border: 2, borderColor: "divider" }}
          >
            {user.username?.charAt(0).toUpperCase()}
          </Avatar>

          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            @{user.username}
          </Typography>

          <Stack direction="row" sx={{ width: "100%", justifyContent: "space-between" }}>
            {statistics.map((stat) => (
              <Stack key={stat.label} spacing={0.5} sx={{ minWidth: 0, alignItems: "center" }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  {stat.label}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1 }}>
                  {stat.value}
                </Typography>
              </Stack>
            ))}
          </Stack>

          <Button fullWidth variant="outlined" onClick={() => navigate("/profile")}>
            {t("feed.see_profile")}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default QuickProfile;
