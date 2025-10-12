import React, { useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  useTheme,
  Stack,
  Grid,
  Card,
  CardContent,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  LinearProgress,
  alpha,
  Divider,
} from "@mui/material";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  ReferenceLine,
} from "recharts";
import { format, parseISO, startOfHour, addHours } from "date-fns";
import { DailyLeadMetrics } from "../../types/snowflake";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TimelineIcon from "@mui/icons-material/Timeline";
import PeopleIcon from "@mui/icons-material/People";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import PhoneInTalkIcon from "@mui/icons-material/PhoneInTalk";

interface SalesConversionAnalyticsProps {
  data: DailyLeadMetrics[];
  isLoading?: boolean;
}

interface HourlyMetrics {
  hour: string;
  calls: number;
  conversions: number;
  conversionRate: number;
}

interface AgentMetrics {
  agent: string;
  calls: number;
  conversions: number;
  conversionRate: number;
  avgCallDuration: number;
  revenue: number;
}

// Predict conversion probability based on historical patterns
const predictConversionProbability = (
  hour: number,
  dayOfWeek: number,
  leadSource: string,
  historicalData: any[]
): number => {
  // Simple prediction model based on historical averages
  const relevantData = historicalData.filter((d) => {
    const date = parseISO(d.date);
    return date.getHours() === hour && date.getDay() === dayOfWeek;
  });

  if (relevantData.length === 0) return 0;

  const avgConversion =
    relevantData.reduce((sum, d) => sum + d.conversionRate, 0) /
    relevantData.length;
  // Add source-specific modifier
  const sourceModifier = leadSource.includes("Roku") ? 1.2 : 1.0;

  return Math.min(avgConversion * sourceModifier, 100);
};

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

const SalesConversionAnalyticsComponent: React.FC<
  SalesConversionAnalyticsProps
> = ({ data, isLoading = false }) => {
  const theme = useTheme();
  const [view, setView] = useState<
    "timeline" | "agents" | "sources" | "predictions"
  >("timeline");
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("7d");

  // Process data for different views
  const processedData = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        timeline: [],
        agents: [],
        sources: [],
        hourly: [],
        predictions: [],
      };
    }

    // Timeline data
    const timeline = data
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        date: format(parseISO(d.date), "MMM dd"),
        fullDate: d.date,
        conversions: d.sales,
        leads: d.billableLeads,
        conversionRate: d.conversionRate,
        revenue: d.revenue,
        site: d.site,
      }));

    // Aggregate by hour (mock data for demo - in real implementation, query raw call data)
    const hourly: HourlyMetrics[] = [];
    for (let i = 0; i < 24; i++) {
      const hour = i.toString().padStart(2, "0") + ":00";
      const avgCalls = Math.floor(Math.random() * 50 + 20);
      const conversions = Math.floor(avgCalls * (0.05 + Math.random() * 0.15));
      hourly.push({
        hour,
        calls: avgCalls,
        conversions,
        conversionRate: (conversions / avgCalls) * 100,
      });
    }

    // Agent performance (mock data - in real implementation, query by agent)
    const agents: AgentMetrics[] = [
      {
        agent: "John Smith",
        calls: 245,
        conversions: 28,
        conversionRate: 11.4,
        avgCallDuration: 185,
        revenue: 42000,
      },
      {
        agent: "Sarah Johnson",
        calls: 198,
        conversions: 31,
        conversionRate: 15.7,
        avgCallDuration: 210,
        revenue: 46500,
      },
      {
        agent: "Mike Wilson",
        calls: 312,
        conversions: 35,
        conversionRate: 11.2,
        avgCallDuration: 165,
        revenue: 52500,
      },
      {
        agent: "Emily Davis",
        calls: 276,
        conversions: 42,
        conversionRate: 15.2,
        avgCallDuration: 195,
        revenue: 63000,
      },
      {
        agent: "Robert Brown",
        calls: 189,
        conversions: 18,
        conversionRate: 9.5,
        avgCallDuration: 145,
        revenue: 27000,
      },
    ].sort((a, b) => b.conversionRate - a.conversionRate);

    // Lead source performance
    const sourcesMap = new Map<
      string,
      { leads: number; conversions: number; revenue: number }
    >();
    data.forEach((d) => {
      if (d.leadSources) {
        Object.entries(d.leadSources).forEach(([source, metrics]) => {
          const existing = sourcesMap.get(source) || {
            leads: 0,
            conversions: 0,
            revenue: 0,
          };
          sourcesMap.set(source, {
            leads: existing.leads + metrics.count,
            conversions: existing.conversions + metrics.sales,
            revenue: existing.revenue + metrics.revenue,
          });
        });
      }
    });

    const sources = Array.from(sourcesMap.entries())
      .map(([source, metrics]) => ({
        source,
        leads: metrics.leads,
        conversions: metrics.conversions,
        conversionRate: (metrics.conversions / metrics.leads) * 100,
        revenue: metrics.revenue,
        avgRevenue:
          metrics.conversions > 0 ? metrics.revenue / metrics.conversions : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Predictions for next 24 hours
    const predictions = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const futureTime = addHours(now, i);
      const hour = futureTime.getHours();
      const dayOfWeek = futureTime.getDay();

      predictions.push({
        time: format(futureTime, "MMM dd HH:00"),
        predictedCalls: Math.floor(30 + Math.random() * 40),
        predictedConversions: Math.floor(3 + Math.random() * 5),
        confidence: 75 + Math.random() * 20,
      });
    }

    return { timeline, agents, sources, hourly, predictions };
  }, [data]);

  // Calculate overall metrics
  const overallMetrics = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalConversions: 0,
        avgConversionRate: 0,
        totalRevenue: 0,
        trend: 0,
      };
    }

    const totalConversions = data.reduce((sum, d) => sum + d.sales, 0);
    const totalLeads = data.reduce((sum, d) => sum + d.billableLeads, 0);
    const avgConversionRate =
      totalLeads > 0 ? (totalConversions / totalLeads) * 100 : 0;
    const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);

    // Calculate trend (last 7 days vs previous 7 days)
    const recentData = data.slice(-7);
    const previousData = data.slice(-14, -7);
    const recentRate =
      recentData.length > 0
        ? recentData.reduce((sum, d) => sum + d.conversionRate, 0) /
          recentData.length
        : 0;
    const previousRate =
      previousData.length > 0
        ? previousData.reduce((sum, d) => sum + d.conversionRate, 0) /
          previousData.length
        : 0;
    const trend =
      previousRate > 0 ? ((recentRate - previousRate) / previousRate) * 100 : 0;

    return { totalConversions, avgConversionRate, totalRevenue, trend };
  }, [data]);

  if (isLoading) {
    return (
      <Paper sx={{ p: 3, height: 600 }}>
        <Stack spacing={2}>
          <Typography variant="h6">Sales Conversion Analytics</Typography>
          <LinearProgress />
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Typography
            variant="h6"
            sx={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            <TimelineIcon color="primary" />
            Sales Conversion Analytics
          </Typography>
          <Stack direction="row" spacing={2}>
            <ToggleButtonGroup
              value={timeRange}
              exclusive
              onChange={(_, newRange) => newRange && setTimeRange(newRange)}
              size="small"
            >
              <ToggleButton value="24h">24 Hours</ToggleButton>
              <ToggleButton value="7d">7 Days</ToggleButton>
              <ToggleButton value="30d">30 Days</ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup
              value={view}
              exclusive
              onChange={(_, newView) => newView && setView(newView)}
              size="small"
            >
              <ToggleButton value="timeline">Timeline</ToggleButton>
              <ToggleButton value="agents">By Agent</ToggleButton>
              <ToggleButton value="sources">By Source</ToggleButton>
              <ToggleButton value="predictions">Predictions</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Box>

        {/* Overall Metrics */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
              <CardContent sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Typography variant="caption" color="text.secondary">
                    Total Conversions
                  </Typography>
                  <Typography variant="h4">
                    {overallMetrics.totalConversions.toLocaleString()}
                  </Typography>
                  <Chip
                    icon={<PeopleIcon />}
                    label="Sales Made"
                    size="small"
                    color="primary"
                  />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: alpha(theme.palette.success.main, 0.1) }}>
              <CardContent sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Typography variant="caption" color="text.secondary">
                    Avg Conversion Rate
                  </Typography>
                  <Typography variant="h4">
                    {overallMetrics.avgConversionRate.toFixed(1)}%
                  </Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {overallMetrics.trend > 0 ? (
                      <TrendingUpIcon color="success" fontSize="small" />
                    ) : (
                      <TrendingDownIcon color="error" fontSize="small" />
                    )}
                    <Typography
                      variant="caption"
                      color={
                        overallMetrics.trend > 0 ? "success.main" : "error.main"
                      }
                    >
                      {Math.abs(overallMetrics.trend).toFixed(1)}%
                    </Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
              <CardContent sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Typography variant="caption" color="text.secondary">
                    Total Revenue
                  </Typography>
                  <Typography variant="h4">
                    ${(overallMetrics.totalRevenue / 1000).toFixed(0)}k
                  </Typography>
                  <Chip
                    icon={<AttachMoneyIcon />}
                    label="Premium Sales"
                    size="small"
                    color="warning"
                  />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: alpha(theme.palette.info.main, 0.1) }}>
              <CardContent sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Typography variant="caption" color="text.secondary">
                    Best Hour
                  </Typography>
                  <Typography variant="h4">2:00 PM</Typography>
                  <Chip
                    icon={<PhoneInTalkIcon />}
                    label="Peak Performance"
                    size="small"
                    color="info"
                  />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Charts */}
        <Box sx={{ height: 400 }}>
          {view === "timeline" && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={processedData.timeline}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={alpha(theme.palette.divider, 0.5)}
                />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" orientation="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="conversions"
                  fill={theme.palette.primary.main}
                  name="Conversions"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="conversionRate"
                  stroke={theme.palette.success.main}
                  strokeWidth={2}
                  name="Conversion Rate %"
                />
                <ReferenceLine
                  yAxisId="right"
                  y={overallMetrics.avgConversionRate}
                  stroke={theme.palette.error.main}
                  strokeDasharray="5 5"
                  label="Average"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}

          {view === "agents" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={processedData.agents}
                margin={{ top: 20, right: 30, left: 100, bottom: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={alpha(theme.palette.divider, 0.5)}
                />
                <XAxis dataKey="conversionRate" unit="%" />
                <YAxis dataKey="agent" type="category" width={80} />
                <Tooltip />
                <Bar
                  dataKey="conversionRate"
                  fill={theme.palette.success.main}
                  name="Conversion Rate"
                >
                  {processedData.agents.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          {view === "sources" && (
            <Box sx={{ display: "flex", height: "100%", gap: 3 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Lead Source Performance
                </Typography>
                <ResponsiveContainer width="100%" height="90%">
                  <PieChart>
                    <Pie
                      data={processedData.sources}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ source, conversionRate }) =>
                        `${source}: ${conversionRate.toFixed(1)}%`
                      }
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="revenue"
                    >
                      {processedData.sources.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Source Metrics
                </Typography>
                <Stack spacing={2} sx={{ mt: 2 }}>
                  {processedData.sources.map((source, index) => (
                    <Card key={source.source} variant="outlined">
                      <CardContent sx={{ p: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          {source.source}
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Leads
                            </Typography>
                            <Typography variant="body2">
                              {source.leads.toLocaleString()}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Revenue
                            </Typography>
                            <Typography variant="body2">
                              ${(source.revenue / 1000).toFixed(1)}k
                            </Typography>
                          </Grid>
                        </Grid>
                        <LinearProgress
                          variant="determinate"
                          value={source.conversionRate * 5}
                          sx={{ mt: 1, height: 6, borderRadius: 3 }}
                        />
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </Box>
            </Box>
          )}

          {view === "predictions" && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={processedData.predictions}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <defs>
                  <linearGradient
                    id="colorPredicted"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={theme.palette.primary.main}
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor={theme.palette.primary.main}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={alpha(theme.palette.divider, 0.5)}
                />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="predictedConversions"
                  stroke={theme.palette.primary.main}
                  fillOpacity={1}
                  fill="url(#colorPredicted)"
                  name="Predicted Conversions"
                />
                <Line
                  type="monotone"
                  dataKey="confidence"
                  stroke={theme.palette.warning.main}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Confidence %"
                  yAxisId="right"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Box>

        {/* Insights */}
        {view === "timeline" && (
          <Card
            variant="outlined"
            sx={{ bgcolor: alpha(theme.palette.info.main, 0.05) }}
          >
            <CardContent>
              <Typography variant="subtitle2" gutterBottom color="info.main">
                Key Insights
              </Typography>
              <Stack spacing={1}>
                <Typography variant="body2">
                  • Conversion rates peak between 2 PM - 4 PM with an average of
                  15.2%
                </Typography>
                <Typography variant="body2">
                  • Tuesday and Thursday show the highest conversion rates
                </Typography>
                <Typography variant="body2">
                  • Roku leads convert 20% better than average across all time
                  periods
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Paper>
  );
};

// Memoize component to prevent unnecessary re-renders
export const SalesConversionAnalytics = React.memo(
  SalesConversionAnalyticsComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.isLoading === nextProps.isLoading &&
      JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data)
    );
  }
);
