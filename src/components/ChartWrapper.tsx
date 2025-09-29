import React from "react";
import { Box, Paper } from "@mui/material";

interface ChartWrapperProps {
  children: React.ReactNode;
  height?: number;
}

export const ChartWrapper: React.FC<ChartWrapperProps> = ({
  children,
  height = 400,
}) => {
  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        mb: 3,
        width: "100%",
        height: height + 60, // Account for padding
        display: "block",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          width: "100%",
          height: height,
          position: "relative",
          display: "block",
        }}
      >
        {children}
      </Box>
    </Paper>
  );
};
