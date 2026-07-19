import { useAuthContext } from "../context/AuthProvider.jsx";
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
  Typography,
} from "@mui/material";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Globe,
  HelpCircle,
  Lock,
  LogOut,
  Monitor,
  Moon,
  Sun,
  User,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAppTheme } from "~/context/appThemeContext";

const readPreferences = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
};

const Section = ({ icon: Icon, title, children = null }) => (
  <Stack component="section" spacing={1.5}>
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Icon size={20} color="currentColor" />
      <Typography variant="h6" sx={{ fontWeight: 800 }}>{title}</Typography>
    </Stack>
    <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: "hidden" }}>
      <Stack divider={<Divider flexItem />}>{children}</Stack>
    </Paper>
  </Stack>
);

const ToggleRow = ({ label, subtitle = "", value, onChange }) => (
  <Stack direction="row" spacing={2} sx={{ px: 2, py: 1.5, alignItems: "center", justifyContent: "space-between" }}>
    <Stack sx={{ minWidth: 0 }}>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>{label}</Typography>
      {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
    </Stack>
    <Switch checked={value} onChange={onChange} inputProps={{ "aria-label": label }} />
  </Stack>
);

const LinkRow = ({ label, subtitle = "", onClick, danger = false, external = false }) => (
  <ListItemButton onClick={onClick} sx={{ px: 2, py: 1.25, color: danger ? "error.main" : "text.primary" }}>
    <ListItemText
      primary={label}
      secondary={subtitle}
      slotProps={{ primary: { variant: "body2", sx: { fontWeight: 700 } }, secondary: { variant: "caption" } }}
    />
    {external ? <ExternalLink size={17} /> : <ChevronRight size={17} />}
  </ListItemButton>
);

const FaqItem = ({ question, answer }) => (
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
  const { signOut, user } = useAuthContext();
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState({
    pushEnabled: true,
    newFollower: true,
    postLike: true,
    postComment: true,
    newMessage: true,
    workoutReminder: false,
    weeklyReport: true,
    ...readPreferences("@mm_notif_prefs"),
  });
  const [privacyPrefs, setPrivacyPrefs] = useState({
    publicProfile: true,
    showWorkoutsOnFeed: true,
    allowFollowers: true,
    showInSearch: true,
    allowMessages: true,
    ...readPreferences("@mm_privacy_prefs"),
  });
  const isTr = i18n.language.startsWith("tr");

  const changeLanguage = (language) => {
    i18n.changeLanguage(language);
    localStorage.setItem("appLanguage", language);
  };

  const togglePreference = (setter, storageKey, key) => {
    setter((current) => {
      const updated = { ...current, [key]: !current[key] };
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
  };

  const faqs = [
    { question: t("support.faq1_q", "Antrenman verilerim nerede saklanıyor?"), answer: t("support.faq1_a", "Tüm verileriniz güvenli bulut sunucularımızda şifrelenmiş olarak saklanır.") },
    { question: t("support.faq2_q", "Şifremi nasıl sıfırlarım?"), answer: t("support.faq2_a", "Giriş ekranındaki Şifremi Unuttum seçeneğini kullanabilirsiniz.") },
    { question: t("support.faq3_q", "Verilerimi dışa aktarabilir miyim?"), answer: t("support.faq3_a", "Veri dışa aktarma özelliği gelecek bir güncellemede eklenecektir.") },
    { question: t("support.faq4_q", "Uygulama hangi platformlarda çalışıyor?"), answer: t("support.faq4_a", "MotionMeet iOS, Android ve Web üzerinde kullanılabilir.") },
    { question: t("support.faq5_q", "Bildirimler gelmiyor, ne yapmalıyım?"), answer: t("support.faq5_a", "Ayarlar bölümünden bildirimlerin açık olduğunu kontrol edin.") },
  ];

  return (
    <Box sx={{ width: "100%", minHeight: "100vh", overflowY: "auto", py: { xs: 2, sm: 3 }, pb: 10 }}>
      <Stack spacing={4} sx={{ maxWidth: 768, mx: "auto", px: { xs: 2, sm: 4 } }}>
        <Typography variant="h4" sx={{ fontWeight: 900 }}>{t("settings.title", "Ayarlar")}</Typography>

        <Section icon={User} title={t("settings.account", "Hesap")}>
          <ListItemButton onClick={() => navigate("/profile")} sx={{ px: 2, py: 1.5 }}>
            <ListItemAvatar>
              <Avatar src={user?.imageUrl || undefined} alt={user?.fullName || user?.username}>
                {user?.fullName?.charAt(0) || <User size={21} />}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={user?.fullName || user?.username || "—"}
              secondary={user?.primaryEmailAddress?.emailAddress || ""}
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
            <ToggleButtonGroup exclusive size="small" value={isTr ? "tr" : "en"} onChange={(_, value) => value && changeLanguage(value)}>
              <ToggleButton value="en">EN</ToggleButton>
              <ToggleButton value="tr">TR</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Section>

        <Section icon={Bell} title={t("settings.notifications", "Bildirimler")}>
          <ToggleRow label={t("notifications.push", "Anlık Bildirimler")} subtitle={t("notifications.push_sub", "Tüm bildirimleri aç veya kapat")} value={notifPrefs.pushEnabled} onChange={() => togglePreference(setNotifPrefs, "@mm_notif_prefs", "pushEnabled")} />
          <ToggleRow label={t("notifications.new_follower", "Yeni Takipçi")} value={notifPrefs.newFollower} onChange={() => togglePreference(setNotifPrefs, "@mm_notif_prefs", "newFollower")} />
          <ToggleRow label={t("notifications.post_like", "Gönderi Beğenisi")} value={notifPrefs.postLike} onChange={() => togglePreference(setNotifPrefs, "@mm_notif_prefs", "postLike")} />
          <ToggleRow label={t("notifications.post_comment", "Gönderi Yorumu")} value={notifPrefs.postComment} onChange={() => togglePreference(setNotifPrefs, "@mm_notif_prefs", "postComment")} />
          <ToggleRow label={t("notifications.new_message", "Yeni Mesaj")} value={notifPrefs.newMessage} onChange={() => togglePreference(setNotifPrefs, "@mm_notif_prefs", "newMessage")} />
          <ToggleRow label={t("notifications.workout_reminder", "Antrenman Hatırlatıcısı")} subtitle={t("notifications.reminder_sub", "Günlük antrenman hatırlatması")} value={notifPrefs.workoutReminder} onChange={() => togglePreference(setNotifPrefs, "@mm_notif_prefs", "workoutReminder")} />
          <ToggleRow label={t("notifications.weekly_report", "Haftalık Rapor")} subtitle={t("notifications.weekly_sub", "Her Pazartesi gönderilir")} value={notifPrefs.weeklyReport} onChange={() => togglePreference(setNotifPrefs, "@mm_notif_prefs", "weeklyReport")} />
        </Section>

        <Section icon={Lock} title={t("settings.privacy", "Gizlilik")}>
          <ToggleRow label={t("privacy.public_profile", "Genel Profil")} subtitle={t("privacy.public_sub", "Profiliniz herkes tarafından görülür")} value={privacyPrefs.publicProfile} onChange={() => togglePreference(setPrivacyPrefs, "@mm_privacy_prefs", "publicProfile")} />
          <ToggleRow label={t("privacy.show_in_search", "Aramada Göster")} value={privacyPrefs.showInSearch} onChange={() => togglePreference(setPrivacyPrefs, "@mm_privacy_prefs", "showInSearch")} />
          <ToggleRow label={t("privacy.workouts_on_feed", "Antrenmanları Akışta Göster")} subtitle={t("privacy.feed_sub", "Takipçileriniz antrenmanlarınızı görebilir")} value={privacyPrefs.showWorkoutsOnFeed} onChange={() => togglePreference(setPrivacyPrefs, "@mm_privacy_prefs", "showWorkoutsOnFeed")} />
          <ToggleRow label={t("privacy.allow_followers", "Takipçilere İzin Ver")} value={privacyPrefs.allowFollowers} onChange={() => togglePreference(setPrivacyPrefs, "@mm_privacy_prefs", "allowFollowers")} />
          <ToggleRow label={t("privacy.allow_messages", "Mesajlara İzin Ver")} value={privacyPrefs.allowMessages} onChange={() => togglePreference(setPrivacyPrefs, "@mm_privacy_prefs", "allowMessages")} />
          <LinkRow label={t("privacy.privacy_policy", "Gizlilik Politikası")} onClick={() => window.open("https://motionmeet.app/privacy", "_blank", "noopener,noreferrer")} external />
          <LinkRow label={t("privacy.terms", "Kullanım Koşulları")} onClick={() => window.open("https://motionmeet.app/terms", "_blank", "noopener,noreferrer")} external />
          <LinkRow label={t("privacy.delete_account", "Hesabı Sil")} onClick={() => setDeleteDialogOpen(true)} danger />
        </Section>

        <Section icon={HelpCircle} title={t("settings.support", "Destek")}>
          <LinkRow label={t("support.email", "E-posta Desteği")} subtitle="support@motionmeet.app" onClick={() => window.open("mailto:support@motionmeet.app")} external />
          <LinkRow label={t("support.web", "Web Sitesi")} subtitle="motionmeet.app" onClick={() => window.open("https://motionmeet.app", "_blank", "noopener,noreferrer")} external />
          <Stack divider={<Divider flexItem />}>
            {faqs.map((faq) => <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />)}
          </Stack>
        </Section>

        <Paper variant="outlined" sx={{ borderRadius: 2.5, borderColor: "rgba(239,68,68,.25)", overflow: "hidden" }}>
          <ListItemButton onClick={() => signOut()} sx={{ color: "error.main", p: 2 }}>
            <ListItemAvatar><Avatar variant="rounded" sx={{ bgcolor: "rgba(239,68,68,.1)", color: "error.main" }}><LogOut size={20} /></Avatar></ListItemAvatar>
            <ListItemText primary={t("settings.logout", "Çıkış Yap")} slotProps={{ primary: { variant: "body2", sx: { fontWeight: 800 } } }} />
          </ListItemButton>
        </Paper>

        <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
          MotionMeet v1.0.0 · © 2026 MotionMeet Studios
        </Typography>
      </Stack>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t("privacy.delete_account", "Hesabı Sil")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("privacy.delete_confirm", "Bu işlem geri alınamaz. Devam etmek istiyor musunuz?")}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t("common.cancel", "İptal")}</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              setDeleteDialogOpen(false);
              window.alert(t("privacy.contact_support", "Hesap silmek için lütfen destek ile iletişime geçin: support@motionmeet.app"));
            }}
          >
            {t("common.continue", "Devam Et")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Settings;
