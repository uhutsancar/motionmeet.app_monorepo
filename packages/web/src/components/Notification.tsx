import toast from "react-hot-toast";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Box, Stack, Typography, Button, Avatar, Paper, useTheme } from "@mui/material";
import type { Toast } from "react-hot-toast";
import type { Message } from "@motionmeet/shared";

interface NotificationProps { toastInstance: Toast; message: Message }

const Notification = ({ toastInstance, message }: NotificationProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const theme = useTheme();
  if (typeof message.from_user_id === "string") return null;
  const sender = message.from_user_id;

  return (
    <Paper
      elevation={4}
      sx={{
        maxWidth: 400,
        width: "100%",
        bgcolor: "background.paper",
        borderRadius: 4,
        display: "flex",
        overflow: "hidden",
        border: `1px solid ${theme.palette.divider}`,
        transition: "transform 0.3s ease",
        "&:hover": { transform: "scale(1.02)" },
        pointerEvents: "auto",
      }}
    >
      <Box sx={{ flex: 1, p: 2 }}>
        <Stack direction="row" sx={{ alignItems: "center" }} spacing={2}>
          <Box sx={{ position: "relative" }}>
            <Avatar
              src={sender.profile_picture || undefined}
              alt=""
              sx={{
                width: 48,
                height: 48,
                border: `2px solid ${theme.palette.primary.main}`,
              }}
            />
            <Box
              sx={{
                position: "absolute",
                bottom: -2,
                right: -2,
                width: 14,
                height: 14,
                bgcolor: "#22c55e",
                borderRadius: "50%",
                border: `2px solid ${theme.palette.background.paper}`,
              }}
            />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap sx={{ fontWeight: "bold" }}>
              {sender.full_name}
            </Typography>
            <Typography variant="body2" noWrap sx={{ color: "text.secondary", fontStyle: "italic" }}>
              "{message.text.slice(0, 50)}{message.text.length > 50 ? "..." : ""}"
            </Typography>
          </Box>
        </Stack>
      </Box>
      <Box sx={{ display: "flex", borderLeft: `1px solid ${theme.palette.divider}`, bgcolor: "action.hover" }}>
        <Button
          onClick={() => {
            navigate(`/messages/${sender._id}`);
            toast.dismiss(toastInstance.id);
          }}
          sx={{
            px: 3,
            color: "primary.main",
            fontWeight: 700,
            fontSize: "0.75rem",
            letterSpacing: 1,
            borderRadius: 0,
            height: "100%",
            "&:hover": {
              bgcolor: "primary.main",
              color: "primary.contrastText",
            },
          }}
        >
          {t("messages.reply", "Reply")}
        </Button>
      </Box>
    </Paper>
  );
};

export default Notification;
