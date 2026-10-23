import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ScrollText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { LOCATION_DATASET_ATTRIBUTION } from "@motionmeet/shared";
import { PageHeader, PageShell } from "~/components/AppPage";

/**
 * Third-party data notices.
 *
 * Both datasets MotionMeet ships require their source to stay visible in the
 * released app, so this page is part of the licence obligation and not a
 * nicety — it must not be dropped from a production build. The full terms and
 * the outstanding questions are tracked in docs/LICENSES.md.
 */
const Licenses = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Only the location dataset is listed. Its ODbL licence makes this notice a
  // condition of use, so it has to stay in released builds.
  const notices = [
    {
      title: t("licenses.locations_title", "Place data"),
      body: t(
        "licenses.locations_body",
        "Country, region and city names used by the location picker come from the Countries States Cities Database, licensed under the Open Database License (ODbL) v1.0.",
      ),
      attribution: LOCATION_DATASET_ATTRIBUTION.text,
      links: [
        { label: "github.com/dr5hn/countries-states-cities-database", url: LOCATION_DATASET_ATTRIBUTION.url },
        { label: "ODbL v1.0", url: LOCATION_DATASET_ATTRIBUTION.licenseUrl },
      ],
    },
  ];

  return (
    <PageShell maxWidth={760}>
      <PageHeader
        icon={ScrollText}
        eyebrow={t("licenses.eyebrow", "LEGAL")}
        title={t("licenses.title", "Data & licences")}
        description={t("licenses.intro", "MotionMeet uses open data from the projects below. Their licences require these notices to be shown.")}
        onBack={() => navigate("/settings")}
      />

      {notices.map((notice) => (
        <Paper key={notice.title} variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{notice.title}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.7 }}>
            {notice.body}
          </Typography>
          <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: "action.hover" }}>
            <Typography variant="caption" color="text.secondary" sx={{ wordBreak: "break-word" }}>
              {notice.attribution}
            </Typography>
          </Box>
          <Stack spacing={0.5} sx={{ mt: 1.5 }}>
            {notice.links.map((link) => (
              <Link
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                variant="caption"
                sx={{ fontWeight: 700 }}
              >
                {link.label}
              </Link>
            ))}
          </Stack>
        </Paper>
      ))}
    </PageShell>
  );
};

export default Licenses;
