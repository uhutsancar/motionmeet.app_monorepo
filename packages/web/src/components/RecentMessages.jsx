import { useAuthContext } from "../context/AuthProvider";
import { Avatar, Badge, Card, CardContent, List, ListItemButton, Stack, Typography } from "@mui/material";
import moment from "moment";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import api from "~/api/axios";
import { MessageSquare } from "lucide-react";

const RecentMessages = () => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const { user } = useAuthContext();
  const { getToken } = useAuthContext();

  const fetchRecentMessages = useCallback(async () => {
    try {
      const token = await getToken();
      const { data } = await api.get("/api/user/recent-messages", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        const groupedMessages = data.messages.reduce((latestBySender, message) => {
          const senderId = message.from_user_id._id;
          if (
            !latestBySender[senderId] ||
            new Date(message.createdAt) > new Date(latestBySender[senderId].createdAt)
          ) {
            latestBySender[senderId] = message;
          }
          return latestBySender;
        }, {});

        setMessages(
          Object.values(groupedMessages).sort(
            (first, second) => new Date(second.createdAt) - new Date(first.createdAt),
          ),
        );
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  }, [getToken]);

  useEffect(() => {
    if (!user) return undefined;

    fetchRecentMessages();
    const intervalId = setInterval(fetchRecentMessages, 30000);
    return () => clearInterval(intervalId);
  }, [fetchRecentMessages, user]);

  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>
          {t("chat.recent_messages", "Recent Messages")}
        </Typography>
        <List disablePadding sx={{ maxHeight: 260, overflowY: "auto" }}>
          {messages.length === 0 && (
            <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", py: 1.25 }}>
              <Stack sx={{ width: 34, height: 34, flexShrink: 0, borderRadius: 2, bgcolor: "action.hover", color: "text.secondary", alignItems: "center", justifyContent: "center" }}>
                <MessageSquare size={16} />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {t("chat.no_recent_messages", "No recent messages yet")}
              </Typography>
            </Stack>
          )}
          {messages.map((message) => (
            <ListItemButton
              component={Link}
              to={`/messages/${message.from_user_id._id}`}
              key={message._id}
              sx={{ borderRadius: 2, px: 1, py: 1.25 }}
            >
              <Badge
                color="primary"
                variant="dot"
                overlap="circular"
                invisible={message.seen}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              >
                <Avatar
                  src={message.from_user_id.profile_picture || undefined}
                  alt={message.from_user_id.full_name}
                  sx={{ width: 40, height: 40 }}
                >
                  {message.from_user_id.full_name?.charAt(0)}
                </Avatar>
              </Badge>
              <Stack sx={{ ml: 1.5, minWidth: 0, flex: 1 }}>
                <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                    {message.from_user_id.full_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                    {moment(message.createdAt).fromNow(true)}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {message.text || t("feed.media_placeholder", "Media")}
                </Typography>
              </Stack>
            </ListItemButton>
          ))}
        </List>
      </CardContent>
    </Card>
  );
};

export default RecentMessages;
