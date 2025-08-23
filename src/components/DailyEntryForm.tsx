import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  Collapse,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableRow,
  InputAdornment,
  Stack,
} from "@mui/material";
import {
  Close as CloseIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Save as SaveIcon,
} from "@mui/icons-material";
import { RevenueData, TargetSettings } from "../types/revenue";
import { isBusinessDay, getTargetForDate } from "../utils/calculations";
import { parseISO, format } from "date-fns";

interface DailyEntryFormProps {
  onSubmit: (data: RevenueData) => Promise<void>;
  existingData: RevenueData[];
  targets: TargetSettings;
}

export const DailyEntryForm: React.FC<DailyEntryFormProps> = ({
  onSubmit,
  existingData,
  targets,
}) => {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [austinRevenue, setAustinRevenue] = useState("");
  const [charlotteRevenue, setCharlotteRevenue] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [existingEntry, setExistingEntry] = useState<RevenueData | null>(null);
  const [warnings, setWarnings] = useState<{
    austin: { message: string; type: "success" | "error" | "warning" | null };
    charlotte: {
      message: string;
      type: "success" | "error" | "warning" | null;
    };
    future: { message: string; type: "error" | null };
    weekend: { message: string; type: "error" | null };
  }>({
    austin: { message: "", type: null },
    charlotte: { message: "", type: null },
    future: { message: "", type: null },
    weekend: { message: "", type: null },
  });
  const [submitting, setSubmitting] = useState(false);

  // Check for existing data and validate whenever date or revenue values change
  useEffect(() => {
    const existing = existingData?.find((entry) => entry.date === date) ?? null;
    setExistingEntry(existing);

    // Only validate if we have targets
    if (targets) {
      const dateObj = new Date(date);
      const austinValue = parseFloat(austinRevenue);
      const charlotteValue = parseFloat(charlotteRevenue);

      const austinWarning = !isNaN(austinValue)
        ? validateEntry(austinValue, "austin", dateObj)
        : null;
      const charlotteWarning = !isNaN(charlotteValue)
        ? validateEntry(charlotteValue, "charlotte", dateObj)
        : null;

      setWarnings((prevWarnings) => ({
        ...prevWarnings,
        austin: {
          message: austinWarning || "",
          type: austinWarning
            ? austinWarning.includes("Warning")
              ? "warning"
              : "success"
            : null,
        },
        charlotte: {
          message: charlotteWarning || "",
          type: charlotteWarning
            ? charlotteWarning.includes("Warning")
              ? "warning"
              : "success"
            : null,
        },
      }));
    }
  }, [date, austinRevenue, charlotteRevenue, existingData, targets]);

  // Validate entry against targets
  const validateEntry = (
    value: number,
    location: "austin" | "charlotte",
    date: Date
  ): string | null => {
    if (value <= 0 || !targets) return null;

    const dailyTarget = getTargetForDate(date, targets);
    const target =
      location === "austin" ? dailyTarget.austin : dailyTarget.charlotte;

    // Skip validation for non-working days
    if (target === 0) return null;

    const attainment = (value / target) * 100;

    if (attainment < 75) {
      return `Warning: ${attainment.toFixed(1)}% of target`;
    } else if (attainment > 125) {
      return `High: ${attainment.toFixed(1)}% of target`;
    }

    return null;
  };

  const getHelperTextColor = (type: "success" | "error" | "warning" | null) => {
    switch (type) {
      case "success":
        return "success.main";
      case "error":
        return "error.main";
      case "warning":
        return "warning.main";
      default:
        return "text.secondary";
    }
  };

  const getInputProps = (type: "success" | "error" | "warning" | null) => {
    if (type === "success") {
      return {
        endAdornment: (
          <InputAdornment position="end">
            <CheckCircleIcon color="success" />
          </InputAdornment>
        ),
      };
    } else if (type === "error") {
      return {
        endAdornment: (
          <InputAdornment position="end">
            <ErrorIcon color="error" />
          </InputAdornment>
        ),
      };
    } else if (type === "warning") {
      return {
        endAdornment: (
          <InputAdornment position="end">
            <WarningIcon color="warning" />
          </InputAdornment>
        ),
      };
    }
    return {};
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setShowSuccess(false);

    // Validate date
    if (!isBusinessDay(parseISO(date))) {
      setError("Cannot add revenue for weekend days (non-working days)");
      return;
    }

    // Validate inputs
    const austinValue = parseFloat(austinRevenue);
    const charlotteValue = parseFloat(charlotteRevenue);

    if (isNaN(austinValue) || isNaN(charlotteValue)) {
      setError("Revenue values must be valid numbers");
      return;
    }

    if (austinValue < 0 || charlotteValue < 0) {
      setError("Revenue values cannot be negative");
      return;
    }

    // Check if entry already exists
    if (existingEntry) {
      setShowOverwriteDialog(true);
      return;
    }

    setSubmitting(true);

    try {
      const newEntry: RevenueData = {
        date,
        austin: austinValue,
        charlotte: charlotteValue,
      };

      await onSubmit(newEntry);
      setShowSuccess(true);
      resetForm();
    } catch (err) {
      setError("Failed to add data. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOverwriteConfirm = async () => {
    setShowOverwriteDialog(false);
    setSubmitting(true);

    try {
      const newEntry: RevenueData = {
        date,
        austin: parseFloat(austinRevenue),
        charlotte: parseFloat(charlotteRevenue),
      };

      await onSubmit(newEntry);
      setShowSuccess(true);
      resetForm();
    } catch (err) {
      setError("Failed to update data. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOverwriteCancel = () => {
    setShowOverwriteDialog(false);
    setSubmitting(false);
  };

  const resetForm = () => {
    setAustinRevenue("");
    setCharlotteRevenue("");
    setDate(new Date().toISOString().split("T")[0]);
    setError(null);
    setShowSuccess(false);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const isFormValid = () => {
    const austinValue = parseFloat(austinRevenue);
    const charlotteValue = parseFloat(charlotteRevenue);

    if (
      isNaN(austinValue) ||
      isNaN(charlotteValue) ||
      austinValue < 0 ||
      charlotteValue < 0
    ) {
      return false;
    }

    if (warnings.future.type === "error" || warnings.weekend.type === "error") {
      return false;
    }

    return true;
  };

  return (
    <>
      <Paper
        elevation={2}
        sx={{
          p: 4,
          mb: 3,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
        }}
      >
        <Typography
          variant="h5"
          gutterBottom
          sx={{ fontWeight: 600, color: "text.primary", mb: 3 }}
        >
          Daily Revenue Entry
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid xs={12} sm={4}>
              <TextField
                fullWidth
                type="date"
                label="Date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                error={
                  warnings.future.type === "error" ||
                  warnings.weekend.type === "error"
                }
                helperText={warnings.future.message || warnings.weekend.message}
                FormHelperTextProps={{
                  sx: {
                    color: getHelperTextColor(
                      warnings.future.type || warnings.weekend.type
                    ),
                  },
                }}
              />
            </Grid>

            <Grid xs={12} sm={4}>
              <TextField
                fullWidth
                label="Austin Revenue"
                type="number"
                value={austinRevenue}
                onChange={(e) => setAustinRevenue(e.target.value)}
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
                  ...getInputProps(warnings.austin.type),
                }}
                helperText={warnings.austin.message}
                FormHelperTextProps={{
                  sx: { color: getHelperTextColor(warnings.austin.type) },
                }}
              />
            </Grid>

            <Grid xs={12} sm={4}>
              <TextField
                fullWidth
                label="Charlotte Revenue"
                type="number"
                value={charlotteRevenue}
                onChange={(e) => setCharlotteRevenue(e.target.value)}
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
                  ...getInputProps(warnings.charlotte.type),
                }}
                helperText={warnings.charlotte.message}
                FormHelperTextProps={{
                  sx: { color: getHelperTextColor(warnings.charlotte.type) },
                }}
              />
            </Grid>

            {existingEntry && (
              <Grid item xs={12}>
                <Alert severity="warning" icon={<WarningIcon />} sx={{ mt: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Existing data found for this date:
                  </Typography>
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell>Austin Revenue:</TableCell>
                        <TableCell>
                          {formatCurrency(existingEntry.austin)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Charlotte Revenue:</TableCell>
                        <TableCell>
                          {formatCurrency(existingEntry.charlotte)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Alert>
              </Grid>
            )}

            <Grid xs={12}>
              <Stack direction="row" spacing={2} justifyContent="flex-end">
                <Button
                  variant="contained"
                  color="primary"
                  type="submit"
                  disabled={!isFormValid() || submitting}
                  startIcon={<SaveIcon />}
                >
                  Save Entry
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Box>

        {/* Success Message */}
        <Collapse in={showSuccess}>
          <Alert
            severity="success"
            action={
              <IconButton
                aria-label="close"
                color="inherit"
                size="small"
                onClick={() => setShowSuccess(false)}
              >
                <CloseIcon fontSize="inherit" />
              </IconButton>
            }
            sx={{ mt: 2 }}
          >
            Revenue data added successfully!
          </Alert>
        </Collapse>

        {/* Error Message */}
        <Collapse in={!!error}>
          <Alert
            severity="error"
            action={
              <IconButton
                aria-label="close"
                color="inherit"
                size="small"
                onClick={() => setError(null)}
              >
                <CloseIcon fontSize="inherit" />
              </IconButton>
            }
            sx={{ mt: 2 }}
          >
            {error}
          </Alert>
        </Collapse>
      </Paper>

      {/* Overwrite Confirmation Dialog */}
      <Dialog open={showOverwriteDialog} onClose={handleOverwriteCancel}>
        <DialogTitle>Overwrite Existing Entry?</DialogTitle>
        <DialogContent>
          <Typography>
            An entry already exists for {date}. Do you want to overwrite it?
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Existing Data:
            </Typography>
            <Grid container spacing={2}>
              <Grid xs={6}>
                <Typography>
                  Austin: {formatCurrency(Number(existingEntry?.austin || 0))}
                </Typography>
              </Grid>
              <Grid xs={6}>
                <Typography>
                  Charlotte:{" "}
                  {formatCurrency(Number(existingEntry?.charlotte || 0))}
                </Typography>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleOverwriteCancel} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleOverwriteConfirm}
            color="primary"
            variant="contained"
          >
            Overwrite
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
