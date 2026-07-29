import {
  Avatar,
  Badge,
  Card,
  CardContent,
  List,
  ListItemButton,
  Stack,
  Typography,
} from "@mui/material";
import { MessageSquare } from "lucide-react";
import moment from "moment";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import api from "~/api/axios";
import { useAuthContext } from "../context/AuthProvider";
import { useSocket } from "../hooks/useSocket";
import { API_ROUTES } from "@motionmeet/shared";

const RecentMessages = () => {
  const { t } = useTranslation();
  const { user, getToken } = useAuthContext();
  const { socket } = useSocket();
  const [conversations, setConversations] = useState([]);

  const fetchConversations = useCallback(async () => {
    try {
      const token = await getToken();
      const { data } = await api.get(API_ROUTES.message.conversations, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setConversations(data.conversations.slice(0, 20));
      else toast.error(data.message);
    } catch (error) {
      toast.error(error.message);
    }
  }, [getToken]);

  useEffect(() => {
    if (user) void fetchConversations();
  }, [fetchConversations, user]);

  useEffect(() => {
    if (!socket) return undefined;
    const upsertConversation = (message, incoming) => {
      const partnerId = incoming
        ? message.from_user_id?._id || message.from_user_id
        : message.to_user_id?._id || message.to_user_id;
      if (!partnerId) return;
      setConversations((current) => {
        const existing = current.find((item) => item.partner?._id === partnerId);
        const partner = existing?.partner || (
          incoming && typeof message.from_user_id === "object"
            ? message.from_user_id
            : null
        );
        if (!partner) return current;
        const next = {
          ...(existing || {}),
          conversationId: existing?.conversationId || `pending:${partnerId}`,
          partner,
          lastMessage: message,
          unreadCount: incoming
            ? Number(existing?.unreadCount || 0) + 1
            : Number(existing?.unreadCount || 0),
        };
        return [
          next,
          ...current.filter((item) => item.partner?._id !== partnerId),
        ].slice(0, 20);
      });
    };
    const onReceived = (message) => upsertConversation(message, true);
    const onSent = (message) => upsertConversation(message, false);
    const onDeleted = () => void fetchConversations();
    socket.on("message_received", onReceived);
    socket.on("message_sent", onSent);
    socket.on("message_deleted", onDeleted);
    return () => {
      socket.off("message_received", onReceived);
      socket.off("message_sent", onSent);
      socket.off("message_deleted", onDeleted);
    };
  }, [fetchConversations, socket]);

  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>
          {t("chat.recent_messages", "Recent Messages")}
        </Typography>
        <List disablePadding sx={{ maxHeight: 260, overflowY: "auto" }}>
          {conversations.length === 0 && (
            <Stack
              direction="row"
              spacing={1.25}
              sx={{ alignItems: "center", py: 1.25 }}
            >
              <Stack
                sx={{
                  width: 34,
                  height: 34,
                  flexShrink: 0,
                  borderRadius: 2,
                  bgcolor: "action.hover",
                  color: "text.secondary",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MessageSquare size={16} />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {t("chat.no_recent_messages", "No recent messages yet")}
              </Typography>
            </Stack>
          )}
          {conversations.map((conversation) => {
            const { partner, lastMessage, unreadCount } = conversation;
            return (
              <ListItemButton
                component={Link}
                to={`/messages/${partner._id}`}
                key={conversation.conversationId}
                sx={{ borderRadius: 2, px: 1, py: 1.25 }}
              >
                <Badge
                  color="primary"
                  variant="dot"
                  overlap="circular"
                  invisible={!unreadCount}
                  anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                >
                  <Avatar
                    src={partner.profile_picture || undefined}
                    alt={partner.full_name}
                    sx={{ width: 40, height: 40 }}
                  >
                    {partner.full_name?.charAt(0)}
                  </Avatar>
                </Badge>
                <Stack sx={{ ml: 1.5, minWidth: 0, flex: 1 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ justifyContent: "space-between", alignItems: "center" }}
                  >
                    <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                      {partner.full_name}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ flexShrink: 0 }}
                    >
                      {moment(lastMessage.createdAt).fromNow(true)}
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {lastMessage.text ||
                      t("feed.media_placeholder", "Media")}
                  </Typography>
                </Stack>
              </ListItemButton>
            );
          })}
        </List>
      </CardContent>
    </Card>
  );
};

export default RecentMessages;
