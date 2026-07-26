import { useState } from "react";
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
import MenuItem from '@mui/material/MenuItem';

import DumbbellRounded from '@mui/icons-material/FitnessCenterRounded';

import { useTranslation } from "react-i18next";
import { useMuscleGroups } from "../hooks/useMuscleGroups";
import { useEquipment } from "../hooks/useEquipment";

const CustomExerciseModal = ({ setShowModal, onExerciseCreated }) => {
    const { t } = useTranslation();
    const { getToken } = useAuthContext();
    const { data: muscleGroupsList } = useMuscleGroups();
    const { data: equipmentListItems } = useEquipment();

    const [form, setForm] = useState({
        name: "",
        muscleGroup: "All Muscles",
        equipment: "All Equipment",
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) {
            toast.error("Exercise name is required.");
            return;
        }

        if (form.muscleGroup === "All Muscles" || form.equipment === "All Equipment") {
            toast.error("Please select a muscle group and equipment type");
            return;
        }

        try {
            const token = await getToken();
            const { data } = await api.post(
                "/api/exercise",
                {
                    name: form.name,
                    muscleGroup: form.muscleGroup,
                    equipment: form.equipment,
                },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (data.success) {
                toast.success(data.message || "Exercise created successfully!");
                onExerciseCreated(data.exercise);
                setShowModal(false);
            } else {
                toast.error(data.message || "Failed to create exercise.");
            }
        } catch (error) {
            toast.error(error.message || "An error occurred.");
        }
    };

    return (
        <Dialog open={true} onClose={() => setShowModal(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: 'background.paper', backgroundImage: 'none' } }}>
            <Box component="form" onSubmit={handleSubmit}>
                <DialogTitle sx={{ pb: 1, pt: 3, px: 3 }}>
                    <Stack direction="row" alignItems="center" spacing={2}>
                        <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.1, position: 'absolute' }} />
                        <DumbbellRounded color="primary" />
                        <Typography variant="h6" fontWeight={800}>Custom Exercise</Typography>
                    </Stack>
                </DialogTitle>

                <DialogContent sx={{ px: 3, pb: 2 }}>
                    <Stack spacing={3} mt={1}>
                        <TextField
                            label="Exercise Name"
                            variant="outlined"
                            fullWidth
                            required
                            placeholder="e.g. Incline Bench Press"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            slotProps={{ input: { sx: { borderRadius: 3 } } }}
                        />

                        <TextField
                            select
                            label="Target Muscle Group"
                            fullWidth
                            value={form.muscleGroup}
                            onChange={(e) => setForm({ ...form, muscleGroup: e.target.value })}
                            slotProps={{ input: { sx: { borderRadius: 3 } } }}
                        >
                            <MenuItem disabled value="All Muscles">All Muscles</MenuItem>
                            {muscleGroupsList.map((mg) => (
                                <MenuItem key={mg.code} value={mg.code}>
                                    {t(`muscle_groups.${mg.code}`, mg.name)}
                                </MenuItem>
                            ))}
                        </TextField>

                        <TextField
                            select
                            label="Equipment Required"
                            fullWidth
                            value={form.equipment}
                            onChange={(e) => setForm({ ...form, equipment: e.target.value })}
                            slotProps={{ input: { sx: { borderRadius: 3 } } }}
                        >
                            <MenuItem disabled value="All Equipment">All Equipment</MenuItem>
                            {equipmentListItems.map((eq) => (
                                <MenuItem key={eq.code} value={eq.code}>
                                    {t(`equipment.${eq.code}`, eq.name)}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Stack>
                </DialogContent>

                <DialogActions sx={{ px: 3, pb: 3, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                    <Button onClick={() => setShowModal(false)} color="inherit" sx={{ fontWeight: 600, borderRadius: 2, textTransform: 'none', px: 3 }}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="contained" sx={{ fontWeight: 600, borderRadius: 2, textTransform: 'none', px: 3, boxShadow: 'none' }}>
                        Create
                    </Button>
                </DialogActions>
            </Box>
        </Dialog>
    );
};

export default CustomExerciseModal;
