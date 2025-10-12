import React, { useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  useTheme,
  Stack,
  Chip,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Card,
  CardContent,
  LinearProgress,
  alpha,
} from "@mui/material";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from "recharts";
import { LeadQualityData } from "../../types/snowflake";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import StarIcon from "@mui/icons-material/Star";
import PersonIcon from "@mui/icons-material/Person";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import AssessmentIcon from "@mui/icons-material/Assessment";

interface LeadQualityScoreProps {
  data: LeadQualityData[];
  isLoading?: boolean;
}

// Calculate quality score based on multiple factors
const calculateQualityScore = (
  conversionRate: number,
  avgPremium: number,
  totalLeads: number
): number => {
  // Normalize factors
  const conversionScore = Math.min(conversionRate * 2, 100); // Max 50 points
  const premiumScore = Math.min((avgPremium / 1000) * 30, 30); // Max 30 points
  const volumeScore = Math.min((totalLeads / 100) * 20, 20); // Max 20 points

  return Math.round(conversionScore + premiumScore + volumeScore);
};

// Get color based on quality score
const getScoreColor = (score: number): string => {
  if (score >= 80) return "#4caf50";
  if (score >= 60) return "#ff9800";
  if (score >= 40) return "#ff5722";
  return "#f44336";
};

// Custom tooltip for scatter plot
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <Card sx={{ minWidth: 200 }}>
        <CardContent sx={{ p: 1.5 }}>
          <Typography variant="subtitle2" gutterBottom>
            {data.leadSource}
          </Typography>
          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary">
              Conversion Rate: {data.conversionRate.toFixed(1)}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Avg Premium: ${data.avgPremium.toFixed(0)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total Leads: {data.totalLeads}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontWeight: "bold",
                color: getScoreColor(data.qualityScore),
              }}
            >
              Quality Score: {data.qualityScore}
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    );
  }
  return null;
};

const LeadQualityScoreComponent: React.FC<LeadQualityScoreProps> = ({
  data,
  isLoading = false,
}) => {
  const theme = useTheme();
  const [view, setView] = useState<"scatter" | "demographics" | "sources">(
    "scatter"
  );

  // Process data for different views
  const processedData = useMemo(() => {
    if (!data || data.length === 0)
      return { scatter: [], demographics: [], sources: [] };

    // Limit data to prevent performance issues
    const MAX_SCATTER_POINTS = 100;
    const limitedData = data.length > MAX_SCATTER_POINTS 
      ? data.slice(0, MAX_SCATTER_POINTS) 
      : data;

    // Add calculated quality scores
    const dataWithScores = limitedData.map((item) => ({
      ...item,
      qualityScore: calculateQualityScore(
        item.conversionRate,
        item.avgPremium,
        item.totalLeads
      ),
    }));

    // Scatter plot data
    const scatter = dataWithScores.filter((d) => d.totalLeads > 10); // Filter out low volume

    // Demographics radar chart data
    const demographicsMap = new Map<
      string,
      { conversions: number; total: number; premium: number }
    >();

    // Use the original data for aggregations to get accurate totals
    data.forEach((item) => {
      const key = `${item.ageGroup}_${item.gender}_${item.smokerStatus}`;
      const existing = demographicsMap.get(key) || {
        conversions: 0,
        total: 0,
        premium: 0,
      };
      demographicsMap.set(key, {
        conversions: existing.conversions + item.conversions,
        total: existing.total + item.totalLeads,
        premium: existing.premium + item.avgPremium * item.conversions,
      });
    });

    const demographics = Array.from(demographicsMap.entries())
      .map(([key, value]) => {
        const [ageGroup, gender, smokerStatus] = key.split("_");
        return {
          segment: `${ageGroup} ${gender} ${smokerStatus}`,
          conversionRate: (value.conversions / value.total) * 100,
          avgPremium:
            value.conversions > 0 ? value.premium / value.conversions : 0,
          score: calculateQualityScore(
            (value.conversions / value.total) * 100,
            value.conversions > 0 ? value.premium / value.conversions : 0,
            value.total
          ),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8); // Top 8 segments

    // Lead sources bar chart data
    const sourcesMap = new Map<
      string,
      { conversions: number; total: number; revenue: number }
    >();

    // Use the original data for aggregations to get accurate totals
    data.forEach((item) => {
      const existing = sourcesMap.get(item.leadSource) || {
        conversions: 0,
        total: 0,
        revenue: 0,
      };
      sourcesMap.set(item.leadSource, {
        conversions: existing.conversions + item.conversions,
        total: existing.total + item.totalLeads,
        revenue: existing.revenue + item.avgPremium * item.conversions,
      });
    });

    const sources = Array.from(sourcesMap.entries())
      .map(([source, value]) => ({
        source,
        conversionRate: (value.conversions / value.total) * 100,
        totalLeads: value.total,
        revenue: value.revenue,
        score: calculateQualityScore(
          (value.conversions / value.total) * 100,
          value.conversions > 0 ? value.revenue / value.conversions : 0,
          value.total
        ),
      }))
      .sort((a, b) => b.score - a.score);

    return { scatter, demographics, sources };
  }, [data]);

  // Calculate overall metrics
  const overallMetrics = useMemo(() => {
    if (!data || data.length === 0) {
      return { avgScore: 0, topSource: "", topSegment: "", totalLeads: 0 };
    }

    const scores = processedData.scatter.map((d) => d.qualityScore);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const topSource = processedData.sources[0]?.source || "";
    const topSegment = processedData.demographics[0]?.segment || "";
    const totalLeads = data.reduce((sum, d) => sum + d.totalLeads, 0);

    return { avgScore, topSource, topSegment, totalLeads };
  }, [data, processedData]);

  if (isLoading) {
    return (
      <Paper sx={{ p: 3, height: 600 }}>
        <Stack spacing={2}>
          <Typography variant="h6">Lead Quality Score Analysis</Typography>
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
            <AssessmentIcon color="primary" />
            Lead Quality Score Analysis
          </Typography>
          <ToggleButtonGroup
            value={view}
            exclusive
            onChange={(_, newView) => newView && setView(newView)}
            size="small"
          >
            <ToggleButton value="scatter">Quality Matrix</ToggleButton>
            <ToggleButton value="demographics">Demographics</ToggleButton>
            <ToggleButton value="sources">Lead Sources</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Overall Metrics */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
              <CardContent sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Typography variant="caption" color="text.secondary">
                    Average Quality Score
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{ color: getScoreColor(overallMetrics.avgScore) }}
                  >
                    {overallMetrics.avgScore.toFixed(0)}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={overallMetrics.avgScore}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      bgcolor: alpha(theme.palette.primary.main, 0.2),
                      "& .MuiLinearProgress-bar": {
                        bgcolor: getScoreColor(overallMetrics.avgScore),
                      },
                    }}
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
                    Top Performing Source
                  </Typography>
                  <Typography variant="h6" noWrap>
                    {overallMetrics.topSource}
                  </Typography>
                  <Chip
                    icon={<TrendingUpIcon />}
                    label="Highest Quality"
                    size="small"
                    color="success"
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
                    Best Demographic
                  </Typography>
                  <Typography variant="h6" noWrap>
                    {overallMetrics.topSegment}
                  </Typography>
                  <Chip
                    icon={<PersonIcon />}
                    label="Top Segment"
                    size="small"
                    color="info"
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
                    Total Leads Analyzed
                  </Typography>
                  <Typography variant="h4">
                    {overallMetrics.totalLeads.toLocaleString()}
                  </Typography>
                  <Chip
                    icon={<LocalFireDepartmentIcon />}
                    label="Lead Volume"
                    size="small"
                    color="warning"
                  />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Charts */}
        <Box sx={{ height: 500 }}>
          {view === "scatter" && (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{ top: 20, right: 20, bottom: 60, left: 60 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={alpha(theme.palette.divider, 0.5)}
                />
                <XAxis
                  type="number"
                  dataKey="conversionRate"
                  name="Conversion Rate"
                  unit="%"
                  label={{
                    value: "Conversion Rate (%)",
                    position: "insideBottom",
                    offset: -10,
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="avgPremium"
                  name="Average Premium"
                  unit="$"
                  label={{
                    value: "Average Premium ($)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <RechartsTooltip content={<CustomTooltip />} />
                <Scatter
                  name="Lead Sources"
                  data={processedData.scatter}
                  fill={theme.palette.primary.main}
                >
                  {processedData.scatter.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getScoreColor(entry.qualityScore)}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          )}

          {view === "demographics" && (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={processedData.demographics}>
                <PolarGrid strokeDasharray="3 3" />
                <PolarAngleAxis dataKey="segment" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fontSize: 10 }}
                />
                <Radar
                  name="Quality Score"
                  dataKey="score"
                  stroke={theme.palette.primary.main}
                  fill={theme.palette.primary.main}
                  fillOpacity={0.6}
                />
                <Radar
                  name="Conversion Rate"
                  dataKey="conversionRate"
                  stroke={theme.palette.success.main}
                  fill={theme.palette.success.main}
                  fillOpacity={0.4}
                />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          )}

          {view === "sources" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={processedData.sources.slice(0, 10)}
                margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={alpha(theme.palette.divider, 0.5)}
                />
                <XAxis
                  dataKey="source"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  interval={0}
                />
                <YAxis />
                <RechartsTooltip />
                <Bar
                  dataKey="score"
                  name="Quality Score"
                  fill={theme.palette.primary.main}
                >
                  {processedData.sources.slice(0, 10).map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getScoreColor(entry.score)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Box>

        {/* Legend */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Chip
            icon={<StarIcon />}
            label="Excellent (80+)"
            sx={{ bgcolor: "#4caf50", color: "white" }}
          />
          <Chip
            icon={<StarIcon />}
            label="Good (60-79)"
            sx={{ bgcolor: "#ff9800", color: "white" }}
          />
          <Chip
            icon={<StarIcon />}
            label="Fair (40-59)"
            sx={{ bgcolor: "#ff5722", color: "white" }}
          />
          <Chip
            icon={<StarIcon />}
            label="Poor (<40)"
            sx={{ bgcolor: "#f44336", color: "white" }}
          />
        </Box>
      </Stack>
    </Paper>
  );
};

// Memoize component to prevent unnecessary re-renders
export const LeadQualityScore = React.memo(
  LeadQualityScoreComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.isLoading === nextProps.isLoading &&
      JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data)
    );
  }
);
