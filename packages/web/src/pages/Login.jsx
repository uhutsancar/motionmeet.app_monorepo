import LockOutlined from "@mui/icons-material/LockOutlined";
import MailOutlineRounded from "@mui/icons-material/MailOutlineRounded";
import VisibilityOffOutlined from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router";
import AuthShell from "~/components/AuthShell";
import { useAuthContext } from "../context/AuthProvider.jsx";

const Login = () => {
  const { login } = useAuthContext();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const updateField = (field) => (event) => {
    setFormData((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!formData.email.trim() || !formData.password) {
      setError("Enter your email address and password.");
      return;
    }
    setLoading(true);

    try {
      const result = await login(formData.email.trim(), formData.password);
      if (result.success) {
        navigate("/feed");
      } else {
        setError(result.message || "We could not sign you in. Please check your details.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Ready for your next move?"
      description="Sign in to continue your workouts, progress and conversations."
    >
      {error && <Alert severity="error" sx={{ mb: 2.5, borderRadius: 3 }}>{error}</Alert>}

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Stack spacing={2.25}>
          <TextField
            label="Email address"
            type="email"
            fullWidth
            required
            autoFocus
            autoComplete="email"
            value={formData.email}
            onChange={updateField("email")}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <MailOutlineRounded color="disabled" fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            label="Password"
            type={showPassword ? "text" : "password"}
            fullWidth
            required
            autoComplete="current-password"
            value={formData.password}
            onChange={updateField("password")}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined color="disabled" fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      edge="end"
                      onClick={() => setShowPassword((visible) => !visible)}
                    >
                      {showPassword ? <VisibilityOffOutlined /> : <VisibilityOutlined />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "flex-end", mt: -0.5 }}>
            <Link component={RouterLink} to="/forgot-password" underline="hover" variant="body2" sx={{ fontWeight: 800 }}>
              Forgot password?
            </Link>
          </Stack>
          <Button type="submit" variant="contained" size="large" fullWidth disabled={loading} sx={{ minHeight: 52 }}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </Stack>
      </Box>

      <Typography variant="body2" align="center" color="text.secondary" sx={{ mt: 3 }}>
        New to MotionMeet?{" "}
        <Link component={RouterLink} to="/signup" underline="hover" sx={{ fontWeight: 800 }}>
          Create an account
        </Link>
      </Typography>
    </AuthShell>
  );
};

export default Login;
