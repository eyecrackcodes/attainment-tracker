import React from "react";
import { Paper, Typography, Box, Divider } from "@mui/material";
import { formatCurrency } from "../utils/formatters";
import { calculateOptimizedAttainment } from "../utils/calculations";
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
  // Use optimized attainment calculation for consistency
  const optimizedAttainment = calculateOptimizedAttainment(revenue, target);
  
  // Determine color based on attainment percentage
  const getAttainmentColor = (attainment: number) => {
    if (attainment >= 100) return "success.main";
    if (attainment >= 85) return "warning.main";
    return "error.main";
  };

  // Calculate daily average needed to hit monthly target
  const remainingDays = totalDays ? totalDays - (elapsedDays || 0) : 0;
  const remainingRevenue = monthlyTarget - revenue;
  const dailyNeeded = remainingDays > 0 ? remainingRevenue / remainingDays : 0;
  const isAheadOfTarget = revenue >= target;
  const amountAhead = revenue - target;

  // Calculate monthly attainment percentage for additional context
  const monthlyAttainment = monthlyTarget > 0 ? calculateOptimizedAttainment(revenue, monthlyTarget) : 0;

  return (
    <Paper 
      elevation={1} 
      sx={{ 
        p: 3, 
        height: "100%",
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          elevation: 3,
          borderColor: 'primary.light',
          transform: 'translateY(-2px)'
        }
      }}
    >
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'text.primary' }}>
        {title}
      </Typography>
      <Divider sx={{ mb: 3, borderColor: 'divider' }} />

      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
          MTD Revenue
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
          {formatCurrency(revenue)}
        </Typography>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
          Monthly Target ({elapsedDays} of {totalDays} days) - {monthlyAttainment.toFixed(1)}% Complete
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
          {formatCurrency(monthlyTarget)}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", mt: 1.5, p: 1.5, borderRadius: 1, bgcolor: isAheadOfTarget ? 'success.light' : 'warning.light', opacity: 0.8 }}>
          <Typography
            variant="body2"
            color={isAheadOfTarget ? "success.dark" : "warning.dark"}
            sx={{ display: "flex", alignItems: "center", fontWeight: 500 }}
          >
            {isAheadOfTarget ? (
              <>
                <TrendingUp sx={{ mr: 0.5, fontSize: "1.1rem" }} />
                Ahead by {formatCurrency(amountAhead)}
              </>
            ) : (
              <>
                <TrendingDown sx={{ mr: 0.5, fontSize: "1.1rem" }} />
                Daily Pace Needed: {formatCurrency(Math.abs(dailyNeeded))}
              </>
            )}
          </Typography>
        </Box>
      </Box>

      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
          MTD Attainment (vs. On-Pace Target)
        </Typography>
        <Typography variant="h5" sx={{ color: getAttainmentColor(optimizedAttainment), fontWeight: 700 }}>
          {optimizedAttainment.toFixed(1)}%
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontStyle: 'italic' }}>
          On-Pace Target: {formatCurrency(target)}
        </Typography>
      </Box>
    </Paper>
  );
};

export default MetricCard;
