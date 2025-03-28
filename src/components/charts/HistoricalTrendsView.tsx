import React, { useMemo } from "react";
import {
  Box,
  Grid,
  Paper,
  Typography,
  useTheme,
  Skeleton,
} from "@mui/material";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { RevenueData, TargetSettings } from "../../types/revenue";
import {
  calculateMonthlyTrends,
  calculateMovingAverage,
} from "../../utils/calculations";

interface HistoricalTrendsViewProps {
  data: RevenueData[];
  targetSettings: TargetSettings;
  isLoading?: boolean;
}

const ChartSkeleton = () => (
  <Skeleton
    variant="rectangular"
    width="100%"
    height={400}
    sx={{ borderRadius: 2 }}
  />
);

export const HistoricalTrendsView: React.FC<HistoricalTrendsViewProps> = ({
  data,
  targetSettings,
  isLoading = false,
}) => {
  const theme = useTheme();

  // Memoize calculations to prevent unnecessary recalculations
  const { monthlyTrends, movingAverageData } = useMemo(() => {
    if (!data || data.length === 0) {
      return { monthlyTrends: [], movingAverageData: [] };
    }
    const trends = calculateMonthlyTrends(data);
    const maData = calculateMovingAverage(trends, 3);
    return { monthlyTrends: trends, movingAverageData: maData };
  }, [data]);

  if (isLoading) {
    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <ChartSkeleton />
        </Grid>
        <Grid item xs={12} md={6}>
          <ChartSkeleton />
        </Grid>
        <Grid item xs={12} md={6}>
          <ChartSkeleton />
        </Grid>
      </Grid>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Paper
        elevation={2}
        sx={{
          p: 3,
          textAlign: "center",
          minHeight: 400,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography variant="h6" color="text.secondary">
          No historical data available
        </Typography>
      </Paper>
    );
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      compactDisplay: "short",
    }).format(value);

  const formatPercent = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value / 100);

  return (
    <Grid container spacing={3}>
      {/* Year-over-Year Comparison */}
      <Grid item xs={12}>
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Year-over-Year Revenue Comparison
          </Typography>
          <Box sx={{ height: 400, width: "100%" }}>
            <ResponsiveContainer>
              <LineChart
                data={monthlyTrends}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={theme.palette.divider}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fill: theme.palette.text.secondary }}
                  stroke={theme.palette.divider}
                />
                <YAxis
                  tickFormatter={formatCurrency}
                  tick={{ fill: theme.palette.text.secondary }}
                  stroke={theme.palette.divider}
                />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(value), "Revenue"]}
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="currentYear"
                  name="Current Year"
                  stroke={theme.palette.primary.main}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="previousYear"
                  name="Previous Year"
                  stroke={theme.palette.secondary.main}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Grid>

      {/* Moving Average Trends */}
      <Grid item xs={12} md={6}>
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            3-Month Moving Average
          </Typography>
          <Box sx={{ height: 400, width: "100%" }}>
            <ResponsiveContainer>
              <AreaChart
                data={movingAverageData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={theme.palette.divider}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fill: theme.palette.text.secondary }}
                  stroke={theme.palette.divider}
                />
                <YAxis
                  tickFormatter={formatPercent}
                  tick={{ fill: theme.palette.text.secondary }}
                  stroke={theme.palette.divider}
                />
                <Tooltip
                  formatter={(value: any) => [
                    formatPercent(value),
                    "Attainment",
                  ]}
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="austin"
                  name="Austin MA"
                  fill={theme.palette.primary.light}
                  stroke={theme.palette.primary.main}
                  fillOpacity={0.3}
                />
                <Area
                  type="monotone"
                  dataKey="charlotte"
                  name="Charlotte MA"
                  fill={theme.palette.secondary.light}
                  stroke={theme.palette.secondary.main}
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Grid>

      {/* Seasonal Patterns */}
      <Grid item xs={12} md={6}>
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Monthly Performance Patterns
          </Typography>
          <Box sx={{ height: 400, width: "100%" }}>
            <ResponsiveContainer>
              <LineChart
                data={monthlyTrends}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={theme.palette.divider}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fill: theme.palette.text.secondary }}
                  stroke={theme.palette.divider}
                />
                <YAxis
                  tickFormatter={formatPercent}
                  tick={{ fill: theme.palette.text.secondary }}
                  stroke={theme.palette.divider}
                />
                <Tooltip
                  formatter={(value: any) => [
                    formatPercent(value),
                    "Attainment",
                  ]}
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="austinAttainment"
                  name="Austin Attainment"
                  stroke={theme.palette.primary.main}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="charlotteAttainment"
                  name="Charlotte Attainment"
                  stroke={theme.palette.secondary.main}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Grid>
    </Grid>
  );
};
