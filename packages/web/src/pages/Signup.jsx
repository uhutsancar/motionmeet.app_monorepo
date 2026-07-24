import AlternateEmailRounded from "@mui/icons-material/AlternateEmailRounded";
import LockOutlined from "@mui/icons-material/LockOutlined";
import MailOutlineRounded from "@mui/icons-material/MailOutlineRounded";
import PersonOutlineRounded from "@mui/icons-material/PersonOutlineRounded";
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
import { Link as RouterLink, useNavigate } from "react-router-dom";
import AuthShell from "~/components/AuthShell";
import { useAuthContext } from "../context/AuthProvider.jsx";

const Signup = () => {
  const { register } = useAuthContext();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: "", password: "", username: "", full_name: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const updateField = (field) => (event) => {
    setFormData((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await register({
        ...formData,
        email: formData.email.trim(),
        username: formData.username.trim(),
        full_name: formData.full_name.trim(),
      });
      if (result.success) {
        navigate("/feed");
      } else {
        setError(result.message || "We could not create your account. Please review your details.");
      }
    } finally {
      setLoading(false);
    }
  };

  const inputIcon = (Icon) => (
    <InputAdornment position="start">
      <Icon color="disabled" fontSize="small" />
    </InputAdornment>
  );

  return (
    <AuthShell
      eyebrow="Create your account"
      title="Build momentum that lasts."
      description="Join MotionMeet and bring your training, progress and people into one place."
    >
      {error && <Alert severity="error" sx={{ mb: 2.5, borderRadius: 3 }}>{error}</Alert>}

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Stack spacing={2}>
          <TextField
            label="Full name"
            fullWidth
            required
            autoFocus
            autoComplete="name"
            value={formData.full_name}
            onChange={updateField("full_name")}
            slotProps={{ input: { startAdornment: inputIcon(PersonOutlineRounded) } }}
          />
          <TextField
            label="Username"
            fullWidth
            required
            autoComplete="username"
            value={formData.username}
            onChange={updateField("username")}
            slotProps={{ input: { startAdornment: inputIcon(AlternateEmailRounded) } }}
          />
          <TextField
            label="Email address"
            type="email"
            fullWidth
            required
            autoComplete="email"
            value={formData.email}
            onChange={updateField("email")}
            slotProps={{ input: { startAdornment: inputIcon(MailOutlineRounded) } }}
          />
          <TextField
            label="Password"
            type={showPassword ? "text" : "password"}
            fullWidth
            required
            autoComplete="new-password"
            value={formData.password}
            onChange={updateField("password")}
            helperText="Use at least 8 characters."
            slotProps={{
              htmlInput: { minLength: 8 },
              input: {
                startAdornment: inputIcon(LockOutlined),
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
          <Button type="submit" variant="contained" size="large" fullWidth disabled={loading} sx={{ minHeight: 52, mt: 0.5 }}>
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </Stack>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", mt: 2.25, lineHeight: 1.6 }}>
        By continuing, you agree to our{" "}
        <Link href="https://motionmeet.app/terms" underline="hover">Terms</Link> and{" "}
        <Link href="https://motionmeet.app/privacy" underline="hover">Privacy Policy</Link>.
      </Typography>
      <Typography variant="body2" align="center" color="text.secondary" sx={{ mt: 2.5 }}>
        Already have an account?{" "}
        <Link component={RouterLink} to="/login" underline="hover" sx={{ fontWeight: 800 }}>
          Sign in
        </Link>
      </Typography>
    </AuthShell>
  );
};

export default Signup;
