import React, { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Divider,
  Alert,
  Tooltip,
} from "@mui/material";
import {
  Settings as SettingsIcon,
  Save as SaveIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { TargetSettings as TargetSettingsType } from "../types/revenue";

interface TargetSettingsProps {
  currentSettings: TargetSettingsType;
  onSettingsChange: (newSettings: TargetSettingsType) => void;
}

export const TargetSettings: React.FC<TargetSettingsProps> = ({
  currentSettings,
  onSettingsChange,
}) => {
  const [open, setOpen] = useState(false);
  const [austinTarget, setAustinTarget] = useState<string>(
    currentSettings.dailyTargets.austin.toString()
  );
  const [charlotteTarget, setCharlotteTarget] = useState<string>(
    currentSettings.dailyTargets.charlotte.toString()
  );
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleOpen = () => {
    setAustinTarget(currentSettings.dailyTargets.austin.toString());
    setCharlotteTarget(currentSettings.dailyTargets.charlotte.toString());
    setError(null);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSave = () => {
    try {
      // Validate inputs
      const austinValue = parseFloat(austinTarget);
      const charlotteValue = parseFloat(charlotteTarget);

      if (isNaN(austinValue) || isNaN(charlotteValue)) {
        setError("Target values must be valid numbers");
        return;
      }

      if (austinValue <= 0 || charlotteValue <= 0) {
        setError("Target values must be greater than zero");
        return;
      }

      // Create new settings object, preserving monthly adjustments
      const newSettings: TargetSettingsType = {
        ...currentSettings,
        dailyTargets: {
          austin: austinValue,
          charlotte: charlotteValue,
        },
      };

      onSettingsChange(newSettings);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
      }, 1500);
    } catch (err) {
      setError("An error occurred while saving the targets");
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <>
      <Tooltip title="Daily Target Settings">
        <IconButton
          color="primary"
          onClick={handleOpen}
          data-testid="target-settings-button"
        >
          <SettingsIcon />
        </IconButton>
      </Tooltip>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography variant="h6">Daily Revenue Targets</Typography>
            <IconButton onClick={handleClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Typography variant="body2" color="text.secondary" paragraph>
            Set the default daily revenue targets for each location. These
            targets will be used for calculating attainment percentages.
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Note: You can set monthly adjustments for specific months using the
            calendar icon in the dashboard header.
          </Typography>

          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Austin Daily Target"
              type="number"
              value={austinTarget}
              onChange={(e) => setAustinTarget(e.target.value)}
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
              }}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Charlotte Daily Target"
              type="number"
              value={charlotteTarget}
              onChange={(e) => setCharlotteTarget(e.target.value)}
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
              }}
            />
          </Box>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {showSuccess && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Daily targets updated successfully!
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
          >
            Save Targets
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
