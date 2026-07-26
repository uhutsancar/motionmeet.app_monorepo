import { useState } from "react";
import { Link as RouterLink } from "react-router";
import {
  Alert,
  Box,
  Button,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { API_ROUTES } from "@motionmeet/shared";
import AuthShell from "../components/AuthShell";
import api from "~/api/axios";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post(API_ROUTES.auth.forgotPassword, { email });
      setSubmitted(true);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "The reset request could not be sent. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset your password"
      subtitle="Enter the email address connected to your MotionMeet account."
    >
      {submitted ? (
        <Stack spacing={3}>
          <Alert severity="success">
            If an account exists for that address, a password reset link has
            been sent. The link expires in 30 minutes.
          </Alert>
          <Button component={RouterLink} to="/login" variant="contained">
            Return to sign in
          </Button>
        </Stack>
      ) : (
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2.5}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ minHeight: 52 }}
            >
              {loading ? "Sending…" : "Send reset link"}
            </Button>
          </Stack>
        </Box>
      )}
      <Typography variant="body2" align="center" color="text.secondary" sx={{ mt: 3 }}>
        Remembered your password?{" "}
        <Link component={RouterLink} to="/login" fontWeight={800}>
          Sign in
        </Link>
      </Typography>
    </AuthShell>
  );
};

export default ForgotPassword;
