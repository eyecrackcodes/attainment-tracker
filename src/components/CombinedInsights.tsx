import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  Divider,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  TrendingUp,
  TrendingDown,
  Groups,
  AttachMoney,
  Insights,
  Assessment,
} from "@mui/icons-material";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell,
  ReferenceLine,
} from "recharts";
import { format, parseISO, subDays, startOfMonth } from "date-fns";
import { leadService, LeadEntryStored, SiteKey } from "../services/leadService";
import { RevenueData } from "../types/revenue";
import {
  filterDataByTimeFrame,
  calculateLocationMetrics,
} from "../utils/calculations";
import { formatCurrency } from "../utils/formatters";

interface CombinedInsightsProps {
  revenueData: RevenueData[];
  targetSettings: any;
}

interface DailyMetrics {
  date: string;
  leadAttainmentATX: number;
  leadAttainmentCLT: number;
  leadAttainmentCombined: number;
  salesAttainmentATX: number;
  salesAttainmentCLT: number;
  salesAttainmentCombined: number;
  totalLeads: number;
  totalRevenue: number;
}

export const CombinedInsights: React.FC<CombinedInsightsProps> = ({
  revenueData,
  targetSettings,
}) => {
  const [loading, setLoading] = useState(true);
  const [leadData, setLeadData] = useState<
    Map<string, Record<SiteKey, LeadEntryStored | null>>
  >(new Map());
  const [combinedMetrics, setCombinedMetrics] = useState<DailyMetrics[]>([]);

  // Get date range for the last 30 days
  const endDate = new Date();
  const startDate = startOfMonth(endDate);
  const dateRange = {
    start: format(startDate, "yyyy-MM-dd"),
    end: format(endDate, "yyyy-MM-dd"),
  };

  useEffect(() => {
    setLoading(true);

    // Subscribe to lead data for the date range
    const unsubscribe = leadService.subscribeToRange(
      dateRange.start,
      dateRange.end,
      (data) => {
        setLeadData(data);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [dateRange.start, dateRange.end]);

  useEffect(() => {
    // Combine lead and sales data
    const metrics: DailyMetrics[] = [];

    // Check if we have valid target settings
    if (!targetSettings) {
      console.warn("No target settings available for CombinedInsights");
      setCombinedMetrics([]);
      return;
    }

    // Get MTD revenue data
    const mtdRevenue = filterDataByTimeFrame(revenueData, "MTD");

    // Process each date in the range
    leadData.forEach((leadEntry, date) => {
      const revenueEntry = mtdRevenue.find((r) => r.date === date);

      if (revenueEntry) {
        const atxLead = leadEntry.ATX;
        const cltLead = leadEntry.CLT;

        // Calculate daily sales targets
        const dailyAustinTarget = targetSettings.dailyTargets.austin;
        const dailyCharlotteTarget = targetSettings.dailyTargets.charlotte;
        const dailyCombinedTarget = dailyAustinTarget + dailyCharlotteTarget;

        // Calculate daily sales attainment (not MTD)
        const salesAttainmentATX = dailyAustinTarget > 0 
          ? (revenueEntry.austin / dailyAustinTarget) * 100 
          : 0;
        const salesAttainmentCLT = dailyCharlotteTarget > 0 
          ? (revenueEntry.charlotte / dailyCharlotteTarget) * 100 
          : 0;
        const salesAttainmentCombined = dailyCombinedTarget > 0
          ? ((revenueEntry.austin + revenueEntry.charlotte) / dailyCombinedTarget) * 100
          : 0;

        metrics.push({
          date,
          leadAttainmentATX: atxLead ? atxLead.derived.attainmentPct * 100 : 0,
          leadAttainmentCLT: cltLead ? cltLead.derived.attainmentPct * 100 : 0,
          leadAttainmentCombined:
            atxLead && cltLead
              ? ((atxLead.totalBillableLeads + cltLead.totalBillableLeads) /
                  (atxLead.derived.targetLeads + cltLead.derived.targetLeads)) *
                100
              : 0,
          salesAttainmentATX,
          salesAttainmentCLT,
          salesAttainmentCombined,
          totalLeads:
            (atxLead?.totalBillableLeads || 0) +
            (cltLead?.totalBillableLeads || 0),
          totalRevenue: revenueEntry.austin + revenueEntry.charlotte,
        });
      }
    });

    // Sort by date
    metrics.sort((a, b) => a.date.localeCompare(b.date));
    setCombinedMetrics(metrics);
  }, [leadData, revenueData, targetSettings]);

  if (loading || !targetSettings) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const hasData = combinedMetrics.length > 0;

  if (!hasData) {
    return (
      <Alert severity="info">
        No combined data available. Please ensure both lead and sales data are
        entered for the same dates.
      </Alert>
    );
  }

  // Calculate correlation
  const calculateCorrelation = () => {
    if (combinedMetrics.length < 2) return 0;

    const n = combinedMetrics.length;
    const sumX = combinedMetrics.reduce(
      (sum, m) => sum + m.leadAttainmentCombined,
      0
    );
    const sumY = combinedMetrics.reduce(
      (sum, m) => sum + m.salesAttainmentCombined,
      0
    );
    const sumXY = combinedMetrics.reduce(
      (sum, m) => sum + m.leadAttainmentCombined * m.salesAttainmentCombined,
      0
    );
    const sumX2 = combinedMetrics.reduce(
      (sum, m) => sum + m.leadAttainmentCombined ** 2,
      0
    );
    const sumY2 = combinedMetrics.reduce(
      (sum, m) => sum + m.salesAttainmentCombined ** 2,
      0
    );

    const correlation =
      (n * sumXY - sumX * sumY) /
      Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));

    return isNaN(correlation) ? 0 : correlation;
  };

  const correlation = calculateCorrelation();
  const correlationStrength =
    Math.abs(correlation) > 0.7
      ? "Strong"
      : Math.abs(correlation) > 0.4
      ? "Moderate"
      : "Weak";

  // Calculate averages
  const avgLeadAttainment =
    combinedMetrics.reduce((sum, m) => sum + m.leadAttainmentCombined, 0) /
    combinedMetrics.length;
  const avgSalesAttainment =
    combinedMetrics.reduce((sum, m) => sum + m.salesAttainmentCombined, 0) /
    combinedMetrics.length;

    return (
    <Box sx={{ width: "100%", minWidth: 0, maxWidth: "100%", overflow: "visible" }}>
    <Stack spacing={3} sx={{ width: "100%" }}>
        <Typography
          variant="h5"
          sx={{ fontWeight: 600, color: "text.primary", mb: 1 }}
        >
          Lead & Sales Correlation Analysis
        </Typography>

              {/* Summary Cards */}
      <Grid container spacing={3} sx={{ width: "100%" }}>
          <Grid item xs={12} md={3}>
            <Card
              elevation={0}
              sx={{
                height: "100%",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
              }}
            >
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Groups color="primary" />
                    <Typography variant="body2" color="text.secondary">
                      Avg Lead Attainment
                    </Typography>
                  </Stack>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {avgLeadAttainment.toFixed(1)}%
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card
              elevation={0}
              sx={{
                height: "100%",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
              }}
            >
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <AttachMoney color="success" />
                    <Typography variant="body2" color="text.secondary">
                      Avg Sales Attainment
                    </Typography>
                  </Stack>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {avgSalesAttainment.toFixed(1)}%
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card
              elevation={0}
              sx={{
                height: "100%",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
              }}
            >
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Insights color="info" />
                    <Typography variant="body2" color="text.secondary">
                      Correlation
                    </Typography>
                  </Stack>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {(correlation * 100).toFixed(0)}%
                  </Typography>
                  <Chip
                    label={correlationStrength}
                    size="small"
                    color={
                      correlationStrength === "Strong"
                        ? "success"
                        : correlationStrength === "Moderate"
                        ? "warning"
                        : "default"
                    }
                  />
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card
              elevation={0}
              sx={{
                height: "100%",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
              }}
            >
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Assessment color="secondary" />
                    <Typography variant="body2" color="text.secondary">
                      Days with Data
                    </Typography>
                  </Stack>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {combinedMetrics.length}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Combined Trend Chart */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            width: "100%",
          }}
        >
          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Lead vs Sales Attainment Trend
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Daily performance showing how lead generation and sales conversion align
              </Typography>
            </Box>
            
            {/* Key Metrics Summary */}
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <Box sx={{ p: 1.5, bgcolor: "primary.lighter", borderRadius: 1 }}>
                  <Typography variant="caption" color="primary.dark">
                    Avg Lead Attainment
                  </Typography>
                  <Typography variant="h6" color="primary.main">
                    {avgLeadAttainment.toFixed(1)}%
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box sx={{ p: 1.5, bgcolor: "success.lighter", borderRadius: 1 }}>
                  <Typography variant="caption" color="success.dark">
                    Avg Sales Attainment
                  </Typography>
                  <Typography variant="h6" color="success.main">
                    {avgSalesAttainment.toFixed(1)}%
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box sx={{ p: 1.5, bgcolor: correlation > 0.5 ? "info.lighter" : "warning.lighter", borderRadius: 1 }}>
                  <Typography variant="caption" color={correlation > 0.5 ? "info.dark" : "warning.dark"}>
                    Lead-Sales Gap
                  </Typography>
                  <Typography variant="h6" color={correlation > 0.5 ? "info.main" : "warning.main"}>
                    {Math.abs(avgLeadAttainment - avgSalesAttainment).toFixed(1)}%
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box sx={{ p: 1.5, bgcolor: "grey.100", borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Trend Direction
                  </Typography>
                  <Typography variant="h6" color="text.primary">
                    {combinedMetrics.length > 1 && 
                     combinedMetrics[combinedMetrics.length - 1].salesAttainmentCombined > 
                     combinedMetrics[0].salesAttainmentCombined ? "↑ Improving" : "↓ Declining"}
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={combinedMetrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => format(parseISO(value), "MMM d")}
                />
                <YAxis
                  yAxisId="percentage"
                  label={{
                    value: "Attainment %",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <YAxis
                  yAxisId="count"
                  orientation="right"
                  label={{
                    value: "Lead Count",
                    angle: 90,
                    position: "insideRight",
                  }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !label) return null;
                    const data = payload[0]?.payload;
                    if (!data) return null;
                    
                    return (
                      <Box sx={{ bgcolor: "background.paper", p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                          {format(parseISO(label), "MMM d, yyyy")}
                        </Typography>
                        <Stack spacing={0.5}>
                          <Typography variant="caption">
                            Lead Attainment: <strong>{data.leadAttainmentCombined.toFixed(1)}%</strong>
                          </Typography>
                          <Typography variant="caption">
                            Sales Attainment: <strong>{data.salesAttainmentCombined.toFixed(1)}%</strong>
                          </Typography>
                          <Typography variant="caption">
                            Total Leads: <strong>{data.totalLeads}</strong>
                          </Typography>
                          <Typography variant="caption">
                            Revenue: <strong>{formatCurrency(data.totalRevenue)}</strong>
                          </Typography>
                        </Stack>
                      </Box>
                    );
                  }}
                />
                <Legend />
                <ReferenceLine yAxisId="percentage" y={100} stroke="#666" strokeDasharray="5 5" label="Target" />
                <Bar
                  yAxisId="count"
                  dataKey="totalLeads"
                  fill="#e0e7ff"
                  name="Lead Count"
                  opacity={0.3}
                />
                <Line
                  yAxisId="percentage"
                  type="monotone"
                  dataKey="leadAttainmentCombined"
                  stroke="#3b82f6"
                  name="Lead Attainment"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
                <Line
                  yAxisId="percentage"
                  type="monotone"
                  dataKey="salesAttainmentCombined"
                  stroke="#10b981"
                  name="Sales Attainment"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>

            {/* Insights */}
            <Box sx={{ p: 2, bgcolor: "grey.50", borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Key Insights:
              </Typography>
              <Stack spacing={1}>
                {avgLeadAttainment > avgSalesAttainment + 20 && (
                  <Typography variant="caption" color="warning.dark">
                    • Lead generation significantly outpacing sales - focus on conversion training
                  </Typography>
                )}
                {avgSalesAttainment > avgLeadAttainment + 10 && (
                  <Typography variant="caption" color="success.dark">
                    • Sales efficiency is high - consider increasing lead generation
                  </Typography>
                )}
                {Math.abs(avgLeadAttainment - avgSalesAttainment) < 10 && (
                  <Typography variant="caption" color="info.dark">
                    • Lead generation and sales are well-balanced
                  </Typography>
                )}
                {correlation < 0.4 && (
                  <Typography variant="caption" color="error.dark">
                    • Low correlation between leads and sales - investigate quality issues
                  </Typography>
                )}
              </Stack>
            </Box>
          </Stack>
        </Paper>

        {/* Correlation Scatter Plot */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            width: "100%",
          }}
        >
          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Lead vs Sales Performance Analysis
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Each point represents a day's performance. Position indicates balance between lead generation and sales conversion.
              </Typography>
            </Box>

            {/* Quadrant Legend */}
            <Grid container spacing={1}>
              <Grid item xs={6} md={3}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ width: 16, height: 16, bgcolor: "#10b981", borderRadius: "50%" }} />
                  <Typography variant="caption">High Lead & High Sales</Typography>
                </Stack>
              </Grid>
              <Grid item xs={6} md={3}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ width: 16, height: 16, bgcolor: "#f59e0b", borderRadius: "50%" }} />
                  <Typography variant="caption">Mixed Performance</Typography>
                </Stack>
              </Grid>
              <Grid item xs={6} md={3}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ width: 16, height: 16, bgcolor: "#ef4444", borderRadius: "50%" }} />
                  <Typography variant="caption">Low Performance</Typography>
                </Stack>
              </Grid>
              <Grid item xs={6} md={3}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ width: 16, height: 16, bgcolor: "#e0e7ff", borderRadius: "50%" }} />
                  <Typography variant="caption">Recent Days</Typography>
                </Stack>
              </Grid>
            </Grid>

            <ResponsiveContainer width="100%" height={450}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 60, left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="leadAttainmentCombined"
                  name="Lead Attainment"
                  unit="%"
                  domain={[0, 'dataMax + 20']}
                  tickFormatter={(value) => `${value}%`}
                  label={{
                    value: "Lead Attainment %",
                    position: "insideBottom",
                    offset: -10,
                  }}
                />
                <YAxis
                  dataKey="salesAttainmentCombined"
                  name="Sales Attainment"
                  unit="%"
                  domain={[0, 'dataMax + 20']}
                  tickFormatter={(value) => `${value}%`}
                  label={{
                    value: "Sales Attainment %",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload[0]) return null;
                    const data = payload[0].payload as any;
                    
                    return (
                      <Box sx={{ bgcolor: "background.paper", p: 2, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                          {format(parseISO(data.date), "MMM d, yyyy")}
                        </Typography>
                        <Stack spacing={0.5}>
                          <Typography variant="caption">
                            Lead Attainment: <strong>{data.leadAttainmentCombined.toFixed(1)}%</strong>
                          </Typography>
                          <Typography variant="caption">
                            Sales Attainment: <strong>{data.salesAttainmentCombined.toFixed(1)}%</strong>
                          </Typography>
                          <Typography variant="caption">
                            Total Leads: <strong>{data.totalLeads}</strong>
                          </Typography>
                          <Typography variant="caption">
                            Total Revenue: <strong>{formatCurrency(data.totalRevenue)}</strong>
                          </Typography>
                          <Divider sx={{ my: 1 }} />
                          <Typography variant="caption" color={
                            data.leadAttainmentCombined >= 100 && data.salesAttainmentCombined >= 100
                              ? "success.main"
                              : data.leadAttainmentCombined >= 100 || data.salesAttainmentCombined >= 100
                              ? "warning.main"
                              : "error.main"
                          }>
                            {data.leadAttainmentCombined >= 100 && data.salesAttainmentCombined >= 100
                              ? "✓ Excellent performance"
                              : data.leadAttainmentCombined < 100 && data.salesAttainmentCombined >= 100
                              ? "Need more leads"
                              : data.leadAttainmentCombined >= 100 && data.salesAttainmentCombined < 100
                              ? "Improve conversion"
                              : "Performance below target"}
                          </Typography>
                        </Stack>
                      </Box>
                    );
                  }}
                />
                <ReferenceLine x={100} stroke="#666" strokeDasharray="5 5" label={{ value: "Lead Target", position: "top" }} />
                <ReferenceLine y={100} stroke="#666" strokeDasharray="5 5" label={{ value: "Sales Target", position: "right" }} />
                
                {/* Quadrant labels */}
                <ReferenceLine
                  x={50}
                  y={150}
                  label={{
                    value: "Low Leads\nHigh Sales",
                    position: "center",
                    fill: "#666",
                    fontSize: 12,
                  }}
                  stroke="none"
                />
                <ReferenceLine
                  x={150}
                  y={150}
                  label={{
                    value: "High Leads\nHigh Sales",
                    position: "center",
                    fill: "#10b981",
                    fontSize: 12,
                  }}
                  stroke="none"
                />
                <ReferenceLine
                  x={50}
                  y={50}
                  label={{
                    value: "Low Leads\nLow Sales",
                    position: "center",
                    fill: "#ef4444",
                    fontSize: 12,
                  }}
                  stroke="none"
                />
                <ReferenceLine
                  x={150}
                  y={50}
                  label={{
                    value: "High Leads\nLow Sales",
                    position: "center",
                    fill: "#f59e0b",
                    fontSize: 12,
                  }}
                  stroke="none"
                />
                
                <Scatter
                  name="Daily Performance"
                  data={combinedMetrics}
                  fill="#8b5cf6"
                >
                  {combinedMetrics.map((entry, index) => {
                    const isRecent = index >= combinedMetrics.length - 3;
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.leadAttainmentCombined >= 100 &&
                          entry.salesAttainmentCombined >= 100
                            ? "#10b981"
                            : entry.leadAttainmentCombined >= 100 ||
                              entry.salesAttainmentCombined >= 100
                            ? "#f59e0b"
                            : "#ef4444"
                        }
                        stroke={isRecent ? "#1e293b" : "none"}
                        strokeWidth={isRecent ? 2 : 0}
                      />
                    );
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>

            {/* Performance Summary */}
            <Box sx={{ p: 2, bgcolor: "grey.50", borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Performance Distribution:
              </Typography>
              <Grid container spacing={2}>
                {(() => {
                  const highBoth = combinedMetrics.filter(m => m.leadAttainmentCombined >= 100 && m.salesAttainmentCombined >= 100).length;
                  const highLeadLowSales = combinedMetrics.filter(m => m.leadAttainmentCombined >= 100 && m.salesAttainmentCombined < 100).length;
                  const lowLeadHighSales = combinedMetrics.filter(m => m.leadAttainmentCombined < 100 && m.salesAttainmentCombined >= 100).length;
                  const lowBoth = combinedMetrics.filter(m => m.leadAttainmentCombined < 100 && m.salesAttainmentCombined < 100).length;
                  const total = combinedMetrics.length;
                  
                  return (
                    <>
                      <Grid item xs={6} md={3}>
                        <Typography variant="caption">
                          High Both: <strong>{highBoth}</strong> ({total > 0 ? ((highBoth / total) * 100).toFixed(0) : 0}%)
                        </Typography>
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <Typography variant="caption">
                          High Lead/Low Sales: <strong>{highLeadLowSales}</strong> ({total > 0 ? ((highLeadLowSales / total) * 100).toFixed(0) : 0}%)
                        </Typography>
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <Typography variant="caption">
                          Low Lead/High Sales: <strong>{lowLeadHighSales}</strong> ({total > 0 ? ((lowLeadHighSales / total) * 100).toFixed(0) : 0}%)
                        </Typography>
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <Typography variant="caption">
                          Low Both: <strong>{lowBoth}</strong> ({total > 0 ? ((lowBoth / total) * 100).toFixed(0) : 0}%)
                        </Typography>
                      </Grid>
                    </>
                  );
                })()}
              </Grid>
            </Box>
          </Stack>
        </Paper>

        {/* Site Comparison */}
        <Grid container spacing={3}>
          <Grid item xs={12} lg={6}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                height: "100%",
              }}
            >
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                Austin Performance
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={combinedMetrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => format(parseISO(value), "MMM d")}
                  />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => `${value.toFixed(1)}%`}
                    labelFormatter={(label) => format(parseISO(label), "MMM d")}
                  />
                  <Legend />
                  <Bar
                    dataKey="leadAttainmentATX"
                    fill="#3b82f6"
                    name="Lead %"
                  />
                  <Bar
                    dataKey="salesAttainmentATX"
                    fill="#10b981"
                    name="Sales %"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid item xs={12} lg={6}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                height: "100%",
              }}
            >
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                Charlotte Performance
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={combinedMetrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => format(parseISO(value), "MMM d")}
                  />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => `${value.toFixed(1)}%`}
                    labelFormatter={(label) => format(parseISO(label), "MMM d")}
                  />
                  <Legend />
                  <Bar
                    dataKey="leadAttainmentCLT"
                    fill="#3b82f6"
                    name="Lead %"
                  />
                  <Bar
                    dataKey="salesAttainmentCLT"
                    fill="#10b981"
                    name="Sales %"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>
      </Stack>
    </Box>
  );
};
