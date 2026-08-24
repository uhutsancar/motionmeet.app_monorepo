import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useParams } from "react-router";
import type { Post } from "@motionmeet/shared";
import PostCard from "../components/PostCard";
import { useAuthContext } from "../context/AuthProvider";
import { getPost, getPublicPost } from "../api/endpoints";

type LoadState = "loading" | "ready" | "unavailable";

/**
 * A single post, opened from a link.
 *
 * This is the other half of the share flow: the server renders a preview page
 * with Open Graph tags for the crawler that fetches the URL first, and this is
 * what a person sees when they follow it into the web app.
 *
 * Who is asking decides which endpoint answers. A signed-in member gets the
 * post under the normal feed rules, so a followers-only post opens for someone
 * the author has approved. A visitor with no account gets the strictly public
 * one. Neither path is allowed to guess: both 404s land on the same notice, so
 * nothing here reveals whether a post they cannot see exists at all.
 */
const PostPage = () => {
  const { postId } = useParams<{ postId: string }>();
  const { t } = useTranslation();
  const { getToken, user } = useAuthContext();
  const [post, setPost] = useState<Post | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    let active = true;
    if (!postId) {
      setState("unavailable");
      return () => {
        active = false;
      };
    }

    void (async () => {
      setState("loading");
      try {
        const token = await getToken().catch(() => null);
        const response = token ? await getPost(postId, token) : await getPublicPost(postId);
        if (!active) return;
        if (response.success && response.post) {
          setPost(response.post);
          setState("ready");
        } else {
          setState("unavailable");
        }
      } catch {
        // A 404 and a network failure look the same to the reader here, and
        // saying "this post is not available" is true of both.
        if (active) setState("unavailable");
      }
    })();

    return () => {
      active = false;
    };
  }, [getToken, postId]);

  /* The tab title is set from the post because the client is what renders it
     for a person; the crawler that needs real metadata is served the server's
     own preview page instead, and never reaches this component. */
  useEffect(() => {
    const author = post && typeof post.user === "object" ? post.user : null;
    const name = author?.full_name || author?.username;
    document.title = name ? `${name} · MotionMeet` : "MotionMeet";
    return () => {
      document.title = "MotionMeet";
    };
  }, [post]);

  if (state === "loading") {
    return (
      <Box sx={{ alignItems: "center", display: "flex", height: "60dvh", justifyContent: "center" }}>
        <CircularProgress size={30} />
      </Box>
    );
  }

  if (state === "unavailable" || !post) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Stack spacing={1.5} sx={{ alignItems: "center", textAlign: "center" }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {t("post.unavailable_title", "Bu gönderi artık mevcut değil")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(
              "post.unavailable_body",
              "Bağlantı kaldırılmış olabilir ya da gönderi herkese açık değil.",
            )}
          </Typography>
          <Button
            component={RouterLink}
            to={user ? "/feed" : "/"}
            variant="contained"
            sx={{ borderRadius: 2, mt: 2, textTransform: "none" }}
          >
            {user ? t("nav.feed", "Akışa dön") : t("post.join", "MotionMeet'e katıl")}
          </Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 2, md: 4 } }}>
      <PostCard post={post} />
      {!user && (
        <Stack spacing={1} sx={{ alignItems: "center", mt: 3 }}>
          <Typography variant="body2" color="text.secondary">
            {t("post.join_hint", "MotionMeet'te sporcularla buluş, antrenmanlarını paylaş.")}
          </Typography>
          <Button
            component={RouterLink}
            to="/signup"
            variant="contained"
            sx={{ borderRadius: 2, textTransform: "none" }}
          >
            {t("post.join", "MotionMeet'e katıl")}
          </Button>
        </Stack>
      )}
    </Container>
  );
};

export default PostPage;
