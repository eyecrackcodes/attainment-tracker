import React from "react";
import { Grid, Paper, Typography, Box, Divider } from "@mui/material";
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
} from "@mui/icons-material";
import { RevenueData, TimeFrame, TargetSettings } from "../types/revenue";
import {
  calculateTrend,
  calculateMetrics,
  filterDataByTimeFrame,
  calculateLocationMetrics,
} from "../utils/calculations";
import MetricCard from "./MetricCard";

interface SummaryMetricsProps {
  data: RevenueData[];
  timeFrame: TimeFrame;
  targetSettings?: TargetSettings;
  startDate?: string | null;
  endDate?: string | null;
  location?: string;
}

const SummaryMetrics: React.FC<SummaryMetricsProps> = ({
  data,
  timeFrame,
  targetSettings,
  startDate,
  endDate,
  location,
}) => {
  const filteredData = filterDataByTimeFrame(
    data,
    timeFrame,
    undefined,
    targetSettings,
    startDate,
    endDate,
    location
  );
  const metrics = calculateLocationMetrics(
    filteredData,
    targetSettings,
    location,
    timeFrame
  );

  return (
    <Paper 
      elevation={2} 
      sx={{ 
        p: 4, 
        mb: 3,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
      }}
    >
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: 'text.primary', mb: 3 }}>
        Summary Metrics
      </Typography>
      <Divider sx={{ mb: 3, borderColor: 'divider' }} />
      <Grid container spacing={4}>
        <Grid item xs={12} md={4}>
          <MetricCard
            title="Austin"
            revenue={metrics.austin.revenue}
            target={metrics.austin.target}
            monthlyTarget={metrics.austin.monthlyTarget}
            attainment={metrics.austin.attainment}
            elapsedDays={metrics.austin.elapsedDays}
            totalDays={metrics.austin.totalDays}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <MetricCard
            title="Charlotte"
            revenue={metrics.charlotte.revenue}
            target={metrics.charlotte.target}
            monthlyTarget={metrics.charlotte.monthlyTarget}
            attainment={metrics.charlotte.attainment}
            elapsedDays={metrics.charlotte.elapsedDays}
            totalDays={metrics.charlotte.totalDays}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <MetricCard
            title="Total"
            revenue={metrics.total.revenue}
            target={metrics.total.target}
            monthlyTarget={metrics.total.monthlyTarget}
            attainment={metrics.total.attainment}
            elapsedDays={metrics.total.elapsedDays}
            totalDays={metrics.total.totalDays}
          />
        </Grid>
      </Grid>
    </Paper>
  );
};

export default SummaryMetrics;
