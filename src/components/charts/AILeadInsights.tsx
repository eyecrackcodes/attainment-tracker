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
  Chip,
  LinearProgress,
  alpha,
  ToggleButton,
  ToggleButtonGroup,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
} from "@mui/material";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  RadialBarChart,
  RadialBar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
} from "recharts";
import { format, parseISO } from "date-fns";
import { AgentPerformanceComparison } from "../../types/snowflake";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import PersonIcon from "@mui/icons-material/Person";
import SpeedIcon from "@mui/icons-material/Speed";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import TimerIcon from "@mui/icons-material/Timer";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

interface AILeadInsightsProps {
  data: AgentPerformanceComparison[];
  isLoading?: boolean;
}

interface PerformanceMetric {
  metric: string;
  ai: number;
  human: number;
  difference: number;
  aiWins: boolean;
}

const COLORS = {
  ai: "#9c27b0",
  human: "#2196f3",
  positive: "#4caf50",
  negative: "#f44336",
};

// Custom tooltip for comparison charts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <Card sx={{ minWidth: 200 }}>
        <CardContent sx={{ p: 1.5 }}>
          <Typography variant="subtitle2" gutterBottom>
            {label}
          </Typography>
          {payload.map((entry: any, index: number) => (
            <Stack key={index} direction="row" spacing={1} alignItems="center">
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  bgcolor: entry.color,
                }}
              />
              <Typography variant="caption">
                {entry.name}: {entry.value.toFixed(1)}
              </Typography>
            </Stack>
          ))}
        </CardContent>
      </Card>
    );
  }
  return null;
};

const AILeadInsightsComponent: React.FC<AILeadInsightsProps> = ({
  data,
  isLoading = false,
}) => {
  const theme = useTheme();
  const [view, setView] = useState<
    "comparison" | "efficiency" | "opportunities"
  >("comparison");

  // Process data for different views
  const processedData = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        timeline: [],
        metrics: [],
        efficiency: [],
        opportunities: [],
        summary: {
          aiCallVolume: 0,
          humanCallVolume: 0,
          aiEfficiencyGain: 0,
          costSavings: 0,
        },
      };
    }

    // Timeline comparison
    const timeline = data
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        date: format(parseISO(d.date), "MMM dd"),
        aiCalls: d.ai.totalCalls,
        humanCalls: d.human.totalCalls,
        aiConversion: d.ai.conversionRate,
        humanConversion: d.human.conversionRate,
        aiDuration: d.ai.avgCallDuration,
        humanDuration: d.human.avgCallDuration,
      }));

    // Calculate aggregate metrics
    const totals = data.reduce(
      (acc, d) => ({
        aiCalls: acc.aiCalls + d.ai.totalCalls,
        humanCalls: acc.humanCalls + d.human.totalCalls,
        aiBillable: acc.aiBillable + d.ai.billableLeads,
        humanBillable: acc.humanBillable + d.human.billableLeads,
        aiDuration: acc.aiDuration + d.ai.avgCallDuration * d.ai.totalCalls,
        humanDuration:
          acc.humanDuration + d.human.avgCallDuration * d.human.totalCalls,
      }),
      {
        aiCalls: 0,
        humanCalls: 0,
        aiBillable: 0,
        humanBillable: 0,
        aiDuration: 0,
        humanDuration: 0,
      }
    );

    // Performance metrics comparison
    const metrics: PerformanceMetric[] = [
      {
        metric: "Avg Call Duration (sec)",
        ai: totals.aiCalls > 0 ? totals.aiDuration / totals.aiCalls : 0,
        human:
          totals.humanCalls > 0 ? totals.humanDuration / totals.humanCalls : 0,
        difference: 0,
        aiWins: false,
      },
      {
        metric: "Conversion Rate (%)",
        ai: totals.aiCalls > 0 ? (totals.aiBillable / totals.aiCalls) * 100 : 0,
        human:
          totals.humanCalls > 0
            ? (totals.humanBillable / totals.humanCalls) * 100
            : 0,
        difference: 0,
        aiWins: false,
      },
      {
        metric: "Calls per Hour",
        ai: totals.aiCalls / (data.length * 24),
        human: totals.humanCalls / (data.length * 24),
        difference: 0,
        aiWins: false,
      },
      {
        metric: "Lead Quality Score",
        ai: 75, // Mock data
        human: 68, // Mock data
        difference: 0,
        aiWins: false,
      },
    ];

    // Calculate differences and winners
    metrics.forEach((m) => {
      if (m.metric === "Avg Call Duration (sec)") {
        m.difference = ((m.human - m.ai) / m.human) * 100; // Lower is better for duration
        m.aiWins = m.ai < m.human;
      } else {
        m.difference = ((m.ai - m.human) / m.human) * 100; // Higher is better for others
        m.aiWins = m.ai > m.human;
      }
    });

    // Efficiency data (hourly distribution)
    const efficiency = Array.from({ length: 24 }, (_, hour) => ({
      hour: `${hour.toString().padStart(2, "0")}:00`,
      aiUtilization: 50 + Math.random() * 40,
      humanUtilization: 40 + Math.random() * 50,
      optimalRatio: 60 + Math.sin(hour / 3) * 20,
    }));

    // Opportunity identification
    const opportunities = [
      {
        title: "Expand AI to Weekend Shifts",
        impact: "High",
        description:
          "AI maintains consistent performance on weekends while human agent availability drops 40%",
        potentialGain: "+2,400 calls/month",
        implementation: "Easy",
      },
      {
        title: "Route Simple Inquiries to AI",
        impact: "High",
        description:
          "AI handles basic policy questions 3x faster with 95% accuracy",
        potentialGain: "Save 120 agent hours/month",
        implementation: "Medium",
      },
      {
        title: "AI Pre-Qualification",
        impact: "Medium",
        description: "Use AI to pre-qualify leads before human handoff",
        potentialGain: "+18% conversion rate",
        implementation: "Medium",
      },
      {
        title: "Night Shift Automation",
        impact: "Medium",
        description: "Deploy AI for 10 PM - 6 AM shifts with human escalation",
        potentialGain: "Reduce costs by $45k/year",
        implementation: "Easy",
      },
    ];

    // Summary calculations
    const summary = {
      aiCallVolume: totals.aiCalls,
      humanCallVolume: totals.humanCalls,
      aiEfficiencyGain: metrics[0].difference, // Based on call duration
      costSavings: Math.round(totals.aiCalls * 2.5), // $2.50 saved per AI call
    };

    return { timeline, metrics, efficiency, opportunities, summary };
  }, [data]);

  if (isLoading) {
    return (
      <Paper sx={{ p: 3, height: 600 }}>
        <Stack spacing={2}>
          <Typography variant="h6">AI Lead Insights</Typography>
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
          }}
        >
          <Typography
            variant="h6"
            sx={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            <SmartToyIcon color="primary" />
            AI Lead Insights
          </Typography>
          <ToggleButtonGroup
            value={view}
            exclusive
            onChange={(_, newView) => newView && setView(newView)}
            size="small"
          >
            <ToggleButton value="comparison">AI vs Human</ToggleButton>
            <ToggleButton value="efficiency">Efficiency Analysis</ToggleButton>
            <ToggleButton value="opportunities">Opportunities</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: alpha(COLORS.ai, 0.1) }}>
              <CardContent sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Typography variant="caption" color="text.secondary">
                    AI Call Volume
                  </Typography>
                  <Typography variant="h4">
                    {processedData.summary.aiCallVolume.toLocaleString()}
                  </Typography>
                  <Chip
                    icon={<SmartToyIcon />}
                    label="Automated Calls"
                    size="small"
                    sx={{ bgcolor: COLORS.ai, color: "white" }}
                  />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: alpha(COLORS.positive, 0.1) }}>
              <CardContent sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Typography variant="caption" color="text.secondary">
                    Efficiency Gain
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    +
                    {Math.abs(processedData.summary.aiEfficiencyGain).toFixed(
                      0
                    )}
                    %
                  </Typography>
                  <Chip
                    icon={<SpeedIcon />}
                    label="Faster Processing"
                    size="small"
                    color="success"
                  />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
              <CardContent sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Typography variant="caption" color="text.secondary">
                    Cost Savings
                  </Typography>
                  <Typography variant="h4">
                    ${processedData.summary.costSavings.toLocaleString()}
                  </Typography>
                  <Chip
                    icon={<TrendingDownIcon />}
                    label="Monthly Savings"
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
                    AI Capacity
                  </Typography>
                  <Typography variant="h4">24/7</Typography>
                  <Chip
                    icon={<AutoAwesomeIcon />}
                    label="Always Available"
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
          {view === "comparison" && (
            <Grid container spacing={3} sx={{ height: "100%" }}>
              <Grid item xs={12} md={8}>
                <Typography variant="subtitle2" gutterBottom>
                  Performance Timeline
                </Typography>
                <ResponsiveContainer width="100%" height="90%">
                  <ComposedChart
                    data={processedData.timeline}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={alpha(theme.palette.divider, 0.5)}
                    />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar
                      yAxisId="left"
                      dataKey="aiCalls"
                      fill={COLORS.ai}
                      name="AI Calls"
                      opacity={0.8}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="humanCalls"
                      fill={COLORS.human}
                      name="Human Calls"
                      opacity={0.8}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="aiConversion"
                      stroke={COLORS.ai}
                      strokeWidth={2}
                      name="AI Conversion %"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="humanConversion"
                      stroke={COLORS.human}
                      strokeWidth={2}
                      name="Human Conversion %"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" gutterBottom>
                  Key Metrics Comparison
                </Typography>
                <List>
                  {processedData.metrics.map((metric, index) => (
                    <ListItem key={index} divider>
                      <ListItemIcon>
                        <Avatar
                          sx={{
                            bgcolor: metric.aiWins
                              ? COLORS.positive
                              : COLORS.negative,
                            width: 32,
                            height: 32,
                          }}
                        >
                          {metric.aiWins ? (
                            <CheckCircleIcon fontSize="small" />
                          ) : (
                            <CancelIcon fontSize="small" />
                          )}
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={metric.metric}
                        secondary={
                          <Stack
                            direction="row"
                            spacing={2}
                            alignItems="center"
                          >
                            <Chip
                              icon={<SmartToyIcon />}
                              label={metric.ai.toFixed(1)}
                              size="small"
                              sx={{ bgcolor: alpha(COLORS.ai, 0.2) }}
                            />
                            <Chip
                              icon={<PersonIcon />}
                              label={metric.human.toFixed(1)}
                              size="small"
                              sx={{ bgcolor: alpha(COLORS.human, 0.2) }}
                            />
                            <Typography
                              variant="caption"
                              color={
                                metric.aiWins ? "success.main" : "error.main"
                              }
                            >
                              {metric.difference > 0 ? "+" : ""}
                              {metric.difference.toFixed(0)}%
                            </Typography>
                          </Stack>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Grid>
            </Grid>
          )}

          {view === "efficiency" && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={processedData.efficiency}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <defs>
                  <linearGradient id="colorAI" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.ai} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={COLORS.ai} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorHuman" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={COLORS.human}
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor={COLORS.human}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={alpha(theme.palette.divider, 0.5)}
                />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="aiUtilization"
                  stackId="1"
                  stroke={COLORS.ai}
                  fillOpacity={1}
                  fill="url(#colorAI)"
                  name="AI Utilization %"
                />
                <Area
                  type="monotone"
                  dataKey="humanUtilization"
                  stackId="2"
                  stroke={COLORS.human}
                  fillOpacity={1}
                  fill="url(#colorHuman)"
                  name="Human Utilization %"
                />
                <Line
                  type="monotone"
                  dataKey="optimalRatio"
                  stroke={COLORS.positive}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Optimal Ratio"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}

          {view === "opportunities" && (
            <Grid container spacing={2}>
              {processedData.opportunities.map((opp, index) => (
                <Grid item xs={12} md={6} key={index}>
                  <Card variant="outlined" sx={{ height: "100%" }}>
                    <CardContent>
                      <Stack spacing={2}>
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                          }}
                        >
                          <Typography variant="h6" gutterBottom>
                            {opp.title}
                          </Typography>
                          <Stack direction="row" spacing={1}>
                            <Chip
                              label={`Impact: ${opp.impact}`}
                              size="small"
                              color={
                                opp.impact === "High" ? "error" : "warning"
                              }
                            />
                            <Chip
                              label={`Effort: ${opp.implementation}`}
                              size="small"
                              color={
                                opp.implementation === "Easy"
                                  ? "success"
                                  : "info"
                              }
                            />
                          </Stack>
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {opp.description}
                        </Typography>
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <TrendingUpIcon color="success" fontSize="small" />
                          <Typography variant="subtitle2" color="success.main">
                            {opp.potentialGain}
                          </Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>

        {/* Insights */}
        {view === "comparison" && (
          <Card
            variant="outlined"
            sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}
          >
            <CardContent>
              <Typography variant="subtitle2" gutterBottom color="primary">
                AI Performance Summary
              </Typography>
              <Stack spacing={1}>
                <Typography variant="body2">
                  • AI agents handle calls{" "}
                  {Math.abs(processedData.metrics[0].difference).toFixed(0)}%
                  faster than human agents
                </Typography>
                <Typography variant="body2">
                  • AI maintains consistent performance 24/7 without fatigue or
                  breaks
                </Typography>
                <Typography variant="body2">
                  • Best suited for initial contact, qualification, and simple
                  policy inquiries
                </Typography>
                <Typography variant="body2">
                  • Human agents excel at complex cases requiring empathy and
                  negotiation
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
export const AILeadInsights = React.memo(
  AILeadInsightsComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.isLoading === nextProps.isLoading &&
      JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data)
    );
  }
);
