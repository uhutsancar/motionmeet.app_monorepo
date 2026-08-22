import Box from "@mui/material/Box";
import PlaceRounded from "@mui/icons-material/PlaceRounded";
import type { StoryOverlay } from "@motionmeet/shared";
import { storyBaseFontSize, storyOverlayStyle } from "./storyTypography";

interface StoryOverlayViewProps {
  overlay: StoryOverlay;
  /** Width of the story frame; every size is derived from it. */
  frameWidth: number;
}

/**
 * Draws one caption or location sticker exactly as it was composed.
 *
 * The composer and the viewer share this component, and it is the browser twin
 * of the mobile renderer, so a story looks the same wherever it is opened.
 */
const StoryOverlayView = ({ overlay, frameWidth }: StoryOverlayViewProps) => {
  const fontSize = storyBaseFontSize(frameWidth) * overlay.scale;

  if (overlay.kind === "location") {
    return (
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: `${fontSize * 0.16}px`,
          px: `${fontSize * 0.42}px`,
          py: `${fontSize * 0.22}px`,
          borderRadius: 999,
          bgcolor: "#FFFFFF",
          color: "#101014",
          fontSize,
          fontWeight: 800,
          letterSpacing: "0.01em",
          textTransform: "uppercase",
          lineHeight: 1.1,
        }}
      >
        <PlaceRounded sx={{ fontSize: fontSize * 0.86 }} />
        {overlay.text}
      </Box>
    );
  }

  return (
    <Box component="p" style={storyOverlayStyle(overlay, frameWidth)}>
      {overlay.text}
    </Box>
  );
};

export default StoryOverlayView;
