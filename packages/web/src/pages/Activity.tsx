import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import { Bell, Check, Heart, MessageCircle, UserPlus, UserCheck, type LucideIcon } from "lucide-react";
import dayjs, { setDayjsLocale } from "../utils/dayjs";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { Notification, NotificationType } from "@motionmeet/shared";
import { useAppDispatch, useAppSelector } from "~/app/hooks";
import { EmptyState, PageHeader, PageShell } from "~/components/AppPage";
import { useAuthContext } from "~/context/AuthProvider";
import {
  fetchNotifications,
  markAllNotificationsRead,
  respondToFollowRequest,
} from "~/features/notifications/notificationsSlice";

const ICONS: Record<NotificationType, { Icon: LucideIcon; tone: string }> = {
  follow_request: { Icon: UserPlus, tone: "primary.main" },
  follow_request_accepted: { Icon: UserCheck, tone: "primary.main" },
  follow: { Icon: UserCheck, tone: "primary.main" },
  post_like: { Icon: Heart, tone: "error.main" },
  post_comment: { Icon: MessageCircle, tone: "text.secondary" },
};

/**
 * The real activity list behind the bell. Notification *preferences* stay in
 * Settings; this page shows what actually happened.
 */
const Activity = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { getToken } = useAuthContext();
  const { items, nextCursor, loading, loadingMore, respondingTo } = useAppSelector((state) => state.notifications);

  useEffect(() => {
    setDayjsLocale(i18n.language);
  }, [i18n.language]);

  const load = useCallback(async (cursor?: string | null) => {
    const token = await getToken();
    if (!token) return;
    try {
      await dispatch(fetchNotifications({ token, cursor })).unwrap();
    } catch {
      // The page keeps whatever it already showed rather than blanking.
    }
  }, [dispatch, getToken]);

  // Opening the page is what counts as reading, so the badge clears here rather
  // than needing a separate gesture. The receipt is sent after the list has
  // loaded: the fetch answers with its own unread total, and sending both at
  // once lets that stale total land last and relight the badge.
  useEffect(() => {
    let active = true;
    void (async () => {
      await load();
      if (!active) return;
      const token = await getToken();
      if (active && token) dispatch(markAllNotificationsRead(token));
    })();
    return () => { active = false; };
  }, [dispatch, getToken, load]);

  const respond = useCallback(async (requesterId: string, accept: boolean) => {
    const token = await getToken();
    if (!token) return;
    try {
      await dispatch(respondToFollowRequest({ requesterId, token, accept })).unwrap();
    } catch {
      // The slice already recorded the failure; the row simply stays put.
    }
  }, [dispatch, getToken]);

  const describe = (notification: Notification): string => {
    const name = notification.actor?.full_name || notification.actor?.username || t("activity.someone", "An athlete");
    switch (notification.type) {
      case "follow_request":
        return t("activity.follow_request", "{{name}} wants to follow you", { name });
      case "follow_request_accepted":
        return t("activity.follow_request_accepted", "{{name}} accepted your follow request", { name });
      case "follow":
        return t("activity.follow", "{{name}} started following you", { name });
      case "post_like":
        return t("activity.post_like", "{{name}} liked your post", { name });
      case "post_comment":
        return t("activity.post_comment", "{{name}} commented on your post", { name });
      default:
        return name;
    }
  };

  return (
    <PageShell maxWidth={760}>
      <PageHeader
        icon={Bell}
        eyebrow={t("activity.eyebrow", "ACTIVITY")}
        title={t("activity.title", "Notifications")}
        description={t("activity.description", "Follow requests, likes and comments land here.")}
        action={(
          <Tooltip title={t("settings.notifications", "Notification settings")}>
            <IconButton aria-label={t("settings.notifications", "Notification settings")} onClick={() => navigate("/settings")}>
              <SettingsOutlined />
            </IconButton>
          </Tooltip>
        )}
      />

      {loading && items.length === 0 ? (
        <Stack sx={{ minHeight: 220, alignItems: "center", justifyContent: "center" }}>
          <CircularProgress size={28} />
        </Stack>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={t("activity.empty_title", "No notifications yet")}
          description={t("activity.empty_body", "Follow requests and likes will show up here.")}
        />
      ) : (
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          {items.map((item) => {
            const { Icon, tone } = ICONS[item.type] ?? ICONS.follow;
            const actorId = item.actor?._id;
            const busy = actorId ? respondingTo.includes(actorId) : false;

            return (
              <Stack
                key={item.id}
                direction="row"
                spacing={1.5}
                sx={{
                  px: 2,
                  py: 1.75,
                  alignItems: "flex-start",
                  borderBottom: 1,
                  borderColor: "divider",
                  bgcolor: item.read ? "transparent" : (theme) => alpha(theme.palette.primary.main, 0.06),
                  "&:last-of-type": { borderBottom: 0 },
                }}
              >
                <ButtonBase
                  onClick={() => { if (actorId) navigate(`/profile/${actorId}`); }}
                  sx={{ borderRadius: "50%", flexShrink: 0 }}
                >
                  <Avatar src={item.actor?.profile_picture || undefined} alt={item.actor?.full_name} sx={{ width: 44, height: 44 }}>
                    {(item.actor?.full_name || "?").charAt(0).toUpperCase()}
                  </Avatar>
                </ButtonBase>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                    {describe(item)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {dayjs(item.createdAt).fromNow()}
                  </Typography>
                  {item.actionable && actorId && (
                    <Stack direction="row" spacing={1} sx={{ mt: 1.25, flexWrap: "wrap" }}>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={busy}
                        startIcon={busy ? <CircularProgress size={13} color="inherit" /> : <Check size={15} />}
                        onClick={() => { void respond(actorId, true); }}
                      >
                        {t("activity.confirm", "Confirm")}
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        disabled={busy}
                        onClick={() => { void respond(actorId, false); }}
                      >
                        {t("activity.decline", "Delete")}
                      </Button>
                    </Stack>
                  )}
                </Box>

                <Box sx={{ color: tone, mt: 0.5, flexShrink: 0 }}>
                  <Icon size={18} />
                </Box>
              </Stack>
            );
          })}
        </Paper>
      )}

      {nextCursor && (
        <Button
          variant="outlined"
          onClick={() => { void load(nextCursor); }}
          disabled={loadingMore}
          startIcon={loadingMore ? <CircularProgress size={15} /> : null}
          sx={{ alignSelf: "center" }}
        >
          {t("common.load_more", "Load more")}
        </Button>
      )}
    </PageShell>
  );
};

export default Activity;
