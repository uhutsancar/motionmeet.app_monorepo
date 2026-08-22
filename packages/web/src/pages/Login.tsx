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
import { useState, type ChangeEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useNavigate } from "react-router";
import AuthShell from "~/components/AuthShell";
import { useAuthContext } from "../context/AuthProvider";

const Login = () => {
  const { t } = useTranslation();
  const { login } = useAuthContext();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const updateField = (field: "email" | "password") => (event: ChangeEvent<HTMLInputElement>) => {
    setFormData((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!formData.email.trim() || !formData.password) {
      setError(t("auth.error_credentials"));
      return;
    }
    setLoading(true);

    try {
      const result = await login(formData.email.trim(), formData.password);
      if (result.success) {
        navigate("/feed");
      } else {
        setError(result.message || t("auth.error_signin_failed"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow={t("auth.eyebrow_signin")}
      title={t("auth.title_signin")}
      description={t("auth.signin_description")}
    >
      {error && <Alert severity="error" sx={{ mb: 2.5, borderRadius: 3 }}>{error}</Alert>}

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Stack spacing={2.25}>
          <TextField
            label={t("auth.email")}
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
            label={t("auth.password")}
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
                      aria-label={showPassword ? t("auth.hide_password") : t("auth.show_password")}
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
              {t("auth.forgot_password")}
            </Link>
          </Stack>
          <Button type="submit" variant="contained" size="large" fullWidth disabled={loading} sx={{ minHeight: 52 }}>
            {loading ? t("auth.signing_in") : t("auth.sign_in")}
          </Button>
        </Stack>
      </Box>

      <Typography variant="body2" align="center" color="text.secondary" sx={{ mt: 3 }}>
        {t("auth.new_here")}{" "}
        <Link component={RouterLink} to="/signup" underline="hover" sx={{ fontWeight: 800 }}>
          {t("auth.create_an_account")}
        </Link>
      </Typography>
    </AuthShell>
  );
};

export default Login;
