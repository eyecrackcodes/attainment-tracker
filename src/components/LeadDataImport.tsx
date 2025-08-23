import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Typography,
  Stack,
  Alert,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
} from "@mui/material";
import {
  Upload as UploadIcon,
  FileUpload,
  Info as InfoIcon,
  Warning as WarningIcon,
} from "@mui/icons-material";
import Papa from "papaparse";
import { leadService, SiteKey } from "../services/leadService";
import { isBusinessDay } from "../utils/calculations";
import { parseISO } from "date-fns";

interface LeadCSVRow {
  agent_name?: string;
  billable_leads?: string | number;
  open_order?: string | boolean;
  [key: string]: any;
}

interface ProcessedLeadData {
  availableAgents: number;
  totalBillableLeads: number;
  agentsMeetingMin: number;
  openOrderZeroLeads: number;
  agentDetails: {
    name: string;
    leads: number;
    hasOpenOrder: boolean;
    meetsMin: boolean;
  }[];
}

interface ExistingDataStatus {
  ATX: boolean;
  CLT: boolean;
}

export const LeadDataImport: React.FC = () => {
  const [showDialog, setShowDialog] = useState(false);
  const [csvData, setCsvData] = useState<ProcessedLeadData | null>(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [selectedSite, setSelectedSite] = useState<SiteKey>("ATX");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingData, setExistingData] = useState<ExistingDataStatus>({
    ATX: false,
    CLT: false,
  });

  // Check for existing data when date changes
  useEffect(() => {
    const checkExistingData = async () => {
      const [atxData, cltData] = await Promise.all([
        leadService.getLeadEntry(selectedDate, "ATX"),
        leadService.getLeadEntry(selectedDate, "CLT"),
      ]);

      setExistingData({
        ATX: !!atxData,
        CLT: !!cltData,
      });
    };

    checkExistingData();
  }, [selectedDate]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(false);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const processed = processCSVData(results.data as LeadCSVRow[]);
          setCsvData(processed);
          setShowDialog(true);
        } catch (err) {
          setError(`Error processing CSV: ${err}`);
        }
      },
      error: (err) => {
        setError(`Error reading CSV: ${err.message}`);
      },
    });

    // Reset file input
    event.target.value = "";
  };

  const processCSVData = (rows: LeadCSVRow[]): ProcessedLeadData => {
    const agentDetails = rows.map((row) => {
      // Try different column name variations for billable leads
      const leadsValue =
        row.billable_leads ||
        row["Billable Leads"] ||
        row["billable_leads"] ||
        row["Leads"] ||
        "";

      // Parse leads - empty/null means 0 (absent)
      const leads =
        leadsValue === "" || leadsValue === null || leadsValue === undefined
          ? 0
          : parseInt(String(leadsValue)) || 0;

      // All agents in the CSV have open orders (inferred by being in the list)
      const hasOpenOrder = true;

      const name =
        row.agent_name ||
        row["Agent Name"] ||
        row["agent_name"] ||
        row["Name"] ||
        "Unknown";

      return {
        name,
        leads,
        hasOpenOrder,
        meetsMin: leads >= 8,
      };
    });

    // Calculate metrics according to the rules
    // All agents in CSV are available agents
    const availableAgents = agentDetails.length;

    const totalBillableLeads = agentDetails.reduce(
      (sum, agent) => sum + agent.leads,
      0
    );

    const agentsMeetingMin = agentDetails.filter(
      (agent) => agent.leads >= 8
    ).length;

    // Absent agents are those with 0 leads (which includes empty/null)
    const openOrderZeroLeads = agentDetails.filter(
      (agent) => agent.leads === 0
    ).length;

    return {
      availableAgents,
      totalBillableLeads,
      agentsMeetingMin,
      openOrderZeroLeads,
      agentDetails,
    };
  };

  const handleSave = async () => {
    if (!csvData) return;

    // Validate business day
    if (!isBusinessDay(parseISO(selectedDate))) {
      setError(
        "Cannot save data for weekend days. Please select a business day."
      );
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await leadService.upsertLeadEntry({
        dateISO: selectedDate,
        site: selectedSite,
        availableAgents: csvData.availableAgents,
        totalBillableLeads: csvData.totalBillableLeads,
        agentsMeetingMin: csvData.agentsMeetingMin,
        openOrderZeroLeads: csvData.openOrderZeroLeads,
        notes: "Imported from CSV",
      });

      setSuccess(true);
      setShowDialog(false);
      setCsvData(null);

      // Show success message for 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(`Error saving data: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setShowDialog(false);
    setCsvData(null);
  };

  return (
    <>
      <Card
        elevation={0}
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <CardContent>
          <Stack spacing={3}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <FileUpload sx={{ color: "primary.main" }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Import Lead Data from CSV
              </Typography>
            </Stack>

            <Alert severity="info" icon={<InfoIcon />}>
              <Stack spacing={1}>
                <Typography variant="body2">
                  Upload a CSV file with columns: <strong>agent_name</strong>{" "}
                  and <strong>billable_leads</strong>
                </Typography>
                <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                  • All agents in the CSV are considered to have open orders
                </Typography>
                <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                  • Empty or null billable_leads indicates an absent agent (0
                  leads)
                </Typography>
              </Stack>
            </Alert>

            <Box>
              <input
                accept=".csv"
                style={{ display: "none" }}
                id="lead-csv-upload"
                type="file"
                onChange={handleFileUpload}
              />
              <label htmlFor="lead-csv-upload">
                <Button
                  variant="contained"
                  component="span"
                  startIcon={<UploadIcon />}
                  fullWidth
                >
                  Upload CSV File
                </Button>
              </label>
            </Box>

            {error && <Alert severity="error">{error}</Alert>}
            {success && (
              <Alert severity="success">Lead data imported successfully!</Alert>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showDialog} onClose={handleCancel} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography variant="h6">CSV Import Preview</Typography>
          </Stack>
        </DialogTitle>

        <DialogContent>
          <Stack spacing={3}>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                error={!isBusinessDay(parseISO(selectedDate))}
                helperText={
                  !isBusinessDay(parseISO(selectedDate))
                    ? "Weekend selected - data can only be entered for business days"
                    : ""
                }
                sx={{ flex: 1 }}
              />
              <TextField
                select
                label="Site"
                value={selectedSite}
                onChange={(e) => setSelectedSite(e.target.value as SiteKey)}
                sx={{ flex: 1 }}
              >
                <MenuItem value="ATX">
                  Austin (ATX){" "}
                  {existingData.ATX && (
                    <Chip
                      label="Has Data"
                      size="small"
                      color="warning"
                      sx={{ ml: 1 }}
                    />
                  )}
                </MenuItem>
                <MenuItem value="CLT">
                  Charlotte (CLT){" "}
                  {existingData.CLT && (
                    <Chip
                      label="Has Data"
                      size="small"
                      color="warning"
                      sx={{ ml: 1 }}
                    />
                  )}
                </MenuItem>
              </TextField>
            </Stack>

            {existingData[selectedSite] && (
              <Alert severity="warning" icon={<WarningIcon />}>
                <Typography variant="body2">
                  Data already exists for {selectedSite} on {selectedDate}.
                  Importing will overwrite the existing data.
                </Typography>
              </Alert>
            )}

            {csvData && (
              <>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: 2,
                    p: 2,
                    bgcolor: "background.paper",
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Available Agents
                    </Typography>
                    <Typography variant="h6">
                      {csvData.availableAgents}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Total Billable Leads
                    </Typography>
                    <Typography variant="h6">
                      {csvData.totalBillableLeads}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Agents Meeting Min (≥8)
                    </Typography>
                    <Typography variant="h6">
                      {csvData.agentsMeetingMin}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Absent Agents
                    </Typography>
                    <Typography variant="h6">
                      {csvData.openOrderZeroLeads}
                    </Typography>
                  </Box>
                </Box>

                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ mb: 1, fontWeight: 600 }}
                  >
                    Agent Details (First 10)
                  </Typography>
                  <TableContainer
                    component={Paper}
                    variant="outlined"
                    sx={{ maxHeight: 300 }}
                  >
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Agent Name</TableCell>
                          <TableCell align="right">Billable Leads</TableCell>
                          <TableCell align="center">Open Order</TableCell>
                          <TableCell align="center">Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {csvData.agentDetails.slice(0, 10).map((agent, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{agent.name}</TableCell>
                            <TableCell align="right">{agent.leads}</TableCell>
                            <TableCell align="center">
                              <Chip label="Yes" size="small" color="info" />
                            </TableCell>
                            <TableCell align="center">
                              {agent.meetsMin && (
                                <Chip label="≥8" size="small" color="success" />
                              )}
                              {agent.leads === 0 && (
                                <Chip
                                  label="Absent"
                                  size="small"
                                  color="warning"
                                />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {csvData.agentDetails.length > 10 && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1 }}
                    >
                      ... and {csvData.agentDetails.length - 10} more agents
                    </Typography>
                  )}
                </Box>
              </>
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={
              !csvData || saving || !isBusinessDay(parseISO(selectedDate))
            }
          >
            {saving ? "Saving..." : "Import Data"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
