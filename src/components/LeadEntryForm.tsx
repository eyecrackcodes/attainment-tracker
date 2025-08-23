import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  MenuItem,
  Stack,
  Alert,
  Collapse,
  IconButton,
  InputAdornment,
  Chip,
  Divider,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  Close as CloseIcon,
  Save as SaveIcon,
  TrendingUp,
  TrendingDown,
  Groups,
  Assignment,
} from "@mui/icons-material";
import { format, parseISO, isAfter, isWeekend } from "date-fns";
import { leadService, SiteKey, LeadEntryStored } from "../services/leadService";

interface LeadEntryFormProps {
  defaultDate?: Date;
  onEntrySuccess?: () => void;
}

export const LeadEntryForm: React.FC<LeadEntryFormProps> = ({
  defaultDate = new Date(),
  onEntrySuccess,
}) => {
  const [date, setDate] = useState(format(defaultDate, "yyyy-MM-dd"));
  const [site, setSite] = useState<SiteKey>("ATX");
  const [availableAgents, setAvailableAgents] = useState("");
  const [totalBillableLeads, setTotalBillableLeads] = useState("");
  const [agentsMeetingMin, setAgentsMeetingMin] = useState("");
  const [openOrderZeroLeads, setOpenOrderZeroLeads] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingData, setExistingData] = useState<LeadEntryStored | null>(
    null
  );

  const minPerAgent = 8;
  const availableAgentsNum = parseFloat(availableAgents) || 0;
  const totalLeadsNum = parseFloat(totalBillableLeads) || 0;
  const targetLeads = availableAgentsNum * minPerAgent;
  const attainmentPct =
    targetLeads > 0 ? (totalLeadsNum / targetLeads) * 100 : 0;
  const agentsMeetingMinNum = parseFloat(agentsMeetingMin) || 0;
  const pctAgentsMeetingMin =
    availableAgentsNum > 0
      ? (agentsMeetingMinNum / availableAgentsNum) * 100
      : 0;

  // Check for existing data when date or site changes
  useEffect(() => {
    const loadExisting = async () => {
      try {
        const existing = await leadService.getLeadEntry(date, site);
        setExistingData(existing);

        if (existing) {
          setAvailableAgents(existing.availableAgents.toString());
          setTotalBillableLeads(existing.totalBillableLeads.toString());
          setAgentsMeetingMin(existing.agentsMeetingMin?.toString() || "");
          setOpenOrderZeroLeads(existing.openOrderZeroLeads?.toString() || "");
          setNotes(existing.notes || "");
        } else {
          // Clear form if no existing data
          setAvailableAgents("");
          setTotalBillableLeads("");
          setAgentsMeetingMin("");
          setOpenOrderZeroLeads("");
          setNotes("");
        }
      } catch (err) {
        console.error("Error loading existing data:", err);
      }
    };

    loadExisting();
  }, [date, site]);

  const isFormValid = () => {
    if (!availableAgents || !totalBillableLeads) return false;
    if (availableAgentsNum < 0 || totalLeadsNum < 0) return false;
    if (isAfter(parseISO(date), new Date())) return false;
    return true;
  };

  const getAttainmentColor = () => {
    if (attainmentPct >= 100) return "success.main";
    if (attainmentPct >= 80) return "warning.main";
    return "error.main";
  };

  const getAttainmentIcon = () => {
    if (attainmentPct >= 100) return <TrendingUp color="success" />;
    if (attainmentPct >= 80) return <TrendingUp color="warning" />;
    return <TrendingDown color="error" />;
  };

  const handleSave = async () => {
    if (!isFormValid()) return;

    setSaving(true);
    setError(null);
    setShowSuccess(false);

    try {
      await leadService.upsertLeadEntry({
        dateISO: date,
        site,
        availableAgents: availableAgentsNum,
        totalBillableLeads: totalLeadsNum,
        minPerAgent,
        agentsMeetingMin: agentsMeetingMin
          ? parseFloat(agentsMeetingMin)
          : undefined,
        openOrderZeroLeads: openOrderZeroLeads
          ? parseFloat(openOrderZeroLeads)
          : undefined,
        notes: notes || undefined,
      });

      setShowSuccess(true);
      if (onEntrySuccess) onEntrySuccess();

      // Reset form after 3 seconds
      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
    } catch (err) {
      console.error("Error saving lead entry:", err);
      setError("Failed to save lead entry. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
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
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Groups sx={{ color: "primary.main", fontSize: 28 }} />
          <Typography
            variant="h5"
            sx={{ fontWeight: 600, color: "text.primary" }}
          >
            Lead Attainment Entry
          </Typography>
          {existingData && (
            <Chip
              label="Existing Entry"
              color="info"
              size="small"
              sx={{ ml: 2 }}
            />
          )}
        </Stack>

        <Grid container spacing={3}>
          <Grid xs={12} md={3}>
            <TextField
              fullWidth
              type="date"
              label="Date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              error={isAfter(parseISO(date), new Date())}
              helperText={
                isAfter(parseISO(date), new Date())
                  ? "Cannot select future dates"
                  : isWeekend(parseISO(date))
                  ? "Weekend selected"
                  : ""
              }
            />
          </Grid>

          <Grid xs={12} md={3}>
            <TextField
              select
              fullWidth
              label="Site"
              value={site}
              onChange={(e) => setSite(e.target.value as SiteKey)}
            >
              <MenuItem value="ATX">Austin (ATX)</MenuItem>
              <MenuItem value="CLT">Charlotte (CLT)</MenuItem>
            </TextField>
          </Grid>

          <Grid xs={12} md={3}>
            <TextField
              fullWidth
              label="Available Agents"
              type="number"
              value={availableAgents}
              onChange={(e) => setAvailableAgents(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Groups fontSize="small" />
                  </InputAdornment>
                ),
              }}
              error={availableAgentsNum < 0}
              helperText={availableAgentsNum < 0 ? "Must be positive" : ""}
            />
          </Grid>

          <Grid xs={12} md={3}>
            <TextField
              fullWidth
              label="Total Billable Leads"
              type="number"
              value={totalBillableLeads}
              onChange={(e) => setTotalBillableLeads(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Assignment fontSize="small" />
                  </InputAdornment>
                ),
              }}
              error={totalLeadsNum < 0}
              helperText={totalLeadsNum < 0 ? "Must be positive" : ""}
            />
          </Grid>

          <Grid xs={12} md={3}>
            <TextField
              fullWidth
              label="Agents Meeting Min (≥8)"
              type="number"
              value={agentsMeetingMin}
              onChange={(e) => setAgentsMeetingMin(e.target.value)}
              helperText="Optional"
            />
          </Grid>

          <Grid xs={12} md={3}>
            <TextField
              fullWidth
              label="Absent Agents (0 Leads)"
              type="number"
              value={openOrderZeroLeads}
              onChange={(e) => setOpenOrderZeroLeads(e.target.value)}
              helperText="Optional"
            />
          </Grid>

          <Grid xs={12} md={6}>
            <TextField
              fullWidth
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              helperText="Optional"
              multiline
              rows={1}
            />
          </Grid>
        </Grid>

        {/* Metrics Display */}
        {(availableAgents || totalBillableLeads) && (
          <>
            <Divider />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, 1fr)",
                  md: "repeat(4, 1fr)",
                },
                gap: 2,
              }}
            >
              <Box sx={{ textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  Min per Agent
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {minPerAgent}
                </Typography>
              </Box>

              <Box sx={{ textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  Target Leads
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {targetLeads || "-"}
                </Typography>
              </Box>

              <Box sx={{ textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  Lead Attainment
                </Typography>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="center"
                  spacing={1}
                >
                  {getAttainmentIcon()}
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 600,
                      color: getAttainmentColor(),
                    }}
                  >
                    {targetLeads ? `${attainmentPct.toFixed(1)}%` : "-"}
                  </Typography>
                </Stack>
              </Box>

              {agentsMeetingMin && (
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="body2" color="text.secondary">
                    % Agents Meeting Min
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {availableAgentsNum
                      ? `${pctAgentsMeetingMin.toFixed(1)}%`
                      : "-"}
                  </Typography>
                </Box>
              )}
            </Box>
          </>
        )}

        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button
            variant="contained"
            color="primary"
            onClick={handleSave}
            disabled={!isFormValid() || saving}
            startIcon={<SaveIcon />}
          >
            {saving
              ? "Saving..."
              : existingData
              ? "Update Entry"
              : "Save Entry"}
          </Button>
        </Stack>

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
          >
            Lead attainment data {existingData ? "updated" : "saved"}{" "}
            successfully!
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
          >
            {error}
          </Alert>
        </Collapse>
      </Stack>
    </Paper>
  );
};
