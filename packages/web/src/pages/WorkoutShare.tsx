import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Copy, Download, Share, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import toast from "react-hot-toast";
import {
  SHARE_CARD_SIZES,
  SHARE_CARD_TEMPLATES,
  buildShareCardSvg,
  buildShareCardText,
  workoutToShareCardData,
  type ShareCardTemplate,
  type Workout,
} from "@motionmeet/shared";
import { useAppSelector } from "~/app/hooks";

/** The card is drawn at story proportions and previewed at this width. */
const PREVIEW_WIDTH = 300;

/**
 * Renders the chosen card to a PNG in the browser.
 *
 * No server round trip: the SVG is already a complete, self-contained document
 * with no external references, so it can be drawn straight onto a canvas at the
 * card's real size. The one caveat is that a card with a photo behind it would
 * taint the canvas — those are rendered on the server instead.
 */
const cardToPngBlob = (svg: string): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const { width, height } = SHARE_CARD_SIZES.story;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas is unavailable"));
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Encoding failed"))), "image/png");
    };
    image.onerror = () => reject(new Error("The card could not be rasterised"));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });

/**
 * What to do with a finished workout, on the web.
 *
 * The same five layouts the app offers, drawn from the same shared renderer, so
 * a card downloaded here is the card someone's phone would have produced. The
 * hand-built gradient panel this page used to show was a different picture in a
 * different palette with a placeholder letter where the logo goes; there is one
 * share card now, and this is it.
 */
const WorkoutCompleteShare = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.user.value);

  const workout = (location.state as { workout?: Workout } | null)?.workout;
  const [template, setTemplate] = useState<ShareCardTemplate>("summary");
  const [busy, setBusy] = useState(false);

  const data = useMemo(
    () =>
      workout
        ? workoutToShareCardData(
            {
              name: workout.name,
              startTime: workout.startTime,
              durationMinutes: workout.durationMinutes ?? 0,
              volumeKg: workout.volumeKg ?? 0,
              totalSets:
                workout.totalSets ??
                workout.exercises?.reduce((sum, exercise) => sum + (exercise.sets?.length ?? 0), 0) ??
                0,
              exercises: workout.exercises ?? [],
            },
            user?.username || user?.full_name || "motionmeet",
          )
        : null,
    [user, workout],
  );

  const svg = useMemo(
    () => (data ? buildShareCardSvg(data, template, "story") : ""),
    [data, template],
  );

  if (!workout || !data) {
    return (
      <Box
        sx={{
          width: "100%",
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          p: 3,
          textAlign: "center",
        }}
      >
        <Stack spacing={2} sx={{ alignItems: "center" }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {t("workout_share.missing", "Paylaşılacak antrenman bulunamadı.")}
          </Typography>
          <Button variant="contained" onClick={() => navigate("/routines")} sx={{ textTransform: "none" }}>
            {t("menu.routines", "Rutinlere dön")}
          </Button>
        </Stack>
      </Box>
    );
  }

  const caption = buildShareCardText(data);

  const download = async () => {
    setBusy(true);
    try {
      const blob = await cardToPngBlob(svg);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `motionmeet-${template}.png`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("workout.share_failed", "Paylaşım tamamlanamadı."));
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    setBusy(true);
    try {
      const blob = await cardToPngBlob(svg);
      const file = new File([blob], `motionmeet-${template}.png`, { type: "image/png" });
      // Sharing the picture itself where the browser allows it; the caption is
      // the fallback everywhere else, and a desktop browser gets the download.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: caption });
      } else if (navigator.share) {
        await navigator.share({ title: "MotionMeet", text: caption });
      } else {
        await download();
      }
    } catch (error: unknown) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        toast.error(t("workout.share_failed", "Paylaşım tamamlanamadı."));
      }
    } finally {
      setBusy(false);
    }
  };

  const copyText = async () => {
    await navigator.clipboard.writeText(caption);
    toast.success(t("workout.share_text_copied", "Metin kopyalandı"));
  };

  const previewHeight = Math.round(
    (PREVIEW_WIDTH * SHARE_CARD_SIZES.story.height) / SHARE_CARD_SIZES.story.width,
  );

  return (
    <Box sx={{ width: "100%", minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", p: { xs: 2, lg: 3 } }}>
      <Box sx={{ width: "100%", maxWidth: 460, display: "flex", justifyContent: "flex-end" }}>
        <IconButton aria-label={t("common.close", "Kapat")} onClick={() => navigate("/feed")}>
          <X size={22} />
        </IconButton>
      </Box>

      <Stack spacing={2} sx={{ width: "100%", maxWidth: 460, alignItems: "center" }}>
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {t("workout.share_title", "Güzeldi!")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("workout.share_subtitle", "Antrenmanını paylaş")}
          </Typography>
        </Box>

        <Box
          sx={{
            width: PREVIEW_WIDTH,
            height: previewHeight,
            borderRadius: 4,
            overflow: "hidden",
            bgcolor: "#0D1424",
          }}
          // The card is a complete document produced by our own renderer from
          // our own data; nothing here comes from a member's input unescaped.
          dangerouslySetInnerHTML={{
            __html: svg.replace("<svg ", '<svg style="width:100%;height:100%;display:block" '),
          }}
        />

        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", justifyContent: "center" }}>
          {SHARE_CARD_TEMPLATES.map((option) => (
            <Button
              key={option}
              size="small"
              onClick={() => setTemplate(option)}
              variant={option === template ? "contained" : "text"}
              sx={{ minHeight: 32, textTransform: "capitalize" }}
            >
              {t(`workout.share_template_${option}`, option)}
            </Button>
          ))}
        </Stack>

        <Stack direction="row" spacing={1.5} sx={{ width: "100%", pt: 1 }}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<Share size={18} />}
            onClick={() => void share()}
            disabled={busy}
            sx={{ textTransform: "none" }}
          >
            {t("monthly_report.share", "Paylaş")}
          </Button>
          <IconButton aria-label={t("workout.share_download", "İndir")} onClick={() => void download()} disabled={busy}>
            <Download size={20} />
          </IconButton>
          <IconButton aria-label={t("workout.share_copy_text", "Metni kopyala")} onClick={() => void copyText()}>
            <Copy size={20} />
          </IconButton>
        </Stack>

        <Button fullWidth variant="text" onClick={() => navigate("/feed")} sx={{ textTransform: "none" }}>
          {t("common.done", "Bitti")}
        </Button>
      </Stack>
    </Box>
  );
};

export default WorkoutCompleteShare;
