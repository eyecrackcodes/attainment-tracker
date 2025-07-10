import React from "react";
import { Paper, Typography, Box, Divider } from "@mui/material";
import { formatCurrency } from "../utils/formatters";
import { TrendingUp, TrendingDown } from "@mui/icons-material";

interface MetricCardProps {
  title: string;
  revenue: number;
  target: number;
  monthlyTarget: number;
  attainment: number;
  elapsedDays?: number;
  remainingDays?: number;
  totalDays?: number;
  dailyPaceNeeded?: number;
  dailyTarget?: number;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  revenue,
  target,
  monthlyTarget,
  attainment,
  elapsedDays = 0,
  remainingDays = 0,
  totalDays = 0,
  dailyPaceNeeded = 0,
  dailyTarget = 0,
}) => {
  // Determine color based on attainment
  const getAttainmentColor = (value: number) => {
    if (value >= 100) return "success.main";
    if (value >= 90) return "warning.main";
    return "error.main";
  };

  // Determine daily pace status
  const getDailyPaceStatus = () => {
    if (remainingDays === 0) return null;

    const paceRatio = dailyPaceNeeded / dailyTarget;
    if (paceRatio <= 1) {
      return {
        icon: <TrendingDown color="success" />,
        color: "success.main",
        message: `On track - Daily pace needed (${formatCurrency(
          dailyPaceNeeded
        )}) is at or below daily target`,
      };
    } else if (paceRatio <= 1.25) {
      return {
        icon: <TrendingUp color="warning" />,
        color: "warning.main",
        message: `Caution - Need ${formatCurrency(
          dailyPaceNeeded
        )} per day (${Math.round((paceRatio - 1) * 100)}% above target)`,
      };
    } else {
      return {
        icon: <TrendingUp color="error" />,
        color: "error.main",
        message: `Alert - Need ${formatCurrency(
          dailyPaceNeeded
        )} per day (${Math.round((paceRatio - 1) * 100)}% above target)`,
      };
    }
  };

  const paceStatus = getDailyPaceStatus();

  return (
    <Paper elevation={2} sx={{ p: 2, height: "100%" }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Typography variant="h4" component="div" gutterBottom>
        {formatCurrency(revenue)}
      </Typography>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Monthly Target ({totalDays} days)
        </Typography>
        <Typography variant="h6">{formatCurrency(monthlyTarget)}</Typography>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          MTD Attainment ({elapsedDays} elapsed, {remainingDays} remaining)
        </Typography>
        <Typography variant="h6" sx={{ color: getAttainmentColor(attainment) }}>
          {attainment.toFixed(1)}%
        </Typography>
      </Box>

      {paceStatus && (
        <Box sx={{ mt: 2 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            Daily Pace Status {paceStatus.icon}
          </Typography>
          <Typography variant="body2" sx={{ color: paceStatus.color }}>
            {paceStatus.message}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default MetricCard;
