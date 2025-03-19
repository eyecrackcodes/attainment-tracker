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
  const metrics = calculateLocationMetrics(filteredData, targetSettings, location);

  return (
    <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Summary Metrics
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <MetricCard
            title="Austin"
            revenue={metrics.austin.revenue}
            target={metrics.austin.target}
            attainment={metrics.austin.attainment}
            weeklyTarget={metrics.austin.weeklyTarget}
            elapsedDays={metrics.austin.elapsedDays}
            totalDays={metrics.austin.totalDays}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <MetricCard
            title="Charlotte"
            revenue={metrics.charlotte.revenue}
            target={metrics.charlotte.target}
            attainment={metrics.charlotte.attainment}
            weeklyTarget={metrics.charlotte.weeklyTarget}
            elapsedDays={metrics.charlotte.elapsedDays}
            totalDays={metrics.charlotte.totalDays}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <MetricCard
            title="Total"
            revenue={metrics.total.revenue}
            target={metrics.total.target}
            attainment={metrics.total.attainment}
            weeklyTarget={metrics.total.weeklyTarget}
            elapsedDays={metrics.total.elapsedDays}
            totalDays={metrics.total.totalDays}
          />
        </Grid>
      </Grid>
    </Paper>
  );
};

export default SummaryMetrics;
