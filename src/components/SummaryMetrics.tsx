import React from "react";
import {
  Grid,
  Paper,
  Typography,
  Box,
  Divider,
  Chip,
  Stack,
  Alert,
} from "@mui/material";
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  CalendarToday as CalendarIcon,
  Assessment as AssessmentIcon,
} from "@mui/icons-material";
import { RevenueData, TimeFrame, TargetSettings } from "../types/revenue";
import {
  calculateTrend,
  calculateMetrics,
  filterDataByTimeFrame,
  calculateLocationMetrics,
  calculateLocationMetricsForPeriod,
} from "../utils/calculations";
import MetricCard from "./MetricCard";
import { formatCurrency } from "../utils/formatters";

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

  // Use the new time-period-aware calculation
  const metrics = calculateLocationMetricsForPeriod(
    filteredData,
    targetSettings,
    location,
    timeFrame
  );

  // Get period information for detailed breakdown
  const periodInfo = metrics.total.periodInfo;

  // Safety check for periodInfo
  if (!periodInfo) {
    console.warn("Period info is missing from metrics");
    return (
      <Paper
        elevation={2}
        sx={{
          p: 4,
          mb: 3,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography
          variant="h5"
          gutterBottom
          sx={{ fontWeight: 600, color: "text.primary" }}
        >
          Summary Metrics
        </Typography>
        <Alert severity="warning" sx={{ mt: 2 }}>
          Unable to load period information. Please refresh the page.
        </Alert>
      </Paper>
    );
  }

  // Format period display
  const getPeriodDisplayName = () => {
    try {
      switch (timeFrame) {
        case "MTD":
          const currentYear = new Date().getFullYear();
          const currentMonth = new Date().getMonth();
          const displayYear = periodInfo.relevantYear || currentYear;
          const displayMonth =
            periodInfo.relevantMonth !== undefined
              ? periodInfo.relevantMonth
              : currentMonth;
          return `Month-to-Date (${new Date(
            displayYear,
            displayMonth
          ).toLocaleDateString("en-US", { month: "long", year: "numeric" })})`;
        case "This Week":
          return `This Week (${periodInfo.startDate} to ${periodInfo.endDate})`;
        case "last30":
          return `Last 30 Days (${periodInfo.startDate} to ${periodInfo.endDate})`;
        case "last90":
          return `Last 90 Days (${periodInfo.startDate} to ${periodInfo.endDate})`;
        case "YTD":
          return `Year-to-Date ${
            periodInfo.relevantYear || new Date().getFullYear()
          } (${periodInfo.startDate} to ${periodInfo.endDate})`;
        case "custom":
          return `Custom Period (${periodInfo.startDate} to ${periodInfo.endDate})`;
        default:
          return `${timeFrame} (${periodInfo.startDate} to ${periodInfo.endDate})`;
      }
    } catch (error) {
      console.warn("Error formatting period display name:", error);
      return `${timeFrame} Period`;
    }
  };

  return (
    <Paper
      elevation={2}
      sx={{
        p: 4,
        mb: 3,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
      }}
    >
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h5"
          gutterBottom
          sx={{ fontWeight: 600, color: "text.primary", mb: 2 }}
        >
          Summary Metrics
        </Typography>

        {/* Period Information Header */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Chip
            icon={<CalendarIcon />}
            label={getPeriodDisplayName()}
            color="primary"
            variant="outlined"
            sx={{ fontWeight: 500 }}
          />
          <Chip
            icon={<AssessmentIcon />}
            label={`${periodInfo.actualDataDays} data points`}
            color="info"
            variant="outlined"
          />
          {periodInfo.hasMonthlyAdjustment && (
            <Chip
              label="Custom Working Days"
              color="warning"
              variant="outlined"
              size="small"
            />
          )}
        </Stack>

        {/* Period Details */}
        <Box
          sx={{
            p: 2,
            backgroundColor: "grey.50",
            borderRadius: 1,
            border: "1px solid",
            borderColor: "grey.200",
            mb: 3,
          }}
        >
          <Grid container spacing={2}>
            <Grid xs={12} sm={6} md={3}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontWeight: 500 }}
              >
                Working Days in Period
              </Typography>
              <Typography
                variant="h6"
                sx={{ fontWeight: 600, color: "primary.main" }}
              >
                {periodInfo.workingDaysInPeriod}
              </Typography>
            </Grid>
            <Grid xs={12} sm={6} md={3}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontWeight: 500 }}
              >
                Daily Target - Austin
              </Typography>
              <Typography
                variant="h6"
                sx={{ fontWeight: 600, color: "success.main" }}
              >
                {formatCurrency(periodInfo.dailyTargets.austin)}
              </Typography>
            </Grid>
            <Grid xs={12} sm={6} md={3}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontWeight: 500 }}
              >
                Daily Target - Charlotte
              </Typography>
              <Typography
                variant="h6"
                sx={{ fontWeight: 600, color: "success.main" }}
              >
                {formatCurrency(periodInfo.dailyTargets.charlotte)}
              </Typography>
            </Grid>
            <Grid xs={12} sm={6} md={3}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontWeight: 500 }}
              >
                Period Target Total
              </Typography>
              <Typography
                variant="h6"
                sx={{ fontWeight: 600, color: "info.main" }}
              >
                {formatCurrency(
                  periodInfo.dailyTargets.austin *
                    periodInfo.workingDaysInPeriod +
                    periodInfo.dailyTargets.charlotte *
                      periodInfo.workingDaysInPeriod
                )}
              </Typography>
            </Grid>
          </Grid>
        </Box>
      </Box>

      <Divider sx={{ mb: 3, borderColor: "divider" }} />

      <Grid container spacing={4}>
        <Grid xs={12} md={4}>
          <MetricCard
            title="Austin"
            revenue={metrics.austin.revenue}
            target={metrics.austin.target}
            monthlyTarget={metrics.austin.monthlyTarget}
            attainment={metrics.austin.attainment}
            elapsedDays={metrics.austin.elapsedDays}
            remainingDays={metrics.austin.remainingDays}
            totalDays={metrics.austin.totalDays}
            dailyPaceNeeded={metrics.austin.dailyPaceNeeded}
            dailyTarget={periodInfo.dailyTargets.austin}
          />
        </Grid>
        <Grid xs={12} md={4}>
          <MetricCard
            title="Charlotte"
            revenue={metrics.charlotte.revenue}
            target={metrics.charlotte.target}
            monthlyTarget={metrics.charlotte.monthlyTarget}
            attainment={metrics.charlotte.attainment}
            elapsedDays={metrics.charlotte.elapsedDays}
            remainingDays={metrics.charlotte.remainingDays}
            totalDays={metrics.charlotte.totalDays}
            dailyPaceNeeded={metrics.charlotte.dailyPaceNeeded}
            dailyTarget={periodInfo.dailyTargets.charlotte}
          />
        </Grid>
        <Grid xs={12} md={4}>
          <MetricCard
            title="Total"
            revenue={metrics.total.revenue}
            target={metrics.total.target}
            monthlyTarget={metrics.total.monthlyTarget}
            attainment={metrics.total.attainment}
            elapsedDays={metrics.total.elapsedDays}
            remainingDays={metrics.total.remainingDays}
            totalDays={metrics.total.totalDays}
            dailyPaceNeeded={metrics.total.dailyPaceNeeded}
            dailyTarget={
              periodInfo.dailyTargets.austin + periodInfo.dailyTargets.charlotte
            }
          />
        </Grid>
      </Grid>
    </Paper>
  );
};

export default SummaryMetrics;
