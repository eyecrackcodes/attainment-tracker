import React from "react";
import { Paper, Typography, Box, Divider } from "@mui/material";
import { formatCurrency } from "../utils/formatters";

interface MetricCardProps {
  title: string;
  revenue: number;
  target: number;
  attainment: number;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  revenue,
  target,
  attainment,
}) => {
  // Determine color based on attainment percentage
  const getAttainmentColor = (attainment: number) => {
    if (attainment >= 100) return "success.main";
    if (attainment >= 85) return "warning.main";
    return "error.main";
  };

  return (
    <Paper elevation={1} sx={{ p: 2, height: "100%" }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Divider sx={{ mb: 2 }} />

      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Revenue
        </Typography>
        <Typography variant="h6">{formatCurrency(revenue)}</Typography>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Target
        </Typography>
        <Typography variant="h6">{formatCurrency(target)}</Typography>
      </Box>

      <Box>
        <Typography variant="body2" color="text.secondary">
          Attainment
        </Typography>
        <Typography variant="h6" sx={{ color: getAttainmentColor(attainment) }}>
          {attainment.toFixed(1)}%
        </Typography>
      </Box>
    </Paper>
  );
};

export default MetricCard;
