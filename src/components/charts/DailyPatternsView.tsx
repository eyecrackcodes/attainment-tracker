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
import { RevenueData } from "../../types/revenue";
import { formatCurrency } from "../../utils/formatters";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import RemoveIcon from "@mui/icons-material/Remove";

interface DailyPatternsViewProps {
  data: RevenueData[];
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
  isLoading = false,
}) => {
  const theme = useTheme();

  // Process data for the last 30 working days
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return null;

    console.log("=== Data Processing Start ===");
    console.log("Raw data count:", data.length);

    // Sort data by date
    const sortedData = [...data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    console.log("Date range:", {
      first: sortedData[0]?.date,
      last: sortedData[sortedData.length - 1]?.date,
      totalDays: sortedData.length,
    });

    // Get the last 30 working days and filter out weekends
    const last30Days = sortedData.slice(-30).filter((entry) => {
      const date = new Date(entry.date + "T00:00:00");
      const dayNumber = date.getDay();
      return dayNumber > 0 && dayNumber < 6;
    });

    console.log("Filtered working days:", {
      count: last30Days.length,
      first: last30Days[0]?.date,
      last: last30Days[last30Days.length - 1]?.date,
    });

    // Process each entry
    const processedEntries = last30Days.map((entry) => {
      const date = new Date(entry.date + "T00:00:00");
      const dayNumber = date.getDay();
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayName = dayNames[dayNumber];
      const total = (entry.austin || 0) + (entry.charlotte || 0);
      const dailyTarget = 115500;
      const attainment = dailyTarget > 0 ? (total / dailyTarget) * 100 : 0;

      console.log(`[${entry.date}] ${dayName}:`, {
        austin: formatCurrency(entry.austin || 0),
        charlotte: formatCurrency(entry.charlotte || 0),
        total: formatCurrency(total),
        attainment: attainment.toFixed(2) + "%",
        target: formatCurrency(dailyTarget),
      });

      return {
        date: entry.date,
        dayNumber,
        dayName,
        total,
        attainment,
        austin: entry.austin || 0,
        charlotte: entry.charlotte || 0,
      };
    });

    // Calculate weekday averages
    const weekdayData = {
      Mon: {
        count: 0,
        totalAttainment: 0,
        totalAustin: 0,
        totalCharlotte: 0,
        avgAttainment: 0,
        avgAustin: 0,
        avgCharlotte: 0,
      },
      Tue: {
        count: 0,
        totalAttainment: 0,
        totalAustin: 0,
        totalCharlotte: 0,
        avgAttainment: 0,
        avgAustin: 0,
        avgCharlotte: 0,
      },
      Wed: {
        count: 0,
        totalAttainment: 0,
        totalAustin: 0,
        totalCharlotte: 0,
        avgAttainment: 0,
        avgAustin: 0,
        avgCharlotte: 0,
      },
      Thu: {
        count: 0,
        totalAttainment: 0,
        totalAustin: 0,
        totalCharlotte: 0,
        avgAttainment: 0,
        avgAustin: 0,
        avgCharlotte: 0,
      },
      Fri: {
        count: 0,
        totalAttainment: 0,
        totalAustin: 0,
        totalCharlotte: 0,
        avgAttainment: 0,
        avgAustin: 0,
        avgCharlotte: 0,
      },
    };

    // Process entries for weekday averages
    processedEntries.forEach((entry) => {
      const dayData = weekdayData[entry.dayName as keyof typeof weekdayData];
      if (dayData) {
        dayData.count++;
        dayData.totalAttainment += entry.attainment;
        dayData.totalAustin += entry.austin;
        dayData.totalCharlotte += entry.charlotte;
      }
    });

    // Calculate and log averages for each day
    console.log("\n=== Weekday Averages ===");
    Object.entries(weekdayData).forEach(([day, data]) => {
      if (data.count > 0) {
        data.avgAttainment = data.totalAttainment / data.count;
        data.avgAustin = data.totalAustin / data.count;
        data.avgCharlotte = data.totalCharlotte / data.count;
      }
      console.log(`${day}:`, {
        daysCount: data.count,
        avgAttainment: data.avgAttainment.toFixed(2) + "%",
        avgAustin: formatCurrency(data.avgAustin),
        avgCharlotte: formatCurrency(data.avgCharlotte),
        avgTotal: formatCurrency(data.avgAustin + data.avgCharlotte),
      });
    });

    console.log("=== Data Processing Complete ===\n");

    return {
      entries: processedEntries,
      weekdayData,
      firstDate: processedEntries[0]?.date,
      lastDate: processedEntries[processedEntries.length - 1]?.date,
    };
  }, [data]);

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
        {/* Performance Summary */}
        <Grid item xs={12}>
          <Paper
            elevation={3}
            sx={{
              p: 4,
              mb: 3,
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: 'text.primary', mb: 3 }}>
              Weekly Performance Summary
            </Typography>
            <Grid container spacing={3}>
              {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => (
                <Grid item xs={12} sm={6} md={2.4} key={day}>
                  <Paper
                    elevation={2}
                    sx={{
                      p: 3,
                      background: '#ffffff',
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        elevation: 4,
                        borderColor: 'primary.light',
                        transform: 'translateY(-2px)'
                      }
                    }}
                  >
                    <Typography
                      variant="subtitle1"
                      color="text.secondary"
                      gutterBottom
                      sx={{ fontWeight: 500 }}
                    >
                      {day} Average
                    </Typography>
                    <Typography
                      variant="h4"
                      color={getAttainmentColor(
                        processedData.weekdayData[day as keyof typeof processedData.weekdayData].avgAttainment
                      )}
                      sx={{ fontWeight: 700 }}
                    >
                      {Math.round(processedData.weekdayData[day as keyof typeof processedData.weekdayData].avgAttainment)}%
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>

        {/* Daily Performance Chart */}
        <Grid item xs={12}>
          <Paper
            elevation={3}
            sx={{
              p: 4,
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: 'text.primary', mb: 3 }}>
              Daily Performance Trend
            </Typography>
            <Box sx={{ height: 500, width: "100%", mt: 2, pb: 2 }}>
            <ResponsiveContainer>
              <ComposedChart
                data={processedData.entries}
                margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
              >
                <defs>
                  <linearGradient id="colorAustin" x1="0" y1="0" x2="0" y2="1">
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
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: 'text.primary', mb: 3 }}>
              Average Performance by Weekday
            </Typography>
            <Box sx={{ height: 500, width: "100%", mt: 2, pb: 2 }}>
            <ResponsiveContainer>
              <ComposedChart
                data={["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => ({
                  day,
                  attainment: processedData.weekdayData[day as keyof typeof processedData.weekdayData].avgAttainment || 0,
                  austin: processedData.weekdayData[day as keyof typeof processedData.weekdayData].avgAustin || 0,
                  charlotte: processedData.weekdayData[day as keyof typeof processedData.weekdayData].avgCharlotte || 0,
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
