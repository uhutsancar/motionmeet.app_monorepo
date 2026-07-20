import { useAuthContext } from "../context/AuthProvider";
import {
  Avatar,
  Box,
  Button,
  ButtonBase,
  Card,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { BadgeCheck, Dumbbell, Heart, Lock, MessageCircle, Send, Share2, Users } from "lucide-react";
import moment from "moment";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import api from "~/api/axios";

const PostCard = ({ post }) => {
  const { t, i18n } = useTranslation();
  const currentUser = useSelector((state) => state.user.value);
  const { getToken } = useAuthContext();
  const navigate = useNavigate();
  const [likes, setLikes] = useState(post?.likes_count || []);
  const [activeSlide, setActiveSlide] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [comments, setComments] = useState(post?.comments || []);
  const scrollRef = useRef(null);

  useEffect(() => {
    moment.locale(i18n.language.startsWith("tr") ? "tr" : "en");
  }, [i18n.language]);

  if (!post?.user) return null;

  const isLiked = Boolean(currentUser?._id && likes.includes(currentUser._id));
  const hasWorkout = post.post_type === "workout" && post.workout;
  const isVideo = post.post_type === "video";
  const imageUrls = post.image_urls || [];
  const carouselData = [];

  if (isVideo && imageUrls.length > 0) carouselData.push({ type: "video", url: imageUrls[0] });
  else imageUrls.forEach((url) => carouselData.push({ type: "image", url }));
  if (hasWorkout) carouselData.push({ type: "workout", data: post.workout });

  const handleLike = async () => {
    try {
      const { data } = await api.post(
        "/api/post/like",
        { postId: post._id },
        { headers: { Authorization: `Bearer ${await getToken()}` } },
      );

      if (data.success && currentUser?._id) {
        setLikes((currentLikes) =>
          currentLikes.includes(currentUser._id)
            ? currentLikes.filter((id) => id !== currentUser._id)
            : [...currentLikes, currentUser._id],
        );
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;

    setCommentLoading(true);
    try {
      const { data } = await api.post(
        "/api/post/comment/add",
        { postId: post._id, content: commentText },
        { headers: { Authorization: `Bearer ${await getToken()}` } },
      );
      if (data.success) {
        setComments(data.comments);
        setCommentText("");
        toast.success(t("feed.comment_posted", "Comment posted!"));
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCommentLoading(false);
    }
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const currentSlide = Math.round(scrollRef.current.scrollLeft / scrollRef.current.offsetWidth);
    if (currentSlide !== activeSlide) setActiveSlide(currentSlide);
  };

  const contentParts = post.content?.split(/(#\w+)/g) || [];
  const workoutStats = hasWorkout
    ? [
        { label: t("feed.duration", "Süre"), value: `${post.workout.durationMinutes || post.workout.duration || 0}m` },
        { label: t("feed.volume", "Hacim"), value: `${(post.workout.volumeKg || post.workout.volume || 0).toLocaleString()}kg` },
        { label: t("feed.prs", "Rekorlar"), value: "🥇 0" },
        { label: t("feed.bpm", "Ort. bpm"), value: "❤️ --" },
      ]
    : [];

  return (
    <Card
      variant="outlined"
      sx={{ width: "100%", maxWidth: 500, mx: "auto", borderRadius: 3, overflow: "hidden", transition: "box-shadow .2s", "&:hover": { boxShadow: 3 } }}
    >
      <Box sx={{ px: { xs: 2, sm: 2.5 }, pt: 2.5 }}>
        <ButtonBase onClick={() => navigate(`/profile/${post.user._id}`)} sx={{ borderRadius: 2, textAlign: "left" }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Avatar src={post.user.profile_picture || undefined} alt={post.user.full_name} sx={{ width: 48, height: 48, border: 1, borderColor: "divider" }}>
              {post.user.full_name?.charAt(0)}
            </Avatar>
            <Stack>
              <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  {post.user.full_name}
                </Typography>
                {post.user.is_verified && <BadgeCheck size={16} color="currentColor" />}
              </Stack>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Typography variant="caption" color="text.secondary">
                  @{post.user.username} · {moment(post.createdAt).fromNow()}
                </Typography>
                {post.visibility === "private" && (
                  <Chip icon={<Lock size={12} />} label={t("feed.only_you", "Sadece siz")} size="small" sx={{ height: 21, fontSize: 10 }} />
                )}
                {post.visibility === "followers" && (
                  <Chip icon={<Users size={12} />} label={t("feed.followers", "Takipçiler")} size="small" sx={{ height: 21, fontSize: 10 }} />
                )}
              </Stack>
            </Stack>
          </Stack>
        </ButtonBase>
      </Box>

      <Stack spacing={0.75} sx={{ px: { xs: 2, sm: 2.5 }, py: 2 }}>
        {hasWorkout && post.workout?.name && (
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            {post.workout.name}
          </Typography>
        )}
        {post.content && (
          <Typography component="div" variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-line", lineHeight: 1.65 }}>
            {contentParts.map((part, index) =>
              /^#\w+$/.test(part) ? (
                <Box component="span" key={`${part}-${index}`} sx={{ color: "primary.main", fontWeight: 700 }}>
                  {part}
                </Box>
              ) : (
                part
              ),
            )}
          </Typography>
        )}
      </Stack>

      {hasWorkout && (
        <Stack direction="row" spacing={1} useFlexGap sx={{ px: { xs: 2, sm: 2.5 }, pb: 2, flexWrap: "wrap", justifyContent: "space-between" }}>
          {workoutStats.map((stat) => (
            <Stack key={stat.label} sx={{ minWidth: 70 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {stat.label}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                {stat.value}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}

      {carouselData.length > 0 && (
        <Box sx={{ position: "relative", width: "100%", overflow: "hidden" }}>
          <Box
            ref={scrollRef}
            onScroll={handleScroll}
            sx={{ display: "flex", width: "100%", overflowX: "auto", scrollSnapType: "x mandatory", scrollBehavior: "smooth" }}
          >
            {carouselData.map((item, index) => (
              <Box
                key={`${item.type}-${item.url || index}`}
                sx={{ width: "100%", flexShrink: 0, scrollSnapAlign: "center", position: "relative", aspectRatio: { xs: "4 / 5", sm: "1 / 1" }, bgcolor: item.type === "workout" ? "background.default" : "common.black", borderTop: 1, borderBottom: 1, borderColor: "divider" }}
              >
                {item.type === "video" ? (
                  <Box component="video" src={item.url} controls sx={{ width: "100%", height: "100%", objectFit: "contain" }} />
                ) : item.type === "image" ? (
                  <Box component="img" src={item.url} alt={`Slide ${index + 1}`} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <Stack spacing={2.5} sx={{ height: "100%", px: 3, justifyContent: "center" }}>
                    {item.data.exercises?.slice(0, 4).map((exercise, exerciseIndex) => (
                      <Stack key={exercise._id || exercise.exerciseId?._id || exerciseIndex} direction="row" spacing={2} sx={{ alignItems: "center" }}>
                        <Avatar sx={{ width: 56, height: 56, bgcolor: "action.hover", color: "text.primary", border: 1, borderColor: "divider" }}>
                          <Dumbbell size={24} />
                        </Avatar>
                        <Typography variant="body2" sx={{ fontWeight: 700, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {exercise.sets?.length || 0} set {exercise.exerciseId?.name || t("routines.exercise", "Egzersiz")}
                        </Typography>
                      </Stack>
                    ))}
                    {item.data.exercises?.length > 4 && (
                      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                        {item.data.exercises.length - 4} {t("feed.more_exercises", "egzersiz daha")}
                      </Typography>
                    )}
                  </Stack>
                )}
              </Box>
            ))}
          </Box>

          {carouselData.length > 1 && (
            <Stack direction="row" spacing={0.75} sx={{ justifyContent: "center", position: "absolute", left: 0, right: 0, bottom: 16 }}>
              {carouselData.map((_, index) => (
                <Box key={index} sx={{ width: index === activeSlide ? 16 : 6, height: 6, borderRadius: 99, bgcolor: index === activeSlide ? "primary.main" : "rgba(255,255,255,.5)", transition: "width .2s" }} />
              ))}
            </Stack>
          )}
        </Box>
      )}

      <Stack direction="row" spacing={1} sx={{ px: { xs: 1, sm: 1.5 }, pt: 1.25, alignItems: "center" }}>
        <Button color={isLiked ? "error" : "inherit"} startIcon={<Heart size={25} fill={isLiked ? "currentColor" : "none"} />} onClick={handleLike}>
          {likes.length}
        </Button>
        <Button color="inherit" startIcon={<MessageCircle size={25} />} onClick={() => setShowComments((visible) => !visible)}>
          {comments.length}
        </Button>
        <IconButton aria-label={t("feed.share", "Share")} sx={{ ml: "auto" }}>
          <Share2 size={23} />
        </IconButton>
      </Stack>

      {likes.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", px: { xs: 2, sm: 2.5 }, pb: 0.5 }}>
          {t("feed.liked_by", "Liked by")} <Box component="span" sx={{ color: "text.primary", fontWeight: 800 }}>{likes.length}</Box> {t("feed.people", "people")}
        </Typography>
      )}

      <Collapse in={showComments}>
        <Stack spacing={2} sx={{ px: { xs: 2, sm: 2.5 }, pt: 1.5, pb: 2 }}>
          <Stack spacing={1.75} sx={{ maxHeight: 240, overflowY: "auto" }}>
            {comments.length > 0 ? (
              comments.map((comment, index) => (
                <Stack key={comment._id || `${comment.user?._id}-${comment.createdAt}-${index}`} direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
                  <Avatar src={comment.user?.profile_picture || undefined} alt={comment.user?.full_name} sx={{ width: 32, height: 32 }}>
                    {comment.user?.full_name?.charAt(0)}
                  </Avatar>
                  <Stack sx={{ minWidth: 0, flex: 1 }}>
                    <Paper variant="outlined" sx={{ display: "inline-block", alignSelf: "flex-start", minWidth: "60%", p: 1.25, borderRadius: 2, bgcolor: "action.hover" }}>
                      <Typography variant="caption" sx={{ fontWeight: 800 }}>
                        {comment.user?.full_name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {comment.content}
                      </Typography>
                    </Paper>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1 }}>
                      {moment(comment.createdAt).fromNow()}
                    </Typography>
                  </Stack>
                </Stack>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                {t("feed.no_comments_yet")}
              </Typography>
            )}
          </Stack>

          <Paper variant="outlined" sx={{ display: "flex", alignItems: "flex-end", gap: 1, p: 1, pl: 1.5, borderRadius: 3, bgcolor: "action.hover" }}>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              variant="standard"
              placeholder={t("feed.write_comment")}
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              slotProps={{ input: { disableUnderline: true } }}
            />
            <IconButton color="primary" onClick={handleAddComment} disabled={commentLoading || !commentText.trim()} aria-label={t("feed.post_comment", "Post comment")}>
              {commentLoading ? <CircularProgress size={18} /> : <Send size={18} />}
            </IconButton>
          </Paper>
        </Stack>
      </Collapse>
    </Card>
  );
};

export default PostCard;
