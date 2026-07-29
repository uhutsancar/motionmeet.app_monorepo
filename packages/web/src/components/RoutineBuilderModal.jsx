import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import api from "~/api/axios";
import { useAuthContext } from "../context/AuthProvider";

import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import InputAdornment from '@mui/material/InputAdornment';

import FileTextRounded from '@mui/icons-material/DescriptionRounded';
import PlusRounded from '@mui/icons-material/AddRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import Trash2Rounded from '@mui/icons-material/DeleteOutlineRounded';
import DumbbellRounded from '@mui/icons-material/FitnessCenterRounded';
import { API_ROUTES, CONTENT_LIMITS, createOperationId, resolvePublicMediaUrl } from '@motionmeet/shared';

const RoutineBuilderModal = ({ setShowModal, onRoutineCreated }) => {
    const { getToken } = useAuthContext();
    const [form, setForm] = useState({ name: "", folder: "My Routines" });

    const [exercisesData, setExercisesData] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");

    const [selectedExercises, setSelectedExercises] = useState([]);
    const [saving, setSaving] = useState(false);
    const operationIdRef = useRef(null);

    const invalidateDraft = () => {
        operationIdRef.current = null;
    };

    useEffect(() => {
        const fetchExercises = async () => {
            try {
                const token = await getToken();
                if (!token) return;
                const { data } = await api.get(API_ROUTES.exercise.base, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { search: searchQuery, limit: 100 },
                });
                if (data.success) {
                    setExercisesData(data.exercises);
                }
            } catch (error) {
                console.error("Error fetching exercises", error);
            }
        };

        const timeoutId = setTimeout(() => fetchExercises(), 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery, getToken]);

    const addExercise = (exercise) => {
        if (saving) return;
        if (selectedExercises.find((e) => e.exerciseId._id === exercise._id)) {
            toast.error("Exercise already added.");
            return;
        }
        setSelectedExercises([
            ...selectedExercises,
            {
                exerciseId: exercise,
                sets: [{ setType: "normal", reps: 0, weight: 0, completed: false }]
            }
        ]);
        invalidateDraft();
        setSearchQuery("");
    };

    const removeExercise = (index) => {
        if (saving) return;
        const updated = [...selectedExercises];
        updated.splice(index, 1);
        setSelectedExercises(updated);
        invalidateDraft();
    };

    const addSet = (exerciseIndex) => {
        if (saving) return;
        const updated = [...selectedExercises];
        updated[exerciseIndex].sets.push({ setType: "normal", reps: 0, weight: 0, completed: false });
        setSelectedExercises(updated);
        invalidateDraft();
    };

    const removeSet = (exerciseIndex, setIndex) => {
        if (saving) return;
        const updated = [...selectedExercises];
        updated[exerciseIndex].sets.splice(setIndex, 1);
        setSelectedExercises(updated);
        invalidateDraft();
    };

    const updateSet = (exerciseIndex, setIndex, field, value) => {
        if (saving) return;
        const updated = [...selectedExercises];
        updated[exerciseIndex].sets[setIndex][field] = value;
        setSelectedExercises(updated);
        invalidateDraft();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (saving) return;
        if (!form.name.trim()) {
            toast.error("Routine name is required.");
            return;
        }
        if (selectedExercises.length === 0) {
            toast.error("Please add at least one exercise.");
            return;
        }

        setSaving(true);
        try {
            operationIdRef.current ||= createOperationId('routine');
            const payload = {
                operationId: operationIdRef.current,
                name: form.name,
                folder: form.folder,
                exercises: selectedExercises.map(e => ({
                    exerciseId: e.exerciseId._id,
                    sets: e.sets
                }))
            };

            const token = await getToken();
            if (!token) throw new Error("Authentication required");
            const { data } = await api.post(API_ROUTES.routine.base, payload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Idempotency-Key': payload.operationId,
                },
            });

            if (data.success) {
                toast.success(data.message || "Routine created successfully!");
                onRoutineCreated(data.routine);
                setShowModal(false);
            } else {
                toast.error(data.message || "Failed to create routine.");
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || "An error occurred.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={true} onClose={() => !saving && setShowModal(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: 'background.paper', backgroundImage: 'none' } }}>
            <Box component="form" onSubmit={handleSubmit}>
                <DialogTitle sx={{ pb: 1, pt: 3, px: 3 }}>
                    <Stack direction="row" sx={{ alignItems: "center" }} spacing={2}>
                        <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.1, position: 'absolute' }} />
                        <FileTextRounded color="primary" />
                        <Typography variant="h6" fontWeight={800}>Build Routine</Typography>
                    </Stack>
                </DialogTitle>
                
                <DialogContent sx={{ px: 3, pb: 2 }}>
                    <Stack spacing={3} mt={1}>
                        <TextField
                            label="Routine Name"
                            variant="outlined"
                            fullWidth
                            required
                            placeholder="e.g. Leg Day Destroyer"
                            value={form.name}
                            disabled={saving}
                            onChange={(e) => {
                                setForm({ ...form, name: e.target.value });
                                invalidateDraft();
                            }}
                            slotProps={{
                                htmlInput: { maxLength: CONTENT_LIMITS.routineName },
                                input: { sx: { borderRadius: 3 } },
                            }}
                        />

                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: 'background.default' }}>
                            <Typography variant="subtitle2" fontWeight={700} mb={2}>Add Exercises</Typography>
                            
                            <TextField
                                placeholder="Search exercise to add..."
                                fullWidth
                                variant="outlined"
                                size="small"
                                value={searchQuery}
                                disabled={saving}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                slotProps={{
                                    input: {
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchRounded fontSize="small" />
                                            </InputAdornment>
                                        ),
                                        sx: { borderRadius: 2, bgcolor: 'background.paper' }
                                    }
                                }}
                                sx={{ mb: 2 }}
                            />

                            {searchQuery && (
                                <Paper variant="outlined" sx={{ maxHeight: 160, overflowY: 'auto', mb: 2, p: 1, borderRadius: 2 }}>
                                    {exercisesData.length > 0 ? exercisesData.map(ex => (
                                            <Stack
                                                key={ex._id}
                                                direction="row"
                                                sx={{ justifyContent: "space-between",  alignItems: "center", p: 1.5, cursor: 'pointer', borderRadius: 1.5, '&:hover': { bgcolor: 'action.hover' } }}
                                                onClick={() => addExercise(ex)}
                                            >
                                                <Stack direction="row" sx={{ alignItems: "center" }} spacing={1.5}>
                                                    {resolvePublicMediaUrl(ex.gifUrl) ? (
                                                        <Box component="img" src={resolvePublicMediaUrl(ex.gifUrl)} sx={{ width: 40, height: 40, borderRadius: 1, objectFit: 'cover', bgcolor: 'action.hover' }} />
                                                    ) : (
                                                        <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <DumbbellRounded fontSize="small" color="disabled" />
                                                        </Box>
                                                    )}
                                                    <Box>
                                                        <Typography variant="body2" fontWeight={600}>{ex.name}</Typography>
                                                        <Typography variant="caption" color="text.secondary">{ex.muscleGroup} · {ex.equipment}</Typography>
                                                    </Box>
                                                </Stack>
                                                <PlusRounded color="primary" fontSize="small" />
                                            </Stack>
                                    )) : (
                                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", py: 1 }}>No exercises found.</Typography>
                                    )}
                                </Paper>
                            )}

                            {selectedExercises.length > 0 && (
                                <Stack spacing={2}>
                                    {selectedExercises.map((se, exIndex) => (
                                        <Paper key={exIndex} variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: 'background.paper' }}>
                                            <Stack direction="row" sx={{ justifyContent: "space-between",  alignItems: "center" }} mb={2}>
                                                <Stack direction="row" sx={{ alignItems: "center" }} spacing={1.5}>
                                                    {resolvePublicMediaUrl(se.exerciseId.gifUrl) ? (
                                                        <Box component="img" src={resolvePublicMediaUrl(se.exerciseId.gifUrl)} sx={{ width: 40, height: 40, borderRadius: 1, objectFit: 'cover', bgcolor: 'action.hover' }} />
                                                    ) : (
                                                        <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <DumbbellRounded color="primary" fontSize="small" />
                                                        </Box>
                                                    )}
                                                    <Typography variant="subtitle2" fontWeight={700}>{se.exerciseId.name}</Typography>
                                                </Stack>
                                                <IconButton size="small" color="error" onClick={() => removeExercise(exIndex)} disabled={saving}>
                                                    <Trash2Rounded fontSize="small" />
                                                </IconButton>
                                            </Stack>

                                            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 2fr 2fr 1fr", gap: 1, mb: 1, px: 1 }}>
                                                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase" }}>Set</Typography>
                                                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", textAlign: "center" }}>kg</Typography>
                                                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", textAlign: "center" }}>reps</Typography>
                                                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", textAlign: "center" }}></Typography>
                                            </Box>

                                            <Stack spacing={1}>
                                                {se.sets.map((set, setIndex) => (
                                                    <Box key={setIndex} sx={{ display: "grid", gridTemplateColumns: "1fr 2fr 2fr 1fr", gap: 1, alignItems: "center" }}>
                                                        <Box sx={{ p: 1, bgcolor: 'background.default', border: 1, borderColor: 'divider', borderRadius: 2, display: 'flex', justifyContent: 'center' }}>
                                                            <Typography variant="body2" fontWeight={600} color="text.secondary">{setIndex + 1}</Typography>
                                                        </Box>
                                                        <TextField
                                                            type="number"
                                                            size="small"
                                                            value={set.weight}
                                                            disabled={saving}
                                                            onChange={(e) => updateSet(exIndex, setIndex, "weight", Number(e.target.value))}
                                                            slotProps={{ htmlInput: { style: { textAlign: 'center' } } }}
                                                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'background.default' } }}
                                                        />
                                                        <TextField
                                                            type="number"
                                                            size="small"
                                                            value={set.reps}
                                                            disabled={saving}
                                                            onChange={(e) => updateSet(exIndex, setIndex, "reps", Number(e.target.value))}
                                                            slotProps={{ htmlInput: { style: { textAlign: 'center' } } }}
                                                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'background.default' } }}
                                                        />
                                                        <Box sx={{ display: "flex", justifyContent: "center" }}>
                                                            <IconButton size="small" disabled={saving} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }} onClick={() => removeSet(exIndex, setIndex)}>
                                                                <Trash2Rounded fontSize="small" />
                                                            </IconButton>
                                                        </Box>
                                                    </Box>
                                                ))}
                                            </Stack>

                                            <Button
                                                variant="outlined"
                                                color="inherit"
                                                fullWidth
                                                startIcon={<PlusRounded />}
                                                onClick={() => addSet(exIndex)}
                                                disabled={saving}
                                                sx={{ mt: 2, borderRadius: 2, borderStyle: 'dashed', textTransform: 'none', fontWeight: 600 }}
                                            >
                                                Add Set
                                            </Button>
                                        </Paper>
                                    ))}
                                </Stack>
                            )}
                        </Paper>
                    </Stack>
                </DialogContent>
                
                <DialogActions sx={{ px: 3, pb: 3, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                    <Button onClick={() => setShowModal(false)} disabled={saving} color="inherit" sx={{ fontWeight: 600, borderRadius: 2, textTransform: 'none', px: 3 }}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="contained" disabled={saving} sx={{ fontWeight: 600, borderRadius: 2, textTransform: 'none', px: 3, boxShadow: 'none' }}>
                        {saving ? "Saving…" : "Save Routine"}
                    </Button>
                </DialogActions>
            </Box>
        </Dialog>
    );
};

export default RoutineBuilderModal;
