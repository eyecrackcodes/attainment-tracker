import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
} from "@mui/material";

interface GoalPromptProps {
  open: boolean;
  onClose: () => void;
  onSave: (goal: { austin: number; charlotte: number }) => void;
}

export const GoalPrompt: React.FC<GoalPromptProps> = ({
  open,
  onClose,
  onSave,
}) => {
  const [austinGoal, setAustinGoal] = useState("");
  const [charlotteGoal, setCharlotteGoal] = useState("");

  const handleSave = () => {
    const austin = parseFloat(austinGoal);
    const charlotte = parseFloat(charlotteGoal);

    if (!isNaN(austin) && !isNaN(charlotte)) {
      onSave({ austin, charlotte });
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Set Next Month's Goals</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Please enter the sales goals for next month.
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="Austin Goal"
            type="number"
            value={austinGoal}
            onChange={(e) => setAustinGoal(e.target.value)}
            fullWidth
          />
          <TextField
            label="Charlotte Goal"
            type="number"
            value={charlotteGoal}
            onChange={(e) => setCharlotteGoal(e.target.value)}
            fullWidth
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Save Goals
        </Button>
      </DialogActions>
    </Dialog>
  );
};
