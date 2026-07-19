import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

const Loading = ({ height = "100vh" }) => {
  return (
    <Box
      role="status"
      aria-label="Loading"
      sx={{
        alignItems: "center",
        display: "flex",
        height,
        justifyContent: "center",
        width: "100%",
      }}
    >
      <CircularProgress size={40} thickness={4} />
    </Box>
  );
};

export default Loading;
