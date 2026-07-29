import { useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router";
import {
  Alert,
  Box,
  Button,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { API_ROUTES, hasValidPasswordByteLength } from "@motionmeet/shared";
import AuthShell from "../components/AuthShell";
import api from "~/api/axios";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    if (!hasValidPasswordByteLength(password)) {
      setError("Password must be between 10 and 72 UTF-8 bytes.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.post(API_ROUTES.auth.resetPassword, { token, password });
      setSuccess(true);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "The reset link is invalid or expired."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Choose a new password"
      description="Use 10–72 UTF-8 bytes. All existing sessions will be signed out."
    >
      {!token ? (
        <Alert severity="error">This reset link is incomplete.</Alert>
      ) : success ? (
        <Stack spacing={3}>
          <Alert severity="success">
            Your password has been updated. Sign in again on your devices.
          </Alert>
          <Button component={RouterLink} to="/login" variant="contained">
            Sign in
          </Button>
        </Stack>
      ) : (
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2.5}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="New password"
              type="password"
              autoComplete="new-password"
              required
              helperText="Use at least 10 characters."
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <TextField
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              required
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ minHeight: 52 }}
            >
              {loading ? "Updating…" : "Update password"}
            </Button>
          </Stack>
        </Box>
      )}
      <Typography variant="body2" align="center" color="text.secondary" sx={{ mt: 3 }}>
        <Link component={RouterLink} to="/login" fontWeight={800}>
          Return to sign in
        </Link>
      </Typography>
    </AuthShell>
  );
};

export default ResetPassword;
