import { Avatar, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useAppSelector } from "~/app/hooks";

const QuickProfile = () => {
  const user = useAppSelector((state) => state.user.value);
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (!user) return null;

  const statistics = [
    { label: t("feed.workouts"), value: user.statistics?.totalWorkouts || 0 },
    { label: t("feed.followers"), value: user.followers_count ?? 0 },
    { label: t("feed.following"), value: user.following_count ?? 0 },
  ];

  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Avatar
              src={user.profile_picture || undefined}
              alt={user.username}
              sx={{ width: 52, height: 52, fontSize: 20, fontWeight: 800, border: 1, borderColor: "divider" }}
            >
              {user.username?.charAt(0).toUpperCase()}
            </Avatar>
            <Stack sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" noWrap sx={{ fontWeight: 800 }}>
                {user.full_name || user.username}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                @{user.username}
              </Typography>
            </Stack>
          </Stack>

          <Stack direction="row" sx={{ width: "100%", justifyContent: "space-between" }}>
            {statistics.map((stat) => (
              <Stack key={stat.label} spacing={0.5} sx={{ minWidth: 0, alignItems: "center" }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  {stat.label}
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1 }}>
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
