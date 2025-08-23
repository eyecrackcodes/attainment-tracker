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

        // Calculate sales attainment
        // Note: calculateLocationMetrics expects (data, targetSettings, location, timeFrame)
        const salesMetrics = calculateLocationMetrics(
          [revenueEntry],
          targetSettings,
          "Combined",
          "MTD"
        );

        // Check if salesMetrics is valid
        if (
          !salesMetrics ||
          !salesMetrics.austin ||
          !salesMetrics.charlotte ||
          !salesMetrics.total
        ) {
          console.warn(`Invalid sales metrics for date ${date}`, salesMetrics);
          return; // Skip this entry
        }

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
          salesAttainmentATX:
            salesMetrics.austin.target > 0
              ? (revenueEntry.austin / salesMetrics.austin.target) * 100
              : 0,
          salesAttainmentCLT:
            salesMetrics.charlotte.target > 0
              ? (revenueEntry.charlotte / salesMetrics.charlotte.target) * 100
              : 0,
          salesAttainmentCombined: salesMetrics.total.attainment || 0,
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
          <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
            Lead vs Sales Attainment Trend
          </Typography>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={combinedMetrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => format(parseISO(value), "MMM d")}
              />
              <YAxis
                label={{
                  value: "Attainment %",
                  angle: -90,
                  position: "insideLeft",
                }}
              />
              <Tooltip
                formatter={(value: number) => `${value.toFixed(1)}%`}
                labelFormatter={(label) =>
                  format(parseISO(label), "MMM d, yyyy")
                }
              />
              <Legend />
              <ReferenceLine y={100} stroke="#666" strokeDasharray="5 5" />
              <Line
                type="monotone"
                dataKey="leadAttainmentCombined"
                stroke="#3b82f6"
                name="Lead Attainment"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="salesAttainmentCombined"
                stroke="#10b981"
                name="Sales Attainment"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
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
          <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
            Lead vs Sales Correlation
          </Typography>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="leadAttainmentCombined"
                name="Lead Attainment"
                unit="%"
                tickFormatter={(value) => value.toFixed(1)}
                label={{
                  value: "Lead Attainment %",
                  position: "insideBottom",
                  offset: -5,
                }}
              />
              <YAxis
                dataKey="salesAttainmentCombined"
                name="Sales Attainment"
                unit="%"
                tickFormatter={(value) => value.toFixed(1)}
                label={{
                  value: "Sales Attainment %",
                  angle: -90,
                  position: "insideLeft",
                }}
              />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                formatter={(value: number) => `${value.toFixed(1)}%`}
                labelFormatter={(index) => {
                  if (typeof index === "number" && combinedMetrics[index]) {
                    return format(
                      parseISO(combinedMetrics[index].date),
                      "MMM d, yyyy"
                    );
                  }
                  return "";
                }}
              />
              <ReferenceLine x={100} stroke="#666" strokeDasharray="5 5" />
              <ReferenceLine y={100} stroke="#666" strokeDasharray="5 5" />
              <Scatter
                name="Daily Performance"
                data={combinedMetrics}
                fill="#8b5cf6"
              >
                {combinedMetrics.map((entry, index) => (
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
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
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
