import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Check, Loader2 } from "lucide-react";
import {
  Alert,
  Box,
  Button,
  Container,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { API_ROUTES } from "@motionmeet/shared";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import PublicLayout from "./PublicLayout";
import api from "~/api/axios.js";
import { useAuthContext } from "../context/AuthProvider";
import { fetchUser } from "../features/user/userSlice";

const planFeatureRows = (plan, t) => {
  const features = plan.features || {};
  const workoutLimit =
    features.max_workouts_per_month === -1
      ? t("pricing_page.unlimited_workouts", "Unlimited workouts")
      : t("pricing_page.workout_limit", {
          count: features.max_workouts_per_month ?? 0,
          defaultValue: "{{count}} workouts per month",
        });
  const routineLimit =
    features.max_routines === -1
      ? t("pricing_page.unlimited_routines", "Unlimited routines")
      : t("pricing_page.routine_limit", {
          count: features.max_routines ?? 0,
          defaultValue: "{{count}} routines",
        });

  return [
    workoutLimit,
    routineLimit,
    features.can_message_anyone
      ? t("pricing_page.message_anyone", "Message any member")
      : t("pricing_page.connections_only", "Message connections"),
    features.premium_content_access
      ? t("pricing_page.premium_analytics", "Premium analytics")
      : t("pricing_page.standard_analytics", "Standard analytics"),
    features.ad_free
      ? t("pricing_page.ad_free", "Ad-free experience")
      : t("pricing_page.core_experience", "Core MotionMeet experience"),
    features.priority_support
      ? t("pricing_page.priority_support", "Priority support")
      : t("pricing_page.standard_support", "Standard support"),
  ];
};

const Pricing = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { getToken } = useAuthContext();
  const currentUser = useSelector((state) => state.user.value);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [updatingPlan, setUpdatingPlan] = useState(null);

  useEffect(() => {
    let active = true;
    api
      .get(API_ROUTES.plan.base)
      .then(({ data }) => {
        if (active && data.success) setPlans(data.plans || []);
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const currencyFormatter = useMemo(
    () => (currency) =>
      new Intl.NumberFormat(i18n.resolvedLanguage || "en", {
        style: "currency",
        currency: currency || "TRY",
        maximumFractionDigits: 2,
      }),
    [i18n.resolvedLanguage]
  );

  const handleSelectPlan = async (plan) => {
    if (!currentUser) {
      navigate("/login");
      return;
    }
    if (plan.price > 0 || plan.name !== "Free") return;

    setUpdatingPlan(plan._id);
    try {
      const token = await getToken();
      const { data } = await api.post(
        API_ROUTES.plan.update,
        { planId: plan._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!data.success) throw new Error(data.message);
      await dispatch(fetchUser(token));
      toast.success(t("pricing_page.upgrade_success", "Plan updated."));
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          t("pricing_page.upgrade_err", "Plan could not be updated.")
      );
    } finally {
      setUpdatingPlan(null);
    }
  };

  return (
    <PublicLayout>
      <Box
        sx={{
          py: { xs: 9, sm: 12 },
          px: 2,
          background:
            "radial-gradient(circle at 50% 0%, rgba(101,88,245,.15), transparent 48%)",
        }}
      >
        <Container maxWidth="lg">
          <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center", mb: 7 }}>
            <Typography variant="overline" color="primary" fontWeight={800}>
              {t("pricing_page.hero_badge", "Simple, transparent pricing")}
            </Typography>
            <Typography
              variant="h2"
              sx={{ fontWeight: 900, fontSize: { xs: "2.35rem", sm: "3.5rem" } }}
            >
              {t("pricing_page.hero_title", "Choose the plan that fits you")}
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 620 }}>
              {t(
                "pricing_page.production_subtitle",
                "Only plans currently available in MotionMeet are shown here."
              )}
            </Typography>
          </Stack>

          {loadError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {t("pricing_page.load_error", "Plans could not be loaded. Please try again later.")}
            </Alert>
          )}

          {loading ? (
            <Stack sx={{ alignItems: "center" }} py={8}>
              <Loader2 size={32} className="spin" />
            </Stack>
          ) : (
            <Grid container spacing={3} justifyContent="center">
              {plans.map((plan) => {
                const isCurrent = currentUser?.plan?._id === plan._id;
                const isPaid = plan.price > 0 || plan.name !== "Free";
                return (
                  <Grid size={{ xs: 12, md: 4 }} key={plan._id}>
                    <Paper
                      variant="outlined"
                      sx={{
                        height: "100%",
                        p: { xs: 3, sm: 4 },
                        borderRadius: 5,
                        display: "flex",
                        flexDirection: "column",
                        borderColor: isCurrent ? "primary.main" : "divider",
                      }}
                    >
                      <Typography variant="h5" fontWeight={900}>
                        {plan.name}
                      </Typography>
                      <Typography variant="h3" fontWeight={900} color="primary" my={2}>
                        {plan.price === 0
                          ? t("pricing_page.free_name", "Free")
                          : currencyFormatter(plan.currency).format(plan.price)}
                      </Typography>
                      <Stack spacing={1.5} mb={4} flex={1}>
                        {planFeatureRows(plan, t).map((feature) => (
                          <Stack key={feature} direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
                            <Check size={18} color="#22c55e" aria-hidden="true" />
                            <Typography variant="body2" color="text.secondary">
                              {feature}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                      <Button
                        fullWidth
                        variant={isCurrent ? "outlined" : "contained"}
                        disabled={isCurrent || isPaid || updatingPlan === plan._id}
                        onClick={() => handleSelectPlan(plan)}
                        sx={{ minHeight: 48, borderRadius: 3, fontWeight: 800 }}
                      >
                        {updatingPlan === plan._id
                          ? t("common.loading", "Loading…")
                          : isCurrent
                            ? t("pricing_page.current_plan", "Current plan")
                            : isPaid
                              ? t("pricing_page.checkout_soon", "Checkout coming soon")
                              : t("pricing_page.select_plan", "Select plan")}
                      </Button>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </Container>
      </Box>
    </PublicLayout>
  );
};

export default Pricing;
