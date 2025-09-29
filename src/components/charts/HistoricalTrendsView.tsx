// Historical Trends View - Enhanced with forecasting and improved visibility
// Version: 2.1 - Updated chart heights, added forecasting, full-width moving average
import React, { useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  useTheme,
  Skeleton,
  Stack,
  Tabs,
  Tab,
  Divider,
  TextField,
} from "@mui/material";
import Grid from "@mui/material/Grid";
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
} from "recharts";
import { RevenueData, TargetSettings } from "../../types/revenue";
import {
  calculateMonthlyTrends,
  calculateMovingAverage,
  forecastWithLinearRegression,
} from "../../utils/calculations";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import RemoveIcon from "@mui/icons-material/Remove";

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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <Paper
        elevation={2}
        sx={{
          p: 2,
          backgroundColor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="subtitle2" gutterBottom>
          {label}
        </Typography>
        {payload.map((entry: any, index: number) => (
          <Typography key={index} variant="body2" sx={{ color: entry.color }}>
            {entry.name}: {entry.value ? Math.round(entry.value) + "%" : "N/A"}
          </Typography>
        ))}
      </Paper>
    );
  }
  return null;
};

const DataLimitationMessage = ({ message }: { message: string }) => (
  <Typography
    variant="body2"
    color="text.secondary"
    sx={{ mt: 1, textAlign: "center", fontStyle: "italic" }}
  >
    {message}
  </Typography>
);

interface InsightCardProps {
  title: string;
  value: string;
  trend?: number;
  subtitle?: string;
}

const InsightCard = ({ title, value, trend, subtitle }: InsightCardProps) => {
  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUpIcon color="success" />;
    if (trend < 0) return <TrendingDownIcon color="error" />;
    return <RemoveIcon color="action" />;
  };

  const getTrendColor = (trend: number) => {
    if (trend > 0) return "success.main";
    if (trend < 0) return "error.main";
    return "text.secondary";
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: 3,
        height: "100%",
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
        transition: "all 0.2s ease-in-out",
        "&:hover": {
          elevation: 4,
          borderColor: "primary.light",
          transform: "translateY(-2px)",
        },
      }}
    >
      <Stack spacing={2}>
        <Typography
          variant="subtitle1"
          color="text.secondary"
          sx={{ fontWeight: 500 }}
        >
          {title}
        </Typography>
        <Typography
          variant="h3"
          component="div"
          sx={{ fontWeight: 700, color: "text.primary" }}
        >
          {value}
        </Typography>
        {trend !== undefined && (
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{
              p: 1.5,
              borderRadius: 1,
              bgcolor:
                trend > 0
                  ? "success.light"
                  : trend < 0
                  ? "error.light"
                  : "grey.100",
              opacity: 0.8,
            }}
          >
            {getTrendIcon(trend)}
            <Typography
              variant="body2"
              color={getTrendColor(trend)}
              sx={{ fontWeight: 500 }}
            >
              {Math.abs(trend).toFixed(1)}%{" "}
              {trend > 0 ? "increase" : trend < 0 ? "decrease" : "no change"}
            </Typography>
          </Stack>
        )}
        {subtitle && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontWeight: 500 }}
          >
            {subtitle}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
};

// Update the EnhancedTooltip to ensure percentages use whole numbers
const EnhancedTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <Paper
        elevation={2}
        sx={{
          p: 2,
          backgroundColor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          minWidth: 200,
        }}
      >
        <Typography variant="subtitle2" gutterBottom>
          {label}
        </Typography>
        <Divider sx={{ my: 1 }} />
        {/* Revenue Section */}
        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary">
            Revenue
          </Typography>
          <Typography variant="body1" color={payload[0]?.color}>
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              notation: "compact",
            }).format(payload[0]?.value || 0)}
          </Typography>
        </Stack>
        <Divider sx={{ my: 1 }} />
        {/* Attainment Section */}
        <Stack spacing={0.5}>
          {payload.slice(1).map((entry: any, index: number) => (
            <Stack
              key={index}
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography variant="body2" color={entry.color}>
                {entry.name}:
              </Typography>
              <Typography variant="body2" color={entry.color}>
                {Math.round(entry.value)}%
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Paper>
    );
  }
  return null;
};

export const HistoricalTrendsView: React.FC<HistoricalTrendsViewProps> = ({
  data,
  targetSettings,
  isLoading = false,
}) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [futureAgentCounts, setFutureAgentCounts] = useState<{
    [key: string]: number;
  }>({});

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleAgentCountChange = (key: string, value: string) => {
    const count = parseInt(value, 10);
    setFutureAgentCounts((prev) => ({
      ...prev,
      [key]: isNaN(count) ? 0 : count,
    }));
  };

  // Memoize calculations to prevent unnecessary recalculations
  const { monthlyTrends, movingAverageData, insights, forecastData } =
    useMemo(() => {
      if (!data || data.length === 0) {
        return {
          monthlyTrends: [],
          movingAverageData: [],
          insights: null,
          forecastData: [],
        };
      }

      const trends = calculateMonthlyTrends(data, targetSettings);
      const maData = calculateMovingAverage(trends, 3);
      const forecast = forecastWithLinearRegression(trends, futureAgentCounts);

      // Calculate insights
      const currentMonth = trends[trends.length - 1];
      const previousMonth = trends[trends.length - 2];

      const calculateTrend = (current: number, previous: number) =>
        previous ? ((current - previous) / previous) * 100 : 0;

      const insights = {
        revenue: {
          current: currentMonth?.currentYear || 0,
          trend: calculateTrend(
            currentMonth?.currentYear || 0,
            previousMonth?.currentYear || 0
          ),
        },
        austinAttainment: {
          current: currentMonth?.austinAttainment || 0,
          trend: calculateTrend(
            currentMonth?.austinAttainment || 0,
            previousMonth?.austinAttainment || 0
          ),
        },
        charlotteAttainment: {
          current: currentMonth?.charlotteAttainment || 0,
          trend: calculateTrend(
            currentMonth?.charlotteAttainment || 0,
            previousMonth?.charlotteAttainment || 0
          ),
        },
        combinedAttainment: {
          current: currentMonth?.combinedAttainment || 0,
          trend: calculateTrend(
            currentMonth?.combinedAttainment || 0,
            previousMonth?.combinedAttainment || 0
          ),
        },
      };

      return {
        monthlyTrends: trends,
        movingAverageData: maData,
        insights,
        forecastData: forecast,
      };
    }, [data, targetSettings, futureAgentCounts]);

  // Calculate data availability flags
  const dataAvailability = useMemo(() => {
    if (!monthlyTrends || monthlyTrends.length === 0) return {};

    const hasCurrentYearData = monthlyTrends.some(
      (item) => item.currentYear !== null
    );
    const hasPreviousYearData = monthlyTrends.some(
      (item) => item.previousYear !== null
    );
    const hasEnoughDataForMA = monthlyTrends.length >= 2;
    const hasAttainmentData = monthlyTrends.some(
      (item) => item.austinAttainment > 0 || item.charlotteAttainment > 0
    );

    return {
      yearOverYear: hasCurrentYearData || hasPreviousYearData,
      movingAverage: hasEnoughDataForMA,
      performancePatterns: hasAttainmentData,
      monthCount: monthlyTrends.length,
    };
  }, [monthlyTrends]);

  // Calculate Y-axis domains for better visualization
  const yDomains = useMemo(() => {
    if (!monthlyTrends || monthlyTrends.length === 0) return {};

    const revenueValues = monthlyTrends
      .flatMap((item) => [item.currentYear, item.previousYear])
      .filter((val) => val !== null && !isNaN(val)) as number[];

    const attainmentValues = monthlyTrends
      .flatMap((item) => [
        item.austinAttainment,
        item.charlotteAttainment,
        item.combinedAttainment,
      ])
      .filter((val) => val !== null && !isNaN(val));

    const maValues = movingAverageData
      .flatMap((item) => [item.austin, item.charlotte])
      .filter((val) => val !== null && !isNaN(val));

    return {
      revenue: [0, Math.max(...revenueValues) * 1.1],
      attainment: [0, Math.max(...attainmentValues, ...maValues) * 1.1],
    };
  }, [monthlyTrends, movingAverageData]);

  if (isLoading) {
    console.log("Historical trends view is loading");
    return (
      <Grid container spacing={3}>
        <Grid xs={12}>
          <ChartSkeleton />
        </Grid>
        <Grid xs={12} md={6}>
          <ChartSkeleton />
        </Grid>
        <Grid xs={12} md={6}>
          <ChartSkeleton />
        </Grid>
      </Grid>
    );
  }

  if (!data || data.length === 0) {
    console.log("No data available for historical trends");
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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value / 100);

  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={4}>
        {/* Insights Summary */}
        {insights && (
          <>
            <Grid xs={12} md={3}>
              <InsightCard
                title="Monthly Revenue"
                value={formatCurrency(insights.revenue.current)}
                trend={insights.revenue.trend}
                subtitle="vs. Previous Month"
              />
            </Grid>
            <Grid xs={12} md={3}>
              <InsightCard
                title="Austin Attainment"
                value={formatPercent(insights.austinAttainment.current)}
                trend={insights.austinAttainment.trend}
                subtitle="vs. Previous Month"
              />
            </Grid>
            <Grid xs={12} md={3}>
              <InsightCard
                title="Charlotte Attainment"
                value={formatPercent(insights.charlotteAttainment.current)}
                trend={insights.charlotteAttainment.trend}
                subtitle="vs. Previous Month"
              />
            </Grid>
            <Grid xs={12} md={3}>
              <InsightCard
                title="Combined Attainment"
                value={formatPercent(insights.combinedAttainment.current)}
                trend={insights.combinedAttainment.trend}
                subtitle="vs. Previous Month"
              />
            </Grid>
          </>
        )}

        <Grid xs={12}>
          <Paper sx={{ width: "100%" }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              indicatorColor="primary"
              textColor="primary"
              variant="fullWidth"
            >
              <Tab label="Performance Overview" />
              <Tab label="Moving Average & Forecast" />
            </Tabs>
          </Paper>
        </Grid>

        {/* Tab Content */}
        {activeTab === 0 && (
          <Grid xs={12}>
            <Paper
              elevation={3}
              sx={{
                p: 4,
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
                background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
              }}
            >
              <Typography
                variant="h5"
                gutterBottom
                sx={{ fontWeight: 600, color: "text.primary", mb: 3 }}
              >
                Historical Performance Overview
              </Typography>
              <Box sx={{ height: 650, width: "100%", mt: 2, pb: 2, position: "relative" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={monthlyTrends}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={theme.palette.divider}
                    />
                    <XAxis
                      dataKey="month"
                      tick={{
                        fill: theme.palette.text.secondary,
                        fontSize: 12,
                      }}
                      stroke={theme.palette.divider}
                      tickLine={false}
                      axisLine={{ stroke: theme.palette.divider }}
                      height={50}
                    />
                    {/* Revenue Axis */}
                    <YAxis
                      yAxisId="revenue"
                      tickFormatter={formatCurrency}
                      tick={{
                        fill: theme.palette.text.secondary,
                        fontSize: 12,
                      }}
                      stroke={theme.palette.divider}
                      domain={[0, (dataMax: number) => dataMax * 1.1]}
                      tickLine={false}
                      axisLine={{ stroke: theme.palette.divider }}
                    />
                    {/* Attainment Axis */}
                    <YAxis
                      yAxisId="attainment"
                      orientation="right"
                      tickFormatter={formatPercent}
                      tick={{
                        fill: theme.palette.text.secondary,
                        fontSize: 12,
                      }}
                      stroke={theme.palette.divider}
                      domain={[0, 1.5]}
                      tickLine={false}
                      axisLine={{ stroke: theme.palette.divider }}
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
                    {/* Revenue Bar */}
                    <Bar
                      yAxisId="revenue"
                      dataKey="currentYear"
                      name="Revenue"
                      fill={theme.palette.primary.main}
                      fillOpacity={0.8}
                      barSize={60}
                    />
                    {/* Attainment Lines */}
                    <Line
                      yAxisId="attainment"
                      type="monotone"
                      dataKey="austinAttainment"
                      name="Austin Attainment"
                      stroke={theme.palette.info.main}
                      strokeWidth={2}
                      dot={{ r: 4, strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      yAxisId="attainment"
                      type="monotone"
                      dataKey="charlotteAttainment"
                      name="Charlotte Attainment"
                      stroke={theme.palette.secondary.main}
                      strokeWidth={2}
                      dot={{ r: 4, strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      yAxisId="attainment"
                      type="monotone"
                      dataKey="combinedAttainment"
                      name="Combined Attainment"
                      stroke={theme.palette.success.main}
                      strokeWidth={3}
                      dot={{ r: 5, strokeWidth: 2 }}
                      activeDot={{ r: 7 }}
                    />
                    {/* Target Reference Line */}
                    <ReferenceLine
                      yAxisId="attainment"
                      y={100}
                      stroke={theme.palette.warning.main}
                      strokeDasharray="3 3"
                      label={{
                        value: "Target",
                        fill: theme.palette.warning.main,
                        position: "right",
                        fontSize: 12,
                      }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 2, textAlign: "center" }}
              >
                Bars represent monthly revenue while lines show attainment
                percentages
              </Typography>
            </Paper>
          </Grid>
        )}

        {activeTab === 1 && (
          <Grid container spacing={4} xs={12}>
            {/* Moving Average */}
            <Grid xs={12}>
              <Paper
                elevation={3}
                sx={{
                  p: 4,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  background:
                    "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
                }}
              >
                <Typography
                  variant="h5"
                  gutterBottom
                  sx={{ fontWeight: 600, color: "text.primary", mb: 3 }}
                >
                  3-Month Moving Average & Forecast
                </Typography>
                <Box sx={{ height: 600, width: "100%", mt: 2, pb: 2, position: "relative" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={movingAverageData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={theme.palette.divider}
                      />
                      <XAxis
                        dataKey="month"
                        tick={{
                          fill: theme.palette.text.secondary,
                          fontSize: 12,
                        }}
                        stroke={theme.palette.divider}
                        tickLine={false}
                        axisLine={{ stroke: theme.palette.divider }}
                        height={50}
                      />
                      <YAxis
                        tickFormatter={formatPercent}
                        tick={{
                          fill: theme.palette.text.secondary,
                          fontSize: 12,
                        }}
                        stroke={theme.palette.divider}
                        tickLine={false}
                        axisLine={{ stroke: theme.palette.divider }}
                      />
                      <Tooltip
                        formatter={(value: any) => [
                          formatPercent(value),
                          "Moving Average",
                        ]}
                        contentStyle={{
                          backgroundColor: theme.palette.background.paper,
                          border: `1px solid ${theme.palette.divider}`,
                          borderRadius: "8px",
                        }}
                      />
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
                      <Area
                        type="monotone"
                        dataKey="austin"
                        name="Austin MA"
                        fill={theme.palette.primary.light}
                        stroke={theme.palette.primary.main}
                        fillOpacity={0.3}
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="charlotte"
                        name="Charlotte MA"
                        fill={theme.palette.secondary.light}
                        stroke={theme.palette.secondary.main}
                        fillOpacity={0.3}
                        strokeWidth={2}
                      />
                      {/* Target Reference Line */}
                      <ReferenceLine
                        y={100}
                        stroke={theme.palette.warning.main}
                        strokeDasharray="3 3"
                        label={{
                          value: "Target",
                          fill: theme.palette.warning.main,
                          position: "right",
                          fontSize: 12,
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 2, textAlign: "center" }}
                >
                  3-month moving average shows smoothed performance trends over
                  time
                </Typography>
              </Paper>
            </Grid>

            {/* Forecasting Section */}
            <Grid xs={12}>
              <Paper
                elevation={3}
                sx={{
                  p: 4,
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
                  Revenue Forecast
                </Typography>
                <Grid container spacing={2}>
                  {Array.from({ length: 3 }).map((_, index) => {
                    const date = new Date();
                    date.setMonth(date.getMonth() + index + 1);
                    const year = date.getFullYear();
                    const month = date.getMonth();
                    const key = `${year}-${month}`;
                    return (
                      <Grid xs={12} md={4} key={key}>
                        <TextField
                          fullWidth
                          label={`${date.toLocaleString("default", {
                            month: "long",
                          })} ${year} - Agents`}
                          type="number"
                          value={futureAgentCounts[key] || ""}
                          onChange={(e) =>
                            handleAgentCountChange(key, e.target.value)
                          }
                        />
                      </Grid>
                    );
                  })}
                </Grid>
                {forecastData.length > 0 && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      Predicted Revenue
                    </Typography>
                    {forecastData.map((forecast) => (
                      <Typography
                        key={`${forecast.year}-${forecast.month}`}
                        variant="body1"
                      >
                        {new Date(forecast.year, forecast.month).toLocaleString(
                          "default",
                          { month: "long" }
                        )}{" "}
                        {forecast.year}:{" "}
                        {formatCurrency(forecast.predictedRevenue)}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};
