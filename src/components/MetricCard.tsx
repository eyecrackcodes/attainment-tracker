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
  totalDays?: number;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  revenue,
  target,
  monthlyTarget,
  attainment,
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
  const remainingRevenue = monthlyTarget - revenue;
  const dailyNeeded = remainingDays > 0 ? remainingRevenue / remainingDays : 0;
  const isAheadOfTarget = revenue >= target;
  const amountAhead = revenue - target;

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
        <Typography variant="h6">{formatCurrency(monthlyTarget)}</Typography>
        <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
          <Typography
            variant="body2"
            color={isAheadOfTarget ? "success.main" : "text.secondary"}
            sx={{ display: "flex", alignItems: "center" }}
          >
            {isAheadOfTarget ? (
              <>
                <TrendingUp sx={{ mr: 0.5, fontSize: "1rem" }} />
                Ahead by {formatCurrency(amountAhead)}
              </>
            ) : (
              <>
                <TrendingDown sx={{ mr: 0.5, fontSize: "1rem" }} />
                Daily Pace Needed: {formatCurrency(Math.abs(dailyNeeded))}
              </>
            )}
          </Typography>
        </Box>
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
