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
  mappedColumns?: {
    nameColumn?: string;
    leadsColumn?: string;
  };
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

    // Don't reset file input here - it causes issues with re-importing
  };

  const processCSVData = (rows: LeadCSVRow[]): ProcessedLeadData => {
    // Track which columns were found
    let nameColumn: string | undefined;
    let leadsColumn: string | undefined;

    // If we have at least one row, detect columns from headers
    if (rows.length > 0) {
      const firstRow = rows[0];
      const headers = Object.keys(firstRow);

      // Find name column - check headers case-insensitively
      const nameVariations = ["agent_name", "agent name", "name", "agent", "employee", "employee name", "employee_name"];
      for (const header of headers) {
        const headerLower = header.toLowerCase().trim();
        if (nameVariations.some(variation => headerLower === variation || headerLower.includes(variation))) {
          nameColumn = header;
          break;
        }
      }

      // Find leads column - check headers case-insensitively  
      const leadsVariations = ["billable_leads", "billable leads", "leads", "billable", "total leads", "total_leads"];
      for (const header of headers) {
        const headerLower = header.toLowerCase().trim();
        if (leadsVariations.some(variation => headerLower === variation || headerLower.includes(variation))) {
          leadsColumn = header;
          break;
        }
      }

      // If we couldn't find columns by name matching, try to detect by content
      if (!nameColumn || !leadsColumn) {
        // Check if any column has text values (likely names)
        if (!nameColumn) {
          for (const header of headers) {
            const value = firstRow[header];
            if (value && isNaN(Number(value)) && String(value).trim().length > 0) {
              nameColumn = header;
              break;
            }
          }
        }
        
        // Check if any column has numeric values (likely leads)
        if (!leadsColumn) {
          for (const header of headers) {
            const value = firstRow[header];
            if (value !== undefined && value !== null && !isNaN(Number(value))) {
              leadsColumn = header;
              break;
            }
          }
        }
      }
    }

    const agentDetails = rows.map((row) => {
      // Use the detected column names
      const name = nameColumn ? String(row[nameColumn] || "Unknown").trim() : "Unknown";
      const leadsValue = leadsColumn ? row[leadsColumn] : "";

      // Parse leads - empty/null means 0 (absent)
      const leads =
        leadsValue === "" || leadsValue === null || leadsValue === undefined
          ? 0
          : parseInt(String(leadsValue)) || 0;

      // All agents in the CSV have open orders (inferred by being in the list)
      const hasOpenOrder = true;

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
    const absentAgents = agentDetails.filter(
      (agent) => agent.leads === 0
    ).length;

    const openOrderZeroLeads = absentAgents; // Same value for CSV imports

    return {
      availableAgents,
      totalBillableLeads,
      agentsMeetingMin,
      absentAgents,
      openOrderZeroLeads,
      agentDetails,
      mappedColumns: {
        nameColumn,
        leadsColumn,
      },
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
      // Don't clear CSV data after successful save
      // setCsvData(null);

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
    // Keep CSV data in case user wants to reopen dialog
    // setCsvData(null);
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
                  Upload a CSV file with agent names and billable leads columns.
                </Typography>
                <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                  Supported column names:
                </Typography>
                <Typography variant="body2" sx={{ fontSize: "0.8rem", ml: 2 }}>
                  • Names: agent_name, Agent Name, Name, Agent, Employee,
                  Employee Name
                </Typography>
                <Typography variant="body2" sx={{ fontSize: "0.8rem", ml: 2 }}>
                  • Leads: billable_leads, Billable Leads, Leads, Billable,
                  Total Leads
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontSize: "0.875rem", mt: 1 }}
                >
                  • All agents in the CSV are considered to have open orders
                </Typography>
                <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                  • Empty or null billable_leads indicates an absent agent (0
                  leads)
                </Typography>
              </Stack>
            </Alert>

            <Stack direction="row" spacing={2}>
              <Box flex={1}>
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
                    {csvData ? "Upload New CSV" : "Upload CSV File"}
                  </Button>
                </label>
              </Box>
              {csvData && (
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={() => {
                    setCsvData(null);
                    // Clear the file input
                    const fileInput = document.getElementById(
                      "lead-csv-upload"
                    ) as HTMLInputElement;
                    if (fileInput) fileInput.value = "";
                  }}
                >
                  Clear Data
                </Button>
              )}
            </Stack>

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

            {csvData && !showDialog && (
              <Stack spacing={2} sx={{ mt: 2 }}>
                <Alert severity="info">
                  <Typography variant="body2">
                    CSV data loaded with {csvData.availableAgents} agents and{" "}
                    {csvData.totalBillableLeads} total leads.
                  </Typography>
                </Alert>
                <Button
                  variant="outlined"
                  onClick={() => setShowDialog(true)}
                  fullWidth
                >
                  Review and Import Data
                </Button>
              </Stack>
            )}

            {csvData && (
              <>
                {csvData.mappedColumns && (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      Mapped columns:
                      {csvData.mappedColumns.nameColumn && (
                        <>
                          {" "}
                          Names from "
                          <strong>{csvData.mappedColumns.nameColumn}</strong>"
                        </>
                      )}
                      {csvData.mappedColumns.nameColumn &&
                        csvData.mappedColumns.leadsColumn &&
                        " and "}
                      {csvData.mappedColumns.leadsColumn && (
                        <>
                          Leads from "
                          <strong>{csvData.mappedColumns.leadsColumn}</strong>"
                        </>
                      )}
                    </Typography>
                  </Alert>
                )}

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
