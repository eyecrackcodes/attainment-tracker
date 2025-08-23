import React, { useRef } from "react";
import { Box, Button, Stack } from "@mui/material";
import { CloudUpload, CloudDownload, Description, Assessment } from "@mui/icons-material";
import { RevenueData, TargetSettings } from "../types/revenue";
import { importCSV, exportCSV, generateTemplate, exportAnalyticsReport } from "../services/csvHandler";

interface DataImportExportProps {
  onDataUpdate: (data: RevenueData[]) => void;
  currentData: RevenueData[];
  targetSettings?: TargetSettings;
}

export const DataImportExport: React.FC<DataImportExportProps> = ({
  onDataUpdate,
  currentData,
  targetSettings,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await importCSV(file);
      onDataUpdate(data);
    } catch (error) {
      alert("Error importing CSV file. Please check the file format.");
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleExport = () => {
    if (currentData.length === 0) {
      alert("No data to export.");
      return;
    }
    exportCSV(currentData);
  };

  const handleAnalyticsExport = () => {
    if (currentData.length === 0) {
      alert("No data available for analytics export.");
      return;
    }
    if (!targetSettings) {
      alert("Target settings not available for analytics export.");
      return;
    }
    exportAnalyticsReport(currentData, targetSettings);
  };

  const handleGenerateTemplate = () => {
    generateTemplate();
  };

  return (
    <Box>
      <Stack spacing={2}>
        <input
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          ref={fileInputRef}
          onChange={handleFileSelect}
        />

        <Button
          variant="contained"
          startIcon={<CloudUpload />}
          onClick={() => fileInputRef.current?.click()}
          fullWidth
        >
          Import CSV
        </Button>

        <Button
          variant="outlined"
          startIcon={<CloudDownload />}
          onClick={handleExport}
          fullWidth
          disabled={currentData.length === 0}
        >
          Export Data CSV
        </Button>

        <Button
          variant="outlined"
          startIcon={<Assessment />}
          onClick={handleAnalyticsExport}
          fullWidth
          disabled={currentData.length === 0 || !targetSettings}
          color="secondary"
        >
          Export Analytics Report
        </Button>

        <Button
          variant="outlined"
          startIcon={<Description />}
          onClick={handleGenerateTemplate}
          fullWidth
        >
          Download Template
        </Button>
      </Stack>
    </Box>
  );
};
