import Routine from "../models/Routine.js";

// Get user routines
export const getUserRoutines = async (req, res) => {
  try {
    const { userId } = req.auth();
    const routines = await Routine.find({ userId }).populate("exercises.exerciseId");
    res.json({ success: true, routines });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Create a new routine
export const createRoutine = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { name, folder, exercises } = req.body;
    
    const newRoutine = await Routine.create({
      userId,
      name,
      folder,
      exercises
    });

    res.json({ success: true, routine: newRoutine, message: "Routine created successfully" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Update a routine
export const updateRoutine = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { id } = req.params;
    const updateData = req.body;

    const routine = await Routine.findOneAndUpdate(
      { _id: id, userId },
      updateData,
      { new: true }
    ).populate("exercises.exerciseId");

    if (!routine) {
      return res.json({ success: false, message: "Routine not found or not authorized" });
    }

    res.json({ success: true, routine, message: "Routine updated successfully" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Delete a routine
export const deleteRoutine = async (req, res) => {
    try {
      const { userId } = req.auth();
      const { id } = req.params;
  
      const routine = await Routine.findOneAndDelete({ _id: id, userId });
  
      if (!routine) {
        return res.json({ success: false, message: "Routine not found or not authorized" });
      }
  
      res.json({ success: true, message: "Routine deleted successfully" });
    } catch (error) {
      console.log(error);
      res.json({ success: false, message: error.message });
    }
  };
