import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import EmojiEventsRounded from "@mui/icons-material/EmojiEventsRounded";
import LocalFireDepartmentRounded from "@mui/icons-material/LocalFireDepartmentRounded";
import StarRounded from "@mui/icons-material/StarRounded";
import WorkspacePremiumRounded from "@mui/icons-material/WorkspacePremiumRounded";

const iconMap = {
    Trophy: EmojiEventsRounded,
    Flame: LocalFireDepartmentRounded,
    Award: WorkspacePremiumRounded,
    Star: StarRounded,
};

const colorMap = {
    "from-blue-500 to-indigo-600": "linear-gradient(135deg, #3b82f6, #4f46e5)",
    "from-orange-400 to-red-500": "linear-gradient(135deg, #fb923c, #ef4444)",
    "from-amber-400 to-yellow-600": "linear-gradient(135deg, #fbbf24, #ca8a04)",
    "from-emerald-400 to-teal-500": "linear-gradient(135deg, #34d399, #14b8a6)",
};

const PersonalRecords = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [records] = useState([
        { id: 1, name: "Bench Press", value: "100", unit: "kg", date: "Oct 24, 2025", icon: "Trophy", color: "from-blue-500 to-indigo-600" },
        { id: 2, name: "Squat", value: "140", unit: "kg", date: "Sep 12, 2025", icon: "Flame", color: "from-orange-400 to-red-500" },
        { id: 3, name: "Deadlift", value: "160", unit: "kg", date: "Nov 02, 2025", icon: "Award", color: "from-amber-400 to-yellow-600" },
        { id: 4, name: "Overhead Press", value: "65", unit: "kg", date: "Aug 15, 2025", icon: "Star", color: "from-emerald-400 to-teal-500" },
    ]);

    return (
        <Box sx={{ width: "100%", minHeight: "100vh", p: { xs: 2, sm: 4 }, overflowY: "auto" }}>
            <Box sx={{ maxWidth: 900, mx: "auto", pb: 10 }}>
                {/* Header */}
                <Stack direction="row" alignItems="center" spacing={2} mb={5}>
                    <IconButton onClick={() => navigate("/statistics")} sx={{ bgcolor: "action.hover", borderRadius: 2 }}>
                        <ArrowBackRounded />
                    </IconButton>
                    <Box>
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography variant="h4" fontWeight={900}>{t("statistics.records", "Kişisel Rekorlar")}</Typography>
                            <Chip label="PRO" size="small" sx={{ bgcolor: "warning.main", color: "#000", fontWeight: 900, fontSize: 10 }} />
                        </Stack>
                        <Typography variant="body2" color="text.secondary">{t("statistics.records_desc", "1RM ve en iyi setlerin")}</Typography>
                    </Box>
                </Stack>

                {/* Records Grid */}
                <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1fr 1fr" }} gap={3}>
                    {records.map((record) => {
                        const Icon = iconMap[record.icon] || EmojiEventsRounded;
                        const gradient = colorMap[record.color] || colorMap["from-blue-500 to-indigo-600"];
                        return (
                            <Paper
                                key={record.id}
                                variant="outlined"
                                sx={{
                                    borderRadius: 4, p: 3, position: "relative", overflow: "hidden",
                                    "&:hover": { borderColor: "primary.main", boxShadow: 3 },
                                    transition: "all 0.25s",
                                }}
                            >
                                {/* Decorative gradient circle */}
                                <Box sx={{
                                    position: "absolute", top: -20, right: -20,
                                    width: 120, height: 120, borderRadius: "50%",
                                    background: gradient, opacity: 0.12, filter: "blur(24px)",
                                }} />

                                <Stack direction="row" alignItems="center" justifyContent="space-between" position="relative" zIndex={1}>
                                    <Box flex={1}>
                                        <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
                                            <Box sx={{ p: 1.5, borderRadius: 2.5, background: gradient, display: "flex" }}>
                                                <Icon sx={{ fontSize: 22, color: "#fff" }} />
                                            </Box>
                                            <Chip label="1RM" size="small" variant="outlined" sx={{ fontWeight: 700, fontSize: 11 }} />
                                        </Stack>
                                        <Typography variant="h6" fontWeight={900} mb={0.5}>{record.name}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {t("statistics.archived_on", "Archived on")} {record.date}
                                        </Typography>
                                    </Box>

                                    <Box textAlign="right">
                                        <Stack direction="row" alignItems="baseline" spacing={0.5} justifyContent="flex-end">
                                            <Typography variant="h3" fontWeight={900} lineHeight={1}>{record.value}</Typography>
                                            <Typography variant="body1" fontWeight={700} color="text.secondary">{record.unit}</Typography>
                                        </Stack>
                                    </Box>
                                </Stack>
                            </Paper>
                        );
                    })}
                </Box>

                {records.length === 0 && (
                    <Paper variant="outlined" sx={{ textAlign: "center", py: 10, borderRadius: 4 }}>
                        <WorkspacePremiumRounded sx={{ fontSize: 64, color: "text.disabled", mb: 2 }} />
                        <Typography variant="h6" fontWeight={700} mb={1}>{t("statistics.no_records_yet", "No Records Yet")}</Typography>
                        <Typography variant="body2" color="text.secondary">{t("statistics.log_more_workouts", "Log more workouts to see your personal records here.")}</Typography>
                    </Paper>
                )}
            </Box>
        </Box>
    );
};

export default PersonalRecords;
