import React from "react";
import { Paper, Typography, Box, Divider } from "@mui/material";
import { formatCurrency } from "../utils/formatters";

interface MetricCardProps {
  title: string;
  revenue: number;
  target: number;
  attainment: number;
  weeklyTarget?: number;
  elapsedDays?: number;
  totalDays?: number;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  revenue,
  target,
  attainment,
  weeklyTarget,
  elapsedDays,
  totalDays,
}) => {
  // Determine color based on attainment percentage
  const getAttainmentColor = (attainment: number) => {
    if (attainment >= 100) return "success.main";
    if (attainment >= 85) return "warning.main";
    return "error.main";
  };

  // Calculate daily average needed to hit target
  const remainingDays = totalDays ? totalDays - (elapsedDays || 0) : 0;
  const remainingRevenue = weeklyTarget ? weeklyTarget - revenue : 0;
  const dailyNeeded = remainingDays > 0 ? remainingRevenue / remainingDays : 0;

  return (
    <Paper elevation={1} sx={{ p: 2, height: "100%" }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Divider sx={{ mb: 2 }} />

      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          MTD Revenue
        </Typography>
        <Typography variant="h6">{formatCurrency(revenue)}</Typography>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Monthly Target ({elapsedDays} of {totalDays} days)
        </Typography>
        <Typography variant="h6">{formatCurrency(target)}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Daily Pace Needed: {formatCurrency(dailyNeeded)}
        </Typography>
      </Box>

      <Box>
        <Typography variant="body2" color="text.secondary">
          MTD Attainment
        </Typography>
        <Typography variant="h6" sx={{ color: getAttainmentColor(attainment) }}>
          {attainment.toFixed(1)}%
        </Typography>
      </Box>
    </Paper>
  );
};

export default MetricCard;
