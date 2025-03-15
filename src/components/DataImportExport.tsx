import React, { useRef } from "react";
import { Box, Button, Stack } from "@mui/material";
import { CloudUpload, CloudDownload, Description } from "@mui/icons-material";
import { RevenueData } from "../types/revenue";
import { importCSV, exportCSV, generateTemplate } from "../services/csvHandler";

interface DataImportExportProps {
  onDataUpdate: (data: RevenueData[]) => void;
  currentData: RevenueData[];
}

export const DataImportExport: React.FC<DataImportExportProps> = ({
  onDataUpdate,
  currentData,
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
          Export CSV
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
