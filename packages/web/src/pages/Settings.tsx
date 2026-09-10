import { useAuthContext } from "../context/AuthProvider";
import api from "../api/axios.js";
import { API_ROUTES, type ApiFailure, type PrivacySettings } from "@motionmeet/shared";
import axios from "axios";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  Typography,
} from "@mui/material";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Globe,
  HelpCircle,
  Lock,
  LogOut,
  MapPin,
  Monitor,
  Moon,
  Ruler,
  Sun,
  User,
} from "lucide-react";
import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
import { useAppTheme } from "~/context/appThemeContext";
import { PageHeader, PageShell } from "~/components/AppPage";
import { changeLanguage, type SupportedLanguage } from "~/i18n";

interface NotificationPreferences {
  newMessage: boolean;
}

interface PrivacyResponse {
  privacy: PrivacySettings;
}

const readPreferences = (key: string): Partial<NotificationPreferences> => {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
};

interface SectionProps { icon: LucideIcon; title: ReactNode; children?: ReactNode }
interface ToggleRowProps { label: string; subtitle?: string; value: boolean; onChange: (event: ChangeEvent<HTMLInputElement>) => void }
interface LinkRowProps { label: string; subtitle?: string; onClick: () => void | Promise<void>; danger?: boolean; external?: boolean }
interface FaqItemProps { question: string; answer: string }

const Section = ({ icon: Icon, title, children = null }: SectionProps) => (
  <Stack component="section" spacing={1.5} sx={{ mb: 2.5, breakInside: "avoid" }}>
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Icon size={20} color="currentColor" />
      <Typography variant="h6" sx={{ fontWeight: 800 }}>{title}</Typography>
    </Stack>
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Stack divider={<Divider flexItem />}>{children}</Stack>
    </Paper>
  </Stack>
);

const ToggleRow = ({ label, subtitle = "", value, onChange }: ToggleRowProps) => (
  <Stack direction="row" spacing={2} sx={{ px: 2, py: 1.5, alignItems: "center", justifyContent: "space-between" }}>
    <Stack sx={{ minWidth: 0 }}>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>{label}</Typography>
      {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
    </Stack>
    <Switch checked={value} onChange={onChange} slotProps={{ input: { "aria-label": label } }} />
  </Stack>
);

const LinkRow = ({ label, subtitle = "", onClick, danger = false, external = false }: LinkRowProps) => (
  <ListItemButton onClick={onClick} sx={{ px: 2, py: 1.25, color: danger ? "error.main" : "text.primary" }}>
    <ListItemText
      primary={label}
      secondary={subtitle}
      slotProps={{ primary: { variant: "body2", sx: { fontWeight: 700 } }, secondary: { variant: "caption" } }}
    />
    {external ? <ExternalLink size={17} /> : <ChevronRight size={17} />}
  </ListItemButton>
);

const FaqItem = ({ question, answer }: FaqItemProps) => (
  <Accordion disableGutters elevation={0} square sx={{ "&::before": { display: "none" } }}>
    <AccordionSummary expandIcon={<ChevronDown size={17} />}>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>{question}</Typography>
    </AccordionSummary>
    <AccordionDetails sx={{ pt: 0 }}>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>{answer}</Typography>
    </AccordionDetails>
  </Accordion>
);

const Settings = () => {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useAppTheme();
  const { signOut, user, getToken } = useAuthContext();
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [accountRequestPending, setAccountRequestPending] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>({
    newMessage: true,
    ...readPreferences("@mm_notif_prefs"),
  });
  const [privacyPrefs, setPrivacyPrefs] = useState<PrivacySettings>({
    publicProfile: true,
    showWorkoutsOnFeed: true,
    allowFollowers: true,
    showInSearch: true,
    allowMessages: true,
  });
  const isTr = i18n.language.startsWith("tr");

  // Non-English catalogues are fetched on demand, so switching is async.
  const selectLanguage = (language: SupportedLanguage) => {
    void changeLanguage(language);
  };

  const toggleNotificationPreference = (key: keyof NotificationPreferences) => {
    setNotifPrefs((current) => {
      const updated = { ...current, [key]: !current[key] };
      localStorage.setItem("@mm_notif_prefs", JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    let active = true;
    const loadPrivacy = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const { data } = await api.get<PrivacyResponse>(API_ROUTES.user.privacy, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (active && data?.privacy) setPrivacyPrefs(data.privacy);
      } catch (error: unknown) {
        console.error("Privacy settings could not be loaded:", error instanceof Error ? error.message : error);
      }
    };
    loadPrivacy();
    return () => {
      active = false;
    };
  }, [getToken]);

  const togglePrivacy = async (key: keyof PrivacySettings) => {
    const previous = privacyPrefs;
    const updated = { ...privacyPrefs, [key]: !privacyPrefs[key] };
    setPrivacyPrefs(updated);
    try {
      const token = await getToken();
      if (!token) throw new Error("Your session has expired");
      const { data } = await api.patch<PrivacyResponse>(
        API_ROUTES.user.privacy,
        { [key]: updated[key] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data?.privacy) setPrivacyPrefs(data.privacy);
    } catch (error: unknown) {
      setPrivacyPrefs(previous);
      const failure = axios.isAxiosError<ApiFailure>(error) ? error.response?.data : undefined;
      toast.error(failure?.message || "Privacy setting could not be saved.");
    }
  };

  const [billingPending, setBillingPending] = useState(false);

  /**
   * Opens Paddle's own hosted billing page - MotionMeet never builds a
   * cancel/update-card UI itself. Silently no-ops (toast only) when the
   * user has never had a Paddle customer id assigned, since the backend
   * returns 404 for that rather than an error worth alarming over.
   */
  const manageBilling = async () => {
    try {
      setBillingPending(true);
      const token = await getToken();
      if (!token) throw new Error("Your session has expired");
      const { data } = await api.post<{ success: boolean; url?: string; message?: string }>(
        API_ROUTES.payments.portalSession,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!data.success || !data.url) throw new Error(data.message || "No billing account on file yet.");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (error: unknown) {
      const failure = axios.isAxiosError<ApiFailure>(error) ? error.response?.data : undefined;
      toast.error(failure?.message || (error instanceof Error ? error.message : "Billing portal is unavailable."));
    } finally {
      setBillingPending(false);
    }
  };

  const exportData = async () => {
    try {
      setAccountRequestPending(true);
      const token = await getToken();
      if (!token) throw new Error("Your session has expired");
      const response = await api.get<Blob>(API_ROUTES.user.export, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `motionmeet-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      const failure = axios.isAxiosError<ApiFailure>(error) ? error.response?.data : undefined;
      toast.error(failure?.message || "Data export failed.");
    } finally {
      setAccountRequestPending(false);
    }
  };

  const deleteAccount = async () => {
    try {
      setAccountRequestPending(true);
      const token = await getToken();
      if (!token) throw new Error("Your session has expired");
      await api.delete(API_ROUTES.user.account, {
        headers: { Authorization: `Bearer ${token}` },
        data: { password: deletePassword },
      });
      setDeleteDialogOpen(false);
      setDeletePassword("");
      await signOut();
    } catch (error: unknown) {
      const failure = axios.isAxiosError<ApiFailure>(error) ? error.response?.data : undefined;
      toast.error(failure?.message || "Account could not be deleted.");
    } finally {
      setAccountRequestPending(false);
    }
  };

  const faqs = [
    { question: t("support.faq1_q", "Antrenman verilerim nerede saklanıyor?"), answer: t("support.faq1_a", "Tüm verileriniz güvenli bulut sunucularımızda şifrelenmiş olarak saklanır.") },
    { question: t("support.faq2_q", "Şifremi nasıl sıfırlarım?"), answer: t("support.faq2_a", "Şifre sıfırlama desteği için support@motionmeet.app adresinden bize ulaşabilirsiniz.") },
    { question: t("support.faq3_q", "Verilerimi dışa aktarabilir miyim?"), answer: t("support.faq3_a", "Evet. Ayarlar içindeki Gizlilik ve Veri bölümünden verilerinizi dışa aktarabilirsiniz.") },
    { question: t("support.faq4_q", "Uygulama hangi platformlarda çalışıyor?"), answer: t("support.faq4_a", "MotionMeet iOS, Android ve Web üzerinde kullanılabilir.") },
    { question: t("support.faq5_q", "Bildirimler gelmiyor, ne yapmalıyım?"), answer: t("support.faq5_a", "Ayarlar bölümünden bildirimlerin açık olduğunu kontrol edin.") },
  ];

  return (
    <PageShell maxWidth={1120}>
        <PageHeader
          icon={Monitor}
          eyebrow="PREFERENCES"
          title={t("settings.title", "Settings")}
          description="Manage your account, privacy and app experience."
        />

        <Box sx={{ columnCount: { xs: 1, lg: 2 }, columnGap: 2.5 }}>

        <Section icon={User} title={t("settings.account", "Hesap")}>
          <ListItemButton onClick={() => navigate("/profile")} sx={{ px: 2, py: 1.5 }}>
            <ListItemAvatar>
              <Avatar src={user?.profile_picture || undefined} alt={user?.full_name || user?.username}>
                {user?.full_name?.charAt(0) || <User size={21} />}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={user?.full_name || user?.username || "—"}
              secondary={user?.email || ""}
              slotProps={{ primary: { sx: { fontWeight: 800 } }, secondary: { variant: "caption" } }}
            />
            <ChevronRight size={17} />
          </ListItemButton>
        </Section>

        <Section icon={Monitor} title={t("settings.appearance", "Görünüm")}>
          <Stack direction="row" spacing={2} sx={{ p: 2, alignItems: "center", justifyContent: "space-between" }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <Avatar variant="rounded" sx={{ bgcolor: "action.hover", color: "text.primary" }}>
                {theme === "dark" ? <Moon size={20} /> : <Sun size={20} />}
              </Avatar>
              <Stack>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{t("settings.theme", "Tema")}</Typography>
                <Typography variant="caption" color="text.secondary">{theme === "dark" ? t("settings.dark", "Koyu") : t("settings.light", "Açık")}</Typography>
              </Stack>
            </Stack>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={theme}
              onChange={(_, value) => value && value !== theme && toggleTheme()}
            >
              <ToggleButton value="light">{t("settings.light", "Açık")}</ToggleButton>
              <ToggleButton value="dark">{t("settings.dark", "Koyu")}</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Stack direction="row" spacing={2} sx={{ p: 2, alignItems: "center", justifyContent: "space-between" }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <Avatar variant="rounded" sx={{ bgcolor: "action.hover", color: "text.primary" }}><Globe size={20} /></Avatar>
              <Stack>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{t("settings.language", "Dil")}</Typography>
                <Typography variant="caption" color="text.secondary">{isTr ? t("settings.turkish", "Türkçe") : t("settings.english", "İngilizce")}</Typography>
              </Stack>
            </Stack>
            <ToggleButtonGroup exclusive size="small" value={isTr ? "tr" : "en"} onChange={(_, value: SupportedLanguage | null) => value && selectLanguage(value)}>
              <ToggleButton value="en">EN</ToggleButton>
              <ToggleButton value="tr">TR</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Section>

        <Section icon={Bell} title={t("settings.notifications", "Bildirimler")}>
          <ToggleRow
            label={t("notifications.new_message", "Yeni Mesaj")}
            subtitle={t("notifications.in_app_message_sub", "Yeni mesajlar için uygulama içi bildirim göster")}
            value={notifPrefs.newMessage}
            onChange={() => toggleNotificationPreference("newMessage")}
          />
          <LinkRow
            label={t("activity.title", "Notifications")}
            subtitle={t("activity.settings_hint", "Follow requests, likes and comments")}
            onClick={() => navigate("/activity")}
          />
          <LinkRow
            label={t("connections.title", "Connections")}
            subtitle={t("connections.settings_hint", "Follow requests, followers and following")}
            onClick={() => navigate("/connections")}
          />
        </Section>

        <Section icon={MapPin} title={t("location.settings_title", "Location")}>
          <LinkRow
            label={t("location.profile_section", "Profile location")}
            subtitle={t("location.settings_row_hint", "Where you are shown, and who can see it")}
            onClick={() => navigate("/settings/location")}
          />
          <LinkRow
            label={t("nearby.title", "Nearby")}
            subtitle={t("nearby.settings_hint", "Find athletes training close to you")}
            onClick={() => navigate("/nearby")}
          />
        </Section>

        <Section icon={Ruler} title={t("measurements.title", "Measurements")}>
          <LinkRow
            label={t("measurements.title", "Measurements")}
            subtitle={t("measurements.settings_hint", "Weight, body fat and circumferences over time")}
            onClick={() => navigate("/measurements")}
          />
        </Section>

        <Section icon={CreditCard} title={t("settings.billing", "Faturalama")}>
          <LinkRow
            label={billingPending ? t("common.loading", "Yükleniyor…") : t("settings.manage_billing", "Faturamı Yönet")}
            subtitle={t("settings.manage_billing_hint", "Planını, ödeme yöntemini ve faturalarını Paddle üzerinden yönet")}
            onClick={manageBilling}
            external
          />
          <LinkRow
            label={t("pricing_page.title", "Planlar")}
            subtitle={t("settings.plans_hint", "Mevcut planları ve fiyatları gör")}
            onClick={() => navigate("/pricing")}
          />
        </Section>

        <Section icon={Lock} title={t("settings.privacy", "Gizlilik")}>
          <ToggleRow label={t("privacy.public_profile", "Genel Profil")} subtitle={t("privacy.public_sub", "Profiliniz herkes tarafından görülür")} value={privacyPrefs.publicProfile} onChange={() => togglePrivacy("publicProfile")} />
          <ToggleRow label={t("privacy.show_in_search", "Aramada Göster")} value={privacyPrefs.showInSearch} onChange={() => togglePrivacy("showInSearch")} />
          <ToggleRow label={t("privacy.workouts_on_feed", "Antrenmanları Akışta Göster")} subtitle={t("privacy.feed_sub", "Takipçileriniz antrenmanlarınızı görebilir")} value={privacyPrefs.showWorkoutsOnFeed} onChange={() => togglePrivacy("showWorkoutsOnFeed")} />
          <ToggleRow label={t("privacy.allow_followers", "Takipçilere İzin Ver")} value={privacyPrefs.allowFollowers} onChange={() => togglePrivacy("allowFollowers")} />
          <ToggleRow label={t("privacy.allow_messages", "Mesajlara İzin Ver")} value={privacyPrefs.allowMessages} onChange={() => togglePrivacy("allowMessages")} />
          <LinkRow label={t("privacy.privacy_policy", "Gizlilik Politikası")} onClick={() => { window.open("https://motionmeet.app/privacy", "_blank", "noopener,noreferrer"); }} external />
          <LinkRow label={t("privacy.terms", "Kullanım Koşulları")} onClick={() => { window.open("https://motionmeet.app/terms", "_blank", "noopener,noreferrer"); }} external />
          <LinkRow label={t("privacy.export_data", "Verilerimi Dışa Aktar")} onClick={exportData} />
          <LinkRow label={t("privacy.delete_account", "Hesabı Sil")} onClick={() => setDeleteDialogOpen(true)} danger />
        </Section>

        <Section icon={HelpCircle} title={t("settings.support", "Destek")}>
          <LinkRow label={t("support.email", "E-posta Desteği")} subtitle="support@motionmeet.app" onClick={() => { window.open("mailto:support@motionmeet.app"); }} external />
          <LinkRow label={t("support.web", "Web Sitesi")} subtitle="motionmeet.app" onClick={() => { window.open("https://motionmeet.app", "_blank", "noopener,noreferrer"); }} external />
          {/* The place dataset ships under ODbL, whose notice has to stay
              reachable from the released app. */}
          <LinkRow label={t("licenses.title", "Data & licences")} onClick={() => navigate("/licenses")} />
          <Stack divider={<Divider flexItem />}>
            {faqs.map((faq) => <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />)}
          </Stack>
        </Section>

        <Paper variant="outlined" sx={{ borderColor: "rgba(229,72,77,.3)", overflow: "hidden", mb: 2.5, breakInside: "avoid" }}>
          <ListItemButton onClick={() => signOut()} sx={{ color: "error.main", p: 2 }}>
            <ListItemAvatar><Avatar variant="rounded" sx={{ bgcolor: "rgba(239,68,68,.1)", color: "error.main" }}><LogOut size={20} /></Avatar></ListItemAvatar>
            <ListItemText primary={t("settings.logout", "Çıkış Yap")} slotProps={{ primary: { variant: "body2", sx: { fontWeight: 800 } } }} />
          </ListItemButton>
        </Paper>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
          MotionMeet v1.0.0 · © 2026 MotionMeet Studios
        </Typography>
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t("privacy.delete_account", "Hesabı Sil")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("privacy.delete_confirm", "Bu işlem geri alınamaz. Devam etmek istiyor musunuz?")}
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            margin="normal"
            type="password"
            label={t("auth.password", "Şifre")}
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
            autoComplete="current-password"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t("common.cancel", "İptal")}</Button>
          <Button
            color="error"
            variant="contained"
            disabled={!deletePassword || accountRequestPending}
            onClick={deleteAccount}
          >
            {t("common.continue", "Devam Et")}
          </Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
};

export default Settings;
