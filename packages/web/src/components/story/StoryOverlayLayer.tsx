import Box from "@mui/material/Box";
import type { StoryOverlay } from "@motionmeet/shared";
import StoryOverlayView from "./StoryOverlayView";

interface StoryOverlayLayerProps {
  overlays: StoryOverlay[];
  frameWidth: number;
}

/**
 * Places finished overlays on a story exactly where their author left them.
 *
 * `x`/`y` are fractions of the frame, so the anchor is a percentage offset and
 * the caption is pulled back by half its own size with a transform. No measuring
 * is needed: CSS does what the mobile renderer has to do by hand.
 */
const StoryOverlayLayer = ({ overlays, frameWidth }: StoryOverlayLayerProps) => (
  <>
    {overlays.map((overlay) => (
      <Box
        key={overlay.id}
        sx={{
          position: "absolute",
          left: `${overlay.x * 100}%`,
          top: `${overlay.y * 100}%`,
          maxWidth: "88%",
          transform: `translate(-50%, -50%) rotate(${overlay.rotation}deg)`,
          pointerEvents: "none",
        }}
      >
        <StoryOverlayView overlay={overlay} frameWidth={frameWidth} />
      </Box>
    ))}
  </>
);

export default StoryOverlayLayer;
