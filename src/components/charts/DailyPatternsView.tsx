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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
} from "recharts";
import { RevenueData, TargetSettings } from "../../types/revenue";

interface DailyPatternsViewProps {
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

export const DailyPatternsView: React.FC<DailyPatternsViewProps> = ({
  data,
  targetSettings,
  isLoading = false,
}) => {
  const theme = useTheme();

  // Enhanced color function with green-yellow-red scheme
  const getAttainmentColor = (attainment: number) => {
    if (attainment >= 120) return "#1B5E20"; // Dark green
    if (attainment >= 110) return "#2E7D32"; // Forest green
    if (attainment >= 100) return "#4CAF50"; // Green
    if (attainment >= 95) return "#66BB6A"; // Light green
    if (attainment >= 90) return "#FFEB3B"; // Yellow
    if (attainment >= 85) return "#FDD835"; // Dark yellow
    if (attainment >= 80) return "#EF5350"; // Light red
    if (attainment >= 75) return "#E53935"; // Red
    return "#C62828"; // Dark red
  };

  // Memoize calculations to prevent unnecessary recalculations
  const { heatmapData, dayOfWeekAverages } = useMemo(() => {
    if (!data || data.length === 0) {
      return { heatmapData: [], dayOfWeekAverages: [] };
    }

    // Ensure we have valid target settings
    if (!targetSettings?.dailyTargets) {
      console.warn("Missing daily targets:", targetSettings);
      return { heatmapData: [], dayOfWeekAverages: [] };
    }

    // Calculate daily target once
    const dailyTarget =
      (targetSettings.dailyTargets.austin || 0) +
      (targetSettings.dailyTargets.charlotte || 0);

    // First, sort all data by date
    const sortedData = [...data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Get the last date from the sorted data
    const lastDate = new Date(sortedData[sortedData.length - 1].date);

    // Calculate start date (60 days ago to ensure we get enough weekdays)
    const startDate = new Date(lastDate);
    startDate.setDate(startDate.getDate() - 60);

    // Initialize day of week data
    const dayOfWeekData = {
      Mon: {
        day: "Mon",
        austin: 0,
        charlotte: 0,
        count: 0,
        totalAttainment: 0,
      },
      Tue: {
        day: "Tue",
        austin: 0,
        charlotte: 0,
        count: 0,
        totalAttainment: 0,
      },
      Wed: {
        day: "Wed",
        austin: 0,
        charlotte: 0,
        count: 0,
        totalAttainment: 0,
      },
      Thu: {
        day: "Thu",
        austin: 0,
        charlotte: 0,
        count: 0,
        totalAttainment: 0,
      },
      Fri: {
        day: "Fri",
        austin: 0,
        charlotte: 0,
        count: 0,
        totalAttainment: 0,
      },
    };

    // Process data for each day
    sortedData.forEach((entry) => {
      // Create date object in local timezone
      const date = new Date(entry.date + "T00:00:00");
      const dayNumber = date.getDay();

      // Map day numbers to names
      const dayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayName = dayMap[dayNumber];

      // Skip weekends
      if (dayNumber === 0 || dayNumber === 6) return;

      const total = (entry.austin || 0) + (entry.charlotte || 0);
      const attainment = dailyTarget > 0 ? (total / dailyTarget) * 100 : 0;

      // Debug log for all entries
      console.log("Processing entry:", {
        date: entry.date,
        dayNumber,
        dayName,
        total,
        attainment,
        austin: entry.austin,
        charlotte: entry.charlotte,
      });

      dayOfWeekData[dayName].austin += entry.austin || 0;
      dayOfWeekData[dayName].charlotte += entry.charlotte || 0;
      dayOfWeekData[dayName].totalAttainment += attainment;
      dayOfWeekData[dayName].count += 1;
    });

    // Debug log for day of week data
    Object.entries(dayOfWeekData).forEach(([day, data]) => {
      console.log(`${day} data:`, {
        count: data.count,
        avgAttainment: data.count > 0 ? data.totalAttainment / data.count : 0,
        avgAustin: data.count > 0 ? data.austin / data.count : 0,
        avgCharlotte: data.count > 0 ? data.charlotte / data.count : 0,
        totalAustin: data.austin,
        totalCharlotte: data.charlotte,
      });
    });

    // Calculate averages for each day
    const daysOrder = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const sortedDayOfWeekAverages = daysOrder.map((day) => {
      const dayData = dayOfWeekData[day];
      return {
        day,
        austin: dayData.count > 0 ? dayData.austin / dayData.count : 0,
        charlotte: dayData.count > 0 ? dayData.charlotte / dayData.count : 0,
        attainment:
          dayData.count > 0 ? dayData.totalAttainment / dayData.count : 0,
      };
    });

    // Calculate heatmap data (weekdays only)
    const allWeekdayData = sortedData
      .filter((entry) => {
        const date = new Date(entry.date + "T00:00:00");
        const dayNumber = date.getDay();
        return dayNumber >= 1 && dayNumber <= 5; // Only weekdays (Monday to Friday)
      })
      .map((entry) => {
        const total = (entry.austin || 0) + (entry.charlotte || 0);
        const attainment = dailyTarget > 0 ? (total / dailyTarget) * 100 : 0;
        const date = new Date(entry.date + "T00:00:00");

        return {
          date: date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            weekday: "short",
          }),
          attainment: Number(attainment.toFixed(1)),
          total,
          rawDate: entry.date,
          value: attainment,
        };
      });

    // Take the last 30 weekdays
    const heatmap = allWeekdayData.slice(-30);

    // Debug log for heatmap data
    console.log("Processed heatmap data:", {
      totalEntries: allWeekdayData.length,
      heatmapEntries: heatmap.length,
      first: heatmap[0]?.rawDate,
      last: heatmap[heatmap.length - 1]?.rawDate,
      allDates: heatmap.map((h) => h.rawDate),
    });

    return {
      heatmapData: heatmap,
      dayOfWeekAverages: sortedDayOfWeekAverages,
    };
  }, [data, targetSettings]);

  // Calculate moving average data
  const heatmapDataWithTrend = useMemo(() => {
    return heatmapData.map((item, index) => {
      const window = 5;
      const start = Math.max(0, index - window + 1);
      const values = heatmapData.slice(start, index + 1).map((d) => d.value);
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;

      // Calculate trend direction
      const prevAvg = index > 0 ? heatmapData[index - 1]?.trend : avg;
      const direction =
        avg > prevAvg ? "up" : avg < prevAvg ? "down" : "stable";

      return {
        ...item,
        trend: Number(avg.toFixed(1)),
        trendDirection: direction,
        performance:
          item.value >= 100
            ? "Above Target"
            : item.value >= 85
            ? "Meeting Minimum"
            : "Below Target",
      };
    });
  }, [heatmapData]);

  // Calculate performance statistics
  const stats = useMemo(() => {
    if (!heatmapDataWithTrend.length) return null;

    const values = heatmapDataWithTrend.map((d) => d.value);
    return {
      average: values.reduce((sum, val) => sum + val, 0) / values.length,
      max: Math.max(...values),
      min: Math.min(...values),
      daysAboveTarget: values.filter((v) => v >= 100).length,
      daysBelowMinimum: values.filter((v) => v < 85).length,
    };
  }, [heatmapDataWithTrend]);

  // Format helpers
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

  if (isLoading) {
    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <ChartSkeleton />
        </Grid>
        <Grid item xs={12}>
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
          No daily pattern data available
        </Typography>
      </Paper>
    );
  }

  return (
    <Grid container spacing={3}>
      {/* Performance Summary */}
      {stats && (
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={2.4}>
                <Typography variant="subtitle2" color="text.secondary">
                  Average Attainment
                </Typography>
                <Typography
                  variant="h6"
                  color={
                    stats.average >= 100
                      ? "success.main"
                      : stats.average >= 85
                      ? "warning.main"
                      : "error.main"
                  }
                >
                  {stats.average.toFixed(1)}%
                </Typography>
              </Grid>
              <Grid item xs={12} sm={2.4}>
                <Typography variant="subtitle2" color="text.secondary">
                  Highest Attainment
                </Typography>
                <Typography variant="h6" color="success.main">
                  {stats.max.toFixed(1)}%
                </Typography>
              </Grid>
              <Grid item xs={12} sm={2.4}>
                <Typography variant="subtitle2" color="text.secondary">
                  Lowest Attainment
                </Typography>
                <Typography
                  variant="h6"
                  color={stats.min >= 85 ? "success.main" : "error.main"}
                >
                  {stats.min.toFixed(1)}%
                </Typography>
              </Grid>
              <Grid item xs={12} sm={2.4}>
                <Typography variant="subtitle2" color="text.secondary">
                  Days Above Target
                </Typography>
                <Typography variant="h6" color="success.main">
                  {stats.daysAboveTarget} days
                </Typography>
              </Grid>
              <Grid item xs={12} sm={2.4}>
                <Typography variant="subtitle2" color="text.secondary">
                  Days Below Minimum
                </Typography>
                <Typography variant="h6" color="error.main">
                  {stats.daysBelowMinimum} days
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      )}

      {/* Daily Performance Heatmap */}
      <Grid item xs={12}>
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Daily Attainment Heatmap (Last 30 Weekdays)
          </Typography>
          <Box sx={{ height: 400, width: "100%" }}>
            <ResponsiveContainer>
              <ComposedChart
                data={heatmapDataWithTrend}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={theme.palette.divider}
                  opacity={0.2}
                />
                <XAxis
                  dataKey="date"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval={0}
                  tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                  stroke={theme.palette.divider}
                />
                <YAxis
                  tickFormatter={(value) => `${value}%`}
                  domain={[0, 150]}
                  tick={{ fill: theme.palette.text.secondary }}
                  stroke={theme.palette.divider}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: "8px",
                    padding: "12px",
                    boxShadow: "0px 4px 8px rgba(0,0,0,0.15)",
                  }}
                  formatter={(value: any, name: string, props: any) => {
                    if (name === "Daily Attainment") {
                      const entry = props.payload;
                      return [
                        <span>
                          <strong
                            style={{
                              color: getAttainmentColor(value),
                              fontSize: "1.1em",
                            }}
                          >
                            {value.toFixed(1)}%
                          </strong>
                          <br />
                          Performance: {entry.performance}
                          <br />
                          Total Revenue: {formatCurrency(entry.total)}
                        </span>,
                        name,
                      ];
                    }
                    if (name === "Trend") {
                      const entry = props.payload;
                      const direction =
                        entry.trendDirection === "up"
                          ? "↑"
                          : entry.trendDirection === "down"
                          ? "↓"
                          : "→";
                      return [
                        <span>
                          {value.toFixed(1)}% {direction}
                          <br />
                          5-Day Moving Average
                        </span>,
                        name,
                      ];
                    }
                    return [value, name];
                  }}
                  labelFormatter={(label) => (
                    <strong style={{ marginBottom: "8px", display: "block" }}>
                      Date: {label}
                    </strong>
                  )}
                />
                <Legend verticalAlign="top" height={36} />
                <ReferenceLine
                  y={100}
                  stroke={theme.palette.success.main}
                  strokeDasharray="3 3"
                  label={{
                    value: "Target (100%)",
                    fill: theme.palette.text.secondary,
                    fontSize: 12,
                    position: "right",
                  }}
                />
                <ReferenceLine
                  y={85}
                  stroke={theme.palette.warning.main}
                  strokeDasharray="3 3"
                  label={{
                    value: "Minimum (85%)",
                    fill: theme.palette.text.secondary,
                    fontSize: 12,
                    position: "right",
                  }}
                />
                <Bar
                  dataKey="value"
                  name="Daily Attainment"
                  maxBarSize={40}
                  radius={[4, 4, 0, 0]} // Rounded top corners
                >
                  {heatmapDataWithTrend.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getAttainmentColor(entry.value)}
                      opacity={1} // Full opacity for better color visibility
                    />
                  ))}
                </Bar>
                <Line
                  type="monotone"
                  dataKey="trend"
                  name="Trend"
                  stroke={theme.palette.info.main}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{
                    r: 6,
                    strokeWidth: 1,
                    fill: theme.palette.background.paper,
                    stroke: theme.palette.info.main,
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Grid>

      {/* Day of Week Performance */}
      <Grid item xs={12}>
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Average Performance by Weekday
          </Typography>
          <Box sx={{ height: 400, width: "100%" }}>
            <ResponsiveContainer>
              <BarChart
                data={dayOfWeekAverages}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={theme.palette.divider}
                  opacity={0.2}
                />
                <XAxis
                  dataKey="day"
                  tick={{ fill: theme.palette.text.secondary }}
                  stroke={theme.palette.divider}
                />
                <YAxis
                  yAxisId="revenue"
                  tickFormatter={formatCurrency}
                  tick={{ fill: theme.palette.text.secondary }}
                  stroke={theme.palette.divider}
                />
                <YAxis
                  yAxisId="attainment"
                  orientation="right"
                  tickFormatter={(value) => `${value.toFixed(1)}%`}
                  domain={[0, 150]}
                  tick={{ fill: theme.palette.text.secondary }}
                  stroke={theme.palette.divider}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: "8px",
                    padding: "12px",
                    boxShadow: "0px 4px 8px rgba(0,0,0,0.15)",
                  }}
                  formatter={(value: any, name: string) => {
                    if (name === "Attainment")
                      return [`${value.toFixed(1)}%`, name];
                    return [formatCurrency(value), name];
                  }}
                />
                <Legend />
                <Bar
                  yAxisId="revenue"
                  dataKey="austin"
                  name="Austin"
                  fill={theme.palette.primary.main}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={50}
                />
                <Bar
                  yAxisId="revenue"
                  dataKey="charlotte"
                  name="Charlotte"
                  fill={theme.palette.secondary.main}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={50}
                />
                <Bar
                  yAxisId="attainment"
                  dataKey="attainment"
                  name="Attainment"
                  fill={theme.palette.success.main}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={50}
                />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Grid>
    </Grid>
  );
};
