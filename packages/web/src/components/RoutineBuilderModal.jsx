import { useState, useEffect } from "react";
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

const RoutineBuilderModal = ({ setShowModal, onRoutineCreated }) => {
    const { getToken } = useAuthContext();
    const [form, setForm] = useState({ name: "", folder: "My Routines" });

    const [exercisesData, setExercisesData] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");

    const [selectedExercises, setSelectedExercises] = useState([]);

    useEffect(() => {
        const fetchExercises = async () => {
            try {
                const token = await getToken();
                if (!token) return;
                const { data } = await api.get(`/api/exercise?search=${searchQuery}`, {
                    headers: { Authorization: `Bearer ${token}` },
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
        setSearchQuery("");
    };

    const removeExercise = (index) => {
        const updated = [...selectedExercises];
        updated.splice(index, 1);
        setSelectedExercises(updated);
    };

    const addSet = (exerciseIndex) => {
        const updated = [...selectedExercises];
        updated[exerciseIndex].sets.push({ setType: "normal", reps: 0, weight: 0, completed: false });
        setSelectedExercises(updated);
    };

    const removeSet = (exerciseIndex, setIndex) => {
        const updated = [...selectedExercises];
        updated[exerciseIndex].sets.splice(setIndex, 1);
        setSelectedExercises(updated);
    };

    const updateSet = (exerciseIndex, setIndex, field, value) => {
        const updated = [...selectedExercises];
        updated[exerciseIndex].sets[setIndex][field] = value;
        setSelectedExercises(updated);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) {
            toast.error("Routine name is required.");
            return;
        }
        if (selectedExercises.length === 0) {
            toast.error("Please add at least one exercise.");
            return;
        }

        try {
            const payload = {
                name: form.name,
                folder: form.folder,
                exercises: selectedExercises.map(e => ({
                    exerciseId: e.exerciseId._id,
                    sets: e.sets
                }))
            };

            const token = await getToken();
            const { data } = await api.post("/api/routine", payload, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (data.success) {
                toast.success(data.message || "Routine created successfully!");
                onRoutineCreated(data.routine);
                setShowModal(false);
            } else {
                toast.error(data.message || "Failed to create routine.");
            }
        } catch (error) {
            toast.error(error.message || "An error occurred.");
        }
    };

    return (
        <Dialog open={true} onClose={() => setShowModal(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: 'background.paper', backgroundImage: 'none' } }}>
            <Box component="form" onSubmit={handleSubmit}>
                <DialogTitle sx={{ pb: 1, pt: 3, px: 3 }}>
                    <Stack direction="row" alignItems="center" spacing={2}>
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
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            InputProps={{ sx: { borderRadius: 3 } }}
                        />

                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: 'background.default' }}>
                            <Typography variant="subtitle2" fontWeight={700} mb={2}>Add Exercises</Typography>
                            
                            <TextField
                                placeholder="Search exercise to add..."
                                fullWidth
                                variant="outlined"
                                size="small"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchRounded fontSize="small" />
                                        </InputAdornment>
                                    ),
                                    sx: { borderRadius: 2, bgcolor: 'background.paper' }
                                }}
                                sx={{ mb: 2 }}
                            />

                            {searchQuery && (
                                <Paper variant="outlined" sx={{ maxHeight: 160, overflowY: 'auto', mb: 2, p: 1, borderRadius: 2 }}>
                                    {exercisesData.length > 0 ? exercisesData.map(ex => (
                                        <Stack
                                            key={ex._id}
                                            direction="row"
                                            alignItems="center"
                                            justifyContent="space-between"
                                            sx={{ p: 1.5, cursor: 'pointer', borderRadius: 1.5, '&:hover': { bgcolor: 'action.hover' } }}
                                            onClick={() => addExercise(ex)}
                                        >
                                            <Typography variant="body2" fontWeight={600}>{ex.name}</Typography>
                                            <PlusRounded color="primary" fontSize="small" />
                                        </Stack>
                                    )) : (
                                        <Typography variant="caption" color="text.secondary" display="block" textAlign="center" py={1}>No exercises found.</Typography>
                                    )}
                                </Paper>
                            )}

                            {selectedExercises.length > 0 && (
                                <Stack spacing={2}>
                                    {selectedExercises.map((se, exIndex) => (
                                        <Paper key={exIndex} variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: 'background.paper' }}>
                                            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                                                <Stack direction="row" alignItems="center" spacing={1}>
                                                    <DumbbellRounded color="primary" fontSize="small" />
                                                    <Typography variant="subtitle2" fontWeight={700}>{se.exerciseId.name}</Typography>
                                                </Stack>
                                                <IconButton size="small" color="error" onClick={() => removeExercise(exIndex)}>
                                                    <Trash2Rounded fontSize="small" />
                                                </IconButton>
                                            </Stack>

                                            <Box display="grid" gridTemplateColumns="1fr 2fr 2fr 1fr" gap={1} mb={1} px={1}>
                                                <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase">Set</Typography>
                                                <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase" textAlign="center">kg</Typography>
                                                <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase" textAlign="center">reps</Typography>
                                                <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase" textAlign="center"></Typography>
                                            </Box>

                                            <Stack spacing={1}>
                                                {se.sets.map((set, setIndex) => (
                                                    <Box key={setIndex} display="grid" gridTemplateColumns="1fr 2fr 2fr 1fr" gap={1} alignItems="center">
                                                        <Box sx={{ p: 1, bgcolor: 'background.default', border: 1, borderColor: 'divider', borderRadius: 2, display: 'flex', justifyContent: 'center' }}>
                                                            <Typography variant="body2" fontWeight={600} color="text.secondary">{setIndex + 1}</Typography>
                                                        </Box>
                                                        <TextField
                                                            type="number"
                                                            size="small"
                                                            value={set.weight}
                                                            onChange={(e) => updateSet(exIndex, setIndex, "weight", Number(e.target.value))}
                                                            inputProps={{ style: { textAlign: 'center' } }}
                                                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'background.default' } }}
                                                        />
                                                        <TextField
                                                            type="number"
                                                            size="small"
                                                            value={set.reps}
                                                            onChange={(e) => updateSet(exIndex, setIndex, "reps", Number(e.target.value))}
                                                            inputProps={{ style: { textAlign: 'center' } }}
                                                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'background.default' } }}
                                                        />
                                                        <Box display="flex" justifyContent="center">
                                                            <IconButton size="small" sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }} onClick={() => removeSet(exIndex, setIndex)}>
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
                    <Button onClick={() => setShowModal(false)} color="inherit" sx={{ fontWeight: 600, borderRadius: 2, textTransform: 'none', px: 3 }}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="contained" sx={{ fontWeight: 600, borderRadius: 2, textTransform: 'none', px: 3, boxShadow: 'none' }}>
                        Save Routine
                    </Button>
                </DialogActions>
            </Box>
        </Dialog>
    );
};

export default RoutineBuilderModal;
