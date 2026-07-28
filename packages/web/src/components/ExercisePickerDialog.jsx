import { useEffect, useMemo, useState } from "react";
import {
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  InputAdornment,
  List,
  ListItemButton,
  ListItemAvatar,
  Avatar,
  TextField,
  Typography,
} from "@mui/material";
import SearchRounded from "@mui/icons-material/SearchRounded";
import FitnessCenterRounded from "@mui/icons-material/FitnessCenterRounded";
import { resolvePublicMediaUrl } from "@motionmeet/shared";
import { useTranslation } from "react-i18next";
import { useAuthContext } from "../context/AuthProvider";
import { getExercises } from "../services/exerciseService";

const ExercisePickerDialog = ({ open, onClose, onSelect, excludedIds = [] }) => {
  const { t } = useTranslation();
  const { getToken } = useAuthContext();
  const [exercises, setExercises] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const excluded = useMemo(() => new Set(excludedIds), [excludedIds]);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const token = await getToken();
        const data = await getExercises(token, {
          search,
          muscleGroup: "",
          equipment: "",
        });
        if (active && data.success) setExercises(data.exercises || []);
      } finally {
        if (active) setLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [getToken, open, search]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("active_workout.add_exercise", "Add exercise")}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("exercises.search", "Search exercises")}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded />
                </InputAdornment>
              ),
            },
          }}
          sx={{ mt: 1, mb: 1 }}
        />
        {loading ? (
          <CircularProgress size={28} sx={{ display: "block", mx: "auto", my: 5 }} />
        ) : (
          <List sx={{ maxHeight: 420, overflowY: "auto" }}>
            {exercises.map((exercise) => {
              const disabled = excluded.has(exercise._id);
              return (
                <ListItemButton
                  key={exercise._id}
                  disabled={disabled}
                  onClick={() => {
                    onSelect(exercise);
                    onClose();
                  }}
                >
                  <ListItemAvatar>
                    <Avatar
                      variant="rounded"
                      src={resolvePublicMediaUrl(exercise.gifUrl)}
                      sx={{ width: 44, height: 44, mr: 2, bgcolor: "action.hover" }}
                    >
                      <FitnessCenterRounded sx={{ color: "text.secondary" }} />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={exercise.name}
                    secondary={`${exercise.muscleGroup} · ${exercise.equipment}`}
                  />
                  {disabled && (
                    <Typography variant="caption" color="text.secondary">
                      {t("active_workout.already_added", "Added")}
                    </Typography>
                  )}
                </ListItemButton>
              );
            })}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ExercisePickerDialog;
