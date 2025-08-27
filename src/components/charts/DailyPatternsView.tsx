import React, { useMemo } from "react";
import {
  Box,
  Grid,
  Paper,
  Typography,
  useTheme,
  Skeleton,
  Stack,
  Chip,
  Divider,
  alpha,
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
  Bar,
  BarChart,
  ComposedChart,
  ReferenceLine,
  Cell,
} from "recharts";
import { RevenueData, TargetSettings } from "../../types/revenue";
import { formatCurrency } from "../../utils/formatters";
import { getTargetForDate } from "../../utils/calculations";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import RemoveIcon from "@mui/icons-material/Remove";
import InsightsIcon from "@mui/icons-material/Insights";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

interface DailyPatternsViewProps {
  data: RevenueData[];
  targetSettings?: TargetSettings;
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

// Enhanced tooltip component with modern styling
const EnhancedTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <Paper
        elevation={8}
        sx={{
          p: 2,
          backgroundColor: alpha("#000000", 0.85),
          border: "1px solid",
          borderColor: "rgba(255, 255, 255, 0.1)",
          borderRadius: "12px",
          minWidth: 220,
          backdropFilter: "blur(8px)",
        }}
      >
        <Typography variant="subtitle2" color="white" gutterBottom>
          {label}
        </Typography>
        <Divider sx={{ my: 1, borderColor: "rgba(255, 255, 255, 0.1)" }} />
        <Stack spacing={1.5}>
          <Box>
            <Typography
              variant="body2"
              color="rgba(255, 255, 255, 0.7)"
              gutterBottom
            >
              Daily Attainment
            </Typography>
            <Typography
              variant="h6"
              color={getAttainmentColor(payload[0]?.value)}
              sx={{ fontWeight: "bold" }}
            >
              {Math.round(payload[0]?.value)}%
            </Typography>
          </Box>
          <Box>
            <Typography
              variant="body2"
              color="rgba(255, 255, 255, 0.7)"
              gutterBottom
            >
              Total Revenue
            </Typography>
            <Typography variant="h6" color="white">
              {formatCurrency(payload[0]?.payload?.total || 0)}
            </Typography>
          </Box>
          <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
            <Box>
              <Typography
                variant="body2"
                color="rgba(255, 255, 255, 0.7)"
                gutterBottom
              >
                Austin
              </Typography>
              <Typography variant="body1" color="#4CAF50">
                {formatCurrency(payload[0]?.payload?.austin || 0)}
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="body2"
                color="rgba(255, 255, 255, 0.7)"
                gutterBottom
              >
                Charlotte
              </Typography>
              <Typography variant="body1" color="#7B1FA2">
                {formatCurrency(payload[0]?.payload?.charlotte || 0)}
              </Typography>
            </Box>
          </Stack>
        </Stack>
      </Paper>
    );
  }
  return null;
};

const getAttainmentColor = (value: number) => {
  if (value >= 100) return "#2E7D32"; // Dark green
  if (value >= 85) return "#ED6C02"; // Orange
  return "#D32F2F"; // Red
};

export const DailyPatternsView: React.FC<DailyPatternsViewProps> = ({
  data,
  targetSettings,
  isLoading = false,
}) => {
  const theme = useTheme();

  // Process data for the last 30 working days
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return null;

    // Sort data by date
    const sortedData = [...data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Get the last 30 working days and filter out weekends
    const last30Days = sortedData.slice(-30).filter((entry) => {
      const date = new Date(entry.date + "T00:00:00");
      const dayNumber = date.getDay();
      return dayNumber > 0 && dayNumber < 6;
    });

    // Process each entry with dynamic target calculation
    const processedEntries = last30Days.map((entry) => {
      const date = new Date(entry.date + "T00:00:00");
      const dayNumber = date.getDay();
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayName = dayNames[dayNumber];
      const total = (entry.austin || 0) + (entry.charlotte || 0);

      // Use actual target settings if available, otherwise fallback to default
      const dailyTargets = targetSettings
        ? getTargetForDate(date, targetSettings)
        : { austin: 53000, charlotte: 62500 };
      const dailyTarget = dailyTargets.austin + dailyTargets.charlotte;
      const attainment = dailyTarget > 0 ? (total / dailyTarget) * 100 : 0;

      return {
        date: entry.date,
        dayNumber,
        dayName,
        total,
        attainment,
        austin: entry.austin || 0,
        charlotte: entry.charlotte || 0,
        target: dailyTarget,
        formattedDate: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      };
    });

    // Calculate weekday averages and statistics
    const weekdayData = {
      Mon: {
        count: 0,
        totalAttainment: 0,
        totalAustin: 0,
        totalCharlotte: 0,
        avgAttainment: 0,
        avgAustin: 0,
        avgCharlotte: 0,
        bestDay: 0,
        worstDay: 100,
      },
      Tue: {
        count: 0,
        totalAttainment: 0,
        totalAustin: 0,
        totalCharlotte: 0,
        avgAttainment: 0,
        avgAustin: 0,
        avgCharlotte: 0,
        bestDay: 0,
        worstDay: 100,
      },
      Wed: {
        count: 0,
        totalAttainment: 0,
        totalAustin: 0,
        totalCharlotte: 0,
        avgAttainment: 0,
        avgAustin: 0,
        avgCharlotte: 0,
        bestDay: 0,
        worstDay: 100,
      },
      Thu: {
        count: 0,
        totalAttainment: 0,
        totalAustin: 0,
        totalCharlotte: 0,
        avgAttainment: 0,
        avgAustin: 0,
        avgCharlotte: 0,
        bestDay: 0,
        worstDay: 100,
      },
      Fri: {
        count: 0,
        totalAttainment: 0,
        totalAustin: 0,
        totalCharlotte: 0,
        avgAttainment: 0,
        avgAustin: 0,
        avgCharlotte: 0,
        bestDay: 0,
        worstDay: 100,
      },
    };

    // Process entries for weekday averages and track best/worst days
    processedEntries.forEach((entry) => {
      const dayData = weekdayData[entry.dayName as keyof typeof weekdayData];
      if (dayData) {
        dayData.count++;
        dayData.totalAttainment += entry.attainment;
        dayData.totalAustin += entry.austin;
        dayData.totalCharlotte += entry.charlotte;
        dayData.bestDay = Math.max(dayData.bestDay, entry.attainment);
        dayData.worstDay = Math.min(dayData.worstDay, entry.attainment);
      }
    });

    // Calculate averages and analytics
    let totalDays = 0;
    let totalAttainment = 0;
    let daysAboveTarget = 0;
    let daysBelow85 = 0;

    Object.entries(weekdayData).forEach(([day, data]) => {
      if (data.count > 0) {
        data.avgAttainment = data.totalAttainment / data.count;
        data.avgAustin = data.totalAustin / data.count;
        data.avgCharlotte = data.totalCharlotte / data.count;
        totalDays += data.count;
        totalAttainment += data.totalAttainment;
      }
    });

    // Calculate overall statistics
    processedEntries.forEach((entry) => {
      if (entry.attainment >= 100) daysAboveTarget++;
      if (entry.attainment < 85) daysBelow85++;
    });

    const overallAvgAttainment =
      totalDays > 0 ? totalAttainment / totalDays : 0;
    const consistencyScore =
      totalDays > 0 ? ((totalDays - daysBelow85) / totalDays) * 100 : 0;
    const targetHitRate =
      totalDays > 0 ? (daysAboveTarget / totalDays) * 100 : 0;

    // Find best and worst performing days
    const bestPerformingDay = Object.entries(weekdayData).reduce(
      (best, [day, data]) =>
        data.avgAttainment > best.avgAttainment
          ? { day, avgAttainment: data.avgAttainment }
          : best,
      { day: "", avgAttainment: 0 }
    );

    const worstPerformingDay = Object.entries(weekdayData).reduce(
      (worst, [day, data]) =>
        data.count > 0 && data.avgAttainment < worst.avgAttainment
          ? { day, avgAttainment: data.avgAttainment }
          : worst,
      { day: "", avgAttainment: 200 }
    );

    return {
      entries: processedEntries,
      weekdayData,
      analytics: {
        totalDays,
        overallAvgAttainment,
        daysAboveTarget,
        daysBelow85,
        consistencyScore,
        targetHitRate,
        bestPerformingDay,
        worstPerformingDay,
      },
      firstDate: processedEntries[0]?.date,
      lastDate: processedEntries[processedEntries.length - 1]?.date,
    };
  }, [data, targetSettings]);

  if (isLoading) {
    return <ChartSkeleton />;
  }

  if (!processedData) {
    return (
      <Paper
        elevation={2}
        sx={{
          p: 3,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Typography variant="h6" color="text.secondary">
          No daily pattern data available
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={5}>
        {/* Weekly Performance Summary */}
        <Grid xs={12}>
          <Paper
            elevation={3}
            sx={{
              p: 4,
              mb: 3,
              background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography
              variant="h5"
              gutterBottom
              sx={{ fontWeight: 600, color: "text.primary", mb: 3 }}
            >
              Weekly Performance Summary
            </Typography>
            <Grid container spacing={3}>
              {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => (
                <Grid xs={12} sm={6} md={2.4} key={day}>
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: "background.paper",
                      borderRadius: 2,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Typography variant="h6" color="primary" gutterBottom>
                      {day}
                    </Typography>
                    <Typography
                      variant="h4"
                      sx={{
                        color: getAttainmentColor(
                          processedData.weekdayData[
                            day as keyof typeof processedData.weekdayData
                          ].avgAttainment
                        ),
                        fontWeight: 700,
                      }}
                    >
                      {processedData.weekdayData[
                        day as keyof typeof processedData.weekdayData
                      ].avgAttainment.toFixed(1)}
                      %
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Average attainment
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Hit target:{" "}
                        {
                          processedData.weekdayData[
                            day as keyof typeof processedData.weekdayData
                          ].count
                        }{" "}
                        times
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Avg revenue:{" "}
                        {formatCurrency(
                          processedData.weekdayData[
                            day as keyof typeof processedData.weekdayData
                          ].totalAustin +
                            processedData.weekdayData[
                              day as keyof typeof processedData.weekdayData
                            ].totalCharlotte
                        )}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>

        {/* Performance Analytics */}
        <Grid xs={12}>
          <Paper
            elevation={3}
            sx={{
              p: 4,
              mb: 3,
              background: "linear-gradient(135deg, #f0f8ff 0%, #e6f3ff 100%)",
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              spacing={2}
              sx={{ mb: 3 }}
            >
              <InsightsIcon color="primary" />
              <Typography
                variant="h5"
                sx={{ fontWeight: 600, color: "text.primary" }}
              >
                Performance Analytics & Insights
              </Typography>
            </Stack>

            <Grid container spacing={3}>
              {/* Overall Performance */}
              <Grid xs={12} md={3}>
                <Box
                  sx={{
                    p: 3,
                    bgcolor: "background.paper",
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography variant="h6" color="primary" gutterBottom>
                    Overall Performance
                  </Typography>
                  <Typography
                    variant="h3"
                    sx={{
                      color: getAttainmentColor(
                        processedData.analytics.overallAvgAttainment
                      ),
                      fontWeight: 700,
                    }}
                  >
                    {processedData.analytics.overallAvgAttainment.toFixed(1)}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Average daily attainment
                  </Typography>
                  <Chip
                    label={`${processedData.analytics.totalDays} working days`}
                    size="small"
                    sx={{ mt: 1 }}
                    icon={<CalendarTodayIcon />}
                  />
                </Box>
              </Grid>

              {/* Target Hit Rate */}
              <Grid xs={12} md={3}>
                <Box
                  sx={{
                    p: 3,
                    bgcolor: "background.paper",
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography variant="h6" color="primary" gutterBottom>
                    Target Hit Rate
                  </Typography>
                  <Typography
                    variant="h3"
                    sx={{
                      color: getAttainmentColor(
                        processedData.analytics.targetHitRate
                      ),
                      fontWeight: 700,
                    }}
                  >
                    {processedData.analytics.targetHitRate.toFixed(1)}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Days hitting target
                  </Typography>
                  <Chip
                    label={`${processedData.analytics.daysAboveTarget} out of ${processedData.analytics.totalDays} days`}
                    size="small"
                    sx={{ mt: 1 }}
                    icon={<CheckCircleIcon />}
                  />
                </Box>
              </Grid>

              {/* Consistency Score */}
              <Grid xs={12} md={3}>
                <Box
                  sx={{
                    p: 3,
                    bgcolor: "background.paper",
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography variant="h6" color="primary" gutterBottom>
                    Consistency Score
                  </Typography>
                  <Typography
                    variant="h3"
                    sx={{
                      color: getAttainmentColor(
                        processedData.analytics.consistencyScore
                      ),
                      fontWeight: 700,
                    }}
                  >
                    {processedData.analytics.consistencyScore.toFixed(1)}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Days above 85% target
                  </Typography>
                  <Chip
                    label={`${processedData.analytics.daysBelow85} days below threshold`}
                    size="small"
                    sx={{ mt: 1 }}
                    icon={<TrendingDownIcon />}
                    color="warning"
                  />
                </Box>
              </Grid>

              {/* Performance Range */}
              <Grid xs={12} md={3}>
                <Box
                  sx={{
                    p: 3,
                    bgcolor: "background.paper",
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography variant="h6" color="primary" gutterBottom>
                    Performance Range
                  </Typography>
                  <Stack spacing={1}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Best Day
                      </Typography>
                      <Typography
                        variant="h6"
                        sx={{ color: "success.main", fontWeight: 600 }}
                      >
                        {processedData.analytics.bestPerformingDay.day}:{" "}
                        {processedData.analytics.bestPerformingDay.avgAttainment.toFixed(
                          1
                        )}
                        %
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Needs Focus
                      </Typography>
                      <Typography
                        variant="h6"
                        sx={{ color: "warning.main", fontWeight: 600 }}
                      >
                        {processedData.analytics.worstPerformingDay.day}:{" "}
                        {processedData.analytics.worstPerformingDay.avgAttainment.toFixed(
                          1
                        )}
                        %
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              </Grid>
            </Grid>

            {/* Performance Recommendations */}
            <Box sx={{ mt: 3 }}>
              <Typography
                variant="h6"
                color="primary"
                gutterBottom
                sx={{ fontWeight: 600 }}
              >
                💡 Performance Recommendations
              </Typography>
              <Grid container spacing={2}>
                {processedData.analytics.targetHitRate < 70 && (
                  <Grid xs={12} md={6}>
                    <Typography variant="body2" sx={{ color: "text.primary" }}>
                      • Focus on increasing target hit rate - currently only{" "}
                      {processedData.analytics.targetHitRate.toFixed(1)}% of
                      days hit target
                    </Typography>
                  </Grid>
                )}
                {processedData.analytics.consistencyScore < 80 && (
                  <Grid xs={12} md={6}>
                    <Typography variant="body2" sx={{ color: "text.primary" }}>
                      • Improve consistency -{" "}
                      {processedData.analytics.daysBelow85} days fell below 85%
                      threshold
                    </Typography>
                  </Grid>
                )}
                {processedData.analytics.worstPerformingDay.avgAttainment <
                  90 && (
                  <Grid xs={12} md={6}>
                    <Typography variant="body2" sx={{ color: "text.primary" }}>
                      • {processedData.analytics.worstPerformingDay.day}s need
                      attention - averaging{" "}
                      {processedData.analytics.worstPerformingDay.avgAttainment.toFixed(
                        1
                      )}
                      %
                    </Typography>
                  </Grid>
                )}
                {processedData.analytics.bestPerformingDay.avgAttainment >
                  95 && (
                  <Grid xs={12} md={6}>
                    <Typography variant="body2" sx={{ color: "text.primary" }}>
                      • Great work on{" "}
                      {processedData.analytics.bestPerformingDay.day}s! Apply
                      those strategies to other days
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          </Paper>
        </Grid>

        {/* Daily Performance Chart */}
        <Grid xs={12}>
          <Paper
            elevation={3}
            sx={{
              p: 4,
              background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography
              variant="h5"
              gutterBottom
              sx={{ fontWeight: 600, color: "text.primary", mb: 3 }}
            >
              Daily Performance Trend
            </Typography>
            <Box sx={{ height: 650, width: "100%", mt: 2, pb: 2, position: "relative" }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={processedData.entries}
                  margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                >
                  <defs>
                    <linearGradient
                      id="colorAustin"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#4CAF50" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4CAF50" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient
                      id="colorCharlotte"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#7B1FA2" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#7B1FA2" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={alpha(theme.palette.divider, 0.1)}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) =>
                      new Date(value).toLocaleDateString()
                    }
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval="preserveStartEnd"
                    tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: alpha(theme.palette.divider, 0.2) }}
                  />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    domain={[0, 150]}
                    tickFormatter={(value) => `${value}%`}
                    tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: alpha(theme.palette.divider, 0.2) }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, "dataMax"]}
                    tickFormatter={(value) => formatCurrency(value)}
                    tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: alpha(theme.palette.divider, 0.2) }}
                  />
                  <Tooltip content={<EnhancedTooltip />} />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    formatter={(value) => (
                      <span
                        style={{
                          color: theme.palette.text.primary,
                          fontSize: 12,
                        }}
                      >
                        {value}
                      </span>
                    )}
                  />
                  <ReferenceLine
                    y={100}
                    stroke="#2E7D32"
                    strokeDasharray="3 3"
                    yAxisId="left"
                    label={{
                      value: "Target",
                      position: "right",
                      fill: "#2E7D32",
                      fontSize: 12,
                    }}
                  />
                  <ReferenceLine
                    y={85}
                    stroke="#ED6C02"
                    strokeDasharray="3 3"
                    yAxisId="left"
                    label={{
                      value: "Minimum",
                      position: "right",
                      fill: "#ED6C02",
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="total"
                    name="Daily Revenue"
                    yAxisId="right"
                    fill={theme.palette.primary.main}
                    opacity={0.15}
                    radius={[4, 4, 0, 0]}
                  >
                    {processedData.entries.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={alpha(getAttainmentColor(entry.attainment), 0.15)}
                      />
                    ))}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="attainment"
                    name="Daily Attainment"
                    yAxisId="left"
                    stroke="#1976D2"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{
                      r: 6,
                      strokeWidth: 1,
                      fill: theme.palette.background.paper,
                      stroke: "#1976D2",
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        {/* Day of Week Performance */}
        <Grid item xs={12}>
          <Paper
            elevation={3}
            sx={{
              p: 4,
              background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography
              variant="h5"
              gutterBottom
              sx={{ fontWeight: 600, color: "text.primary", mb: 3 }}
            >
              Average Performance by Weekday
            </Typography>
            <Box sx={{ height: 650, width: "100%", mt: 2, pb: 2, position: "relative" }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => ({
                    day,
                    attainment:
                      processedData.weekdayData[
                        day as keyof typeof processedData.weekdayData
                      ].avgAttainment || 0,
                    austin:
                      processedData.weekdayData[
                        day as keyof typeof processedData.weekdayData
                      ].avgAustin || 0,
                    charlotte:
                      processedData.weekdayData[
                        day as keyof typeof processedData.weekdayData
                      ].avgCharlotte || 0,
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={alpha(theme.palette.divider, 0.1)}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: theme.palette.text.primary, fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: alpha(theme.palette.divider, 0.2) }}
                  />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    domain={[0, 150]}
                    tickFormatter={(value) => `${value}%`}
                    tick={{ fill: theme.palette.text.primary, fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: alpha(theme.palette.divider, 0.2) }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, "dataMax"]}
                    tickFormatter={(value) => formatCurrency(value)}
                    tick={{ fill: theme.palette.text.primary, fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: alpha(theme.palette.divider, 0.2) }}
                  />
                  <Tooltip content={<EnhancedTooltip />} />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    formatter={(value) => (
                      <span
                        style={{
                          color: theme.palette.text.primary,
                          fontSize: 12,
                        }}
                      >
                        {value}
                      </span>
                    )}
                  />
                  <ReferenceLine
                    y={100}
                    stroke="#2E7D32"
                    strokeDasharray="3 3"
                    yAxisId="left"
                    label={{
                      value: "Target",
                      position: "right",
                      fill: "#2E7D32",
                      fontSize: 12,
                    }}
                  />
                  <ReferenceLine
                    y={85}
                    stroke="#ED6C02"
                    strokeDasharray="3 3"
                    yAxisId="left"
                    label={{
                      value: "Minimum",
                      position: "right",
                      fill: "#ED6C02",
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="attainment"
                    name="Attainment"
                    yAxisId="left"
                    stroke="#1976D2"
                    strokeWidth={3}
                    dot={{ r: 6, fill: "#1976D2", strokeWidth: 2 }}
                    activeDot={{
                      r: 8,
                      strokeWidth: 2,
                      fill: theme.palette.background.paper,
                      stroke: "#1976D2",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="austin"
                    name="Austin Revenue"
                    yAxisId="right"
                    fill="url(#colorAustin)"
                    stroke="#4CAF50"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="charlotte"
                    name="Charlotte Revenue"
                    yAxisId="right"
                    fill="url(#colorCharlotte)"
                    stroke="#7B1FA2"
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};
