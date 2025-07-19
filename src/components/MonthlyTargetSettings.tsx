import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Divider,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import {
  CalendarMonth as CalendarIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Clear as ClearIcon,
} from "@mui/icons-material";
import {
  DailyTarget,
  MonthlyTargetAdjustment,
  TargetSettings,
} from "../types/revenue";

interface MonthlyTargetSettingsProps {
  currentSettings: TargetSettings;
  onSettingsChange: (newSettings: TargetSettings) => void;
}

export const MonthlyTargetSettings: React.FC<MonthlyTargetSettingsProps> = ({
  currentSettings,
  onSettingsChange,
}) => {
  const [open, setOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number>(
    new Date().getMonth()
  );
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear()
  );
  const [austinTarget, setAustinTarget] = useState<string>("");
  const [charlotteTarget, setCharlotteTarget] = useState<string>("");
  const [workingDays, setWorkingDays] = useState<number[]>([]);
  const [agentCount, setAgentCount] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editIndex, setEditIndex] = useState<number>(-1);

  // Generate years for dropdown (current year and next 2 years)
  const years = Array.from(
    { length: 3 },
    (_, i) => new Date().getFullYear() + i
  );

  // Generate all days in the selected month
  const getDaysInMonth = (month: number, year: number) => {
    const date = new Date(year, month + 1, 0);
    return Array.from({ length: date.getDate() }, (_, i) => i + 1);
  };

  const daysInSelectedMonth = getDaysInMonth(selectedMonth, selectedYear);

  // Check if a day is a weekend
  const isWeekend = (day: number) => {
    const date = new Date(selectedYear, selectedMonth, day);
    return date.getDay() === 0 || date.getDay() === 6; // 0 = Sunday, 6 = Saturday
  };

  // Initialize working days (exclude weekends)
  useEffect(() => {
    const businessDays = daysInSelectedMonth.filter((day) => !isWeekend(day));
    setWorkingDays(businessDays);
  }, [selectedMonth, selectedYear]);

  // Check if there's an existing adjustment for the selected month/year
  useEffect(() => {
    const existingAdjustment = currentSettings.monthlyAdjustments.find(
      (adj) => adj.month === selectedMonth && adj.year === selectedYear
    );

    if (existingAdjustment) {
      setWorkingDays(existingAdjustment.workingDays);
      setAustinTarget(existingAdjustment.austin?.toString() || "");
      setCharlotteTarget(existingAdjustment.charlotte?.toString() || "");
      setAgentCount(existingAdjustment.agentCount?.toString() || "");
    } else {
      // Default to business days
      const businessDays = daysInSelectedMonth.filter((day) => !isWeekend(day));
      setWorkingDays(businessDays);
      setAustinTarget("");
      setCharlotteTarget("");
      setAgentCount("");
    }
  }, [selectedMonth, selectedYear, currentSettings.monthlyAdjustments]);

  const handleOpen = () => {
    setSelectedMonth(new Date().getMonth());
    setSelectedYear(new Date().getFullYear());
    setEditMode(false);
    setEditIndex(-1);
    setError(null);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSave = () => {
    try {
      // Validate inputs
      if (workingDays.length === 0) {
        setError("You must select at least one working day");
        return;
      }

      // Parse targets if provided
      const austinValue = austinTarget ? parseFloat(austinTarget) : undefined;
      const charlotteValue = charlotteTarget
        ? parseFloat(charlotteTarget)
        : undefined;

      const agentCountValue = agentCount ? parseInt(agentCount, 10) : undefined;

      if (
        (austinTarget && isNaN(austinValue!)) ||
        (charlotteTarget && isNaN(charlotteValue!))
      ) {
        setError("Target values must be valid numbers");
        return;
      }

      if (
        (austinValue && austinValue <= 0) ||
        (charlotteValue && charlotteValue <= 0)
      ) {
        setError("Target values must be greater than zero");
        return;
      }

      // Create new adjustment
      const newAdjustment: MonthlyTargetAdjustment = {
        month: selectedMonth,
        year: selectedYear,
        workingDays: [...workingDays].sort((a, b) => a - b), // Sort days in ascending order
        ...(austinValue && { austin: austinValue }),
        ...(charlotteValue && { charlotte: charlotteValue }),
        ...(agentCountValue && { agentCount: agentCountValue }),
      };

      // Update settings
      const newSettings = { ...currentSettings };

      if (editMode && editIndex >= 0) {
        // Update existing adjustment
        newSettings.monthlyAdjustments[editIndex] = newAdjustment;
      } else {
        // Check if there's already an adjustment for this month/year
        const existingIndex = newSettings.monthlyAdjustments.findIndex(
          (adj) => adj.month === selectedMonth && adj.year === selectedYear
        );

        if (existingIndex >= 0) {
          // Replace existing
          newSettings.monthlyAdjustments[existingIndex] = newAdjustment;
        } else {
          // Add new
          newSettings.monthlyAdjustments.push(newAdjustment);
        }
      }

      // Sort adjustments by year and month
      newSettings.monthlyAdjustments.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });

      onSettingsChange(newSettings);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setEditMode(false);
        setEditIndex(-1);
      }, 1500);
    } catch (err) {
      setError("An error occurred while saving the adjustment");
    }
  };

  const handleEditAdjustment = (index: number) => {
    const adjustment = currentSettings.monthlyAdjustments[index];
    setSelectedMonth(adjustment.month);
    setSelectedYear(adjustment.year);
    setWorkingDays(adjustment.workingDays);
    setAustinTarget(adjustment.austin?.toString() || "");
    setCharlotteTarget(adjustment.charlotte?.toString() || "");
    setAgentCount(adjustment.agentCount?.toString() || "");
    setEditMode(true);
    setEditIndex(index);
  };

  const handleDeleteAdjustment = (index: number) => {
    const newSettings = { ...currentSettings };
    newSettings.monthlyAdjustments.splice(index, 1);
    onSettingsChange(newSettings);
  };

  const handleDayToggle = (day: number) => {
    if (workingDays.includes(day)) {
      setWorkingDays(workingDays.filter((d) => d !== day));
    } else {
      setWorkingDays([...workingDays, day]);
    }
  };

  const handleSelectAllBusinessDays = () => {
    const businessDays = daysInSelectedMonth.filter((day) => !isWeekend(day));
    setWorkingDays(businessDays);
  };

  const handleClearAllDays = () => {
    setWorkingDays([]);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const getMonthName = (month: number) => {
    return new Date(2000, month, 1).toLocaleString("default", {
      month: "long",
    });
  };

  return (
    <>
      <Tooltip title="Monthly Target Adjustments">
        <IconButton
          color="primary"
          onClick={handleOpen}
          data-testid="monthly-settings-button"
        >
          <CalendarIcon />
        </IconButton>
      </Tooltip>

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography variant="h6">Monthly Target Adjustments</Typography>
            <IconButton onClick={handleClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Grid container spacing={3}>
            <Grid xs={12} md={8}>
              <Typography variant="body2" color="text.secondary" paragraph>
                Adjust targets for specific months to account for holidays,
                office closures, or other variations. Select working days and
                optionally override the daily targets for each location.
              </Typography>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Month</InputLabel>
                    <Select
                      value={selectedMonth}
                      label="Month"
                      onChange={(e) =>
                        setSelectedMonth(e.target.value as number)
                      }
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <MenuItem key={i} value={i}>
                          {getMonthName(i)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Year</InputLabel>
                    <Select
                      value={selectedYear}
                      label="Year"
                      onChange={(e) =>
                        setSelectedYear(e.target.value as number)
                      }
                    >
                      {years.map((year) => (
                        <MenuItem key={year} value={year}>
                          {year}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Typography variant="subtitle2" gutterBottom>
                Working Days
              </Typography>
              <Box
                sx={{ mb: 2, display: "flex", alignItems: "center", gap: 2 }}
              >
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleSelectAllBusinessDays}
                  startIcon={<CheckIcon />}
                >
                  Select Business Days
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleClearAllDays}
                  startIcon={<ClearIcon />}
                >
                  Clear All
                </Button>
                <Typography variant="body2" color="text.secondary">
                  {workingDays.length} days selected
                </Typography>
              </Box>

              {/* Calendar-like display */}
              <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={1} sx={{ mb: 1 }}>
                  {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                    <Grid xs={1.7} key={index} sx={{ textAlign: "center" }}>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: "bold",
                          color:
                            index === 0 || index === 6
                              ? "error.main"
                              : "text.primary",
                        }}
                      >
                        {day}
                      </Typography>
                    </Grid>
                  ))}
                </Grid>

                <Grid container spacing={1}>
                  {/* Empty cells for proper calendar alignment */}
                  {Array.from(
                    {
                      length: new Date(selectedYear, selectedMonth, 1).getDay(),
                    },
                    (_, i) => (
                      <Grid xs={1.7} key={`empty-${i}`} />
                    )
                  )}

                  {/* Day cells */}
                  {daysInSelectedMonth.map((day) => {
                    const date = new Date(selectedYear, selectedMonth, day);
                    const dayOfWeek = date.getDay();
                    const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
                    const isSelected = workingDays.includes(day);

                    return (
                      <Grid xs={1.7} key={day}>
                        <Button
                          fullWidth
                          variant={isSelected ? "contained" : "outlined"}
                          color={isSelected ? "primary" : "inherit"}
                          onClick={() => handleDayToggle(day)}
                          sx={{
                            borderColor: isWeekendDay
                              ? "error.light"
                              : undefined,
                            color:
                              isWeekendDay && !isSelected
                                ? "error.main"
                                : undefined,
                            backgroundColor:
                              isWeekendDay && !isSelected
                                ? "error.lighter"
                                : undefined,
                            minWidth: "36px",
                            height: "36px",
                            p: 0,
                          }}
                        >
                          {day}
                        </Button>
                      </Grid>
                    );
                  })}
                </Grid>
              </Paper>

              <Typography variant="subtitle2" gutterBottom>
                Target Overrides (Optional)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Leave blank to use the default daily targets: Austin (
                {formatCurrency(currentSettings.dailyTargets.austin)}),
                Charlotte (
                {formatCurrency(currentSettings.dailyTargets.charlotte)})
              </Typography>
              <Grid container spacing={2}>
                <Grid xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Austin Daily Target"
                    type="number"
                    value={austinTarget}
                    onChange={(e) => setAustinTarget(e.target.value)}
                    InputProps={{
                      startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
                    }}
                    placeholder={`Default: ${formatCurrency(
                      currentSettings.dailyTargets.austin
                    )}`}
                  />
                </Grid>
                <Grid xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Charlotte Daily Target"
                    type="number"
                    value={charlotteTarget}
                    onChange={(e) => setCharlotteTarget(e.target.value)}
                    InputProps={{
                      startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
                    }}
                    placeholder={`Default: ${formatCurrency(
                      currentSettings.dailyTargets.charlotte
                    )}`}
                  />
                </Grid>
              </Grid>
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                Additional Metrics (Optional)
              </Typography>
              <Grid container spacing={2}>
                <Grid xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Number of Agents"
                    type="number"
                    value={agentCount}
                    onChange={(e) => setAgentCount(e.target.value)}
                    placeholder="e.g., 15"
                  />
                </Grid>
              </Grid>
            </Grid>

            <Grid xs={12} md={4}>
              <Typography variant="subtitle2" gutterBottom>
                Existing Adjustments
              </Typography>
              {currentSettings.monthlyAdjustments.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No monthly adjustments have been added yet.
                </Typography>
              ) : (
                <TableContainer
                  component={Paper}
                  sx={{ maxHeight: 300, overflow: "auto" }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Month/Year</TableCell>
                        <TableCell>Working Days</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {currentSettings.monthlyAdjustments.map((adj, index) => (
                        <TableRow key={`${adj.month}-${adj.year}`}>
                          <TableCell>
                            {getMonthName(adj.month)} {adj.year}
                          </TableCell>
                          <TableCell>{adj.workingDays.length} days</TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={() => handleEditAdjustment(index)}
                              sx={{ mr: 1 }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteAdjustment(index)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Grid>
          </Grid>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {showSuccess && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Monthly adjustment saved successfully!
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
            {editMode ? "Update Adjustment" : "Save Adjustment"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
