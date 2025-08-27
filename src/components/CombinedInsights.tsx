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
  TextField,
  Button,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  TrendingUp,
  TrendingDown,
  Groups,
  AttachMoney,
  Insights,
  Assessment,
  CalendarMonth,
  DateRange,
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
  ReferenceArea,
} from "recharts";
import { format, parseISO, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
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

type DateRangePreset = "7d" | "30d" | "mtd" | "lastMonth" | "custom";

export const CombinedInsights: React.FC<CombinedInsightsProps> = ({
  revenueData,
  targetSettings,
}) => {
  const [loading, setLoading] = useState(true);
  const [isChangingDates, setIsChangingDates] = useState(false);
  const [hasQueriedData, setHasQueriedData] = useState(false);
  const [leadData, setLeadData] = useState<
    Map<string, Record<SiteKey, LeadEntryStored | null>>
  >(new Map());
  const [combinedMetrics, setCombinedMetrics] = useState<DailyMetrics[]>([]);
  const [preset, setPreset] = useState<DateRangePreset>("mtd");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Calculate date range based on preset
  const getDateRange = () => {
    const today = new Date();
    let start: Date;
    let end: Date = today;

    switch (preset) {
      case "7d":
        start = subDays(today, 6);
        break;
      case "30d":
        start = subDays(today, 29);
        break;
      case "mtd":
        start = startOfMonth(today);
        break;
      case "lastMonth":
        start = startOfMonth(subDays(today, 30));
        end = endOfMonth(start);
        break;
      case "custom":
        start = customStartDate ? new Date(customStartDate) : subDays(today, 29);
        end = customEndDate ? new Date(customEndDate) : today;
        break;
      default:
        start = startOfMonth(today);
    }

    return {
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
    };
  };

  const dateRange = getDateRange();

  // Initialize custom dates when switching to custom preset
  useEffect(() => {
    if (preset === "custom" && !customStartDate && !customEndDate) {
      const today = new Date();
      const thirtyDaysAgo = subDays(today, 29);
      setCustomStartDate(format(thirtyDaysAgo, "yyyy-MM-dd"));
      setCustomEndDate(format(today, "yyyy-MM-dd"));
    }
  }, [preset, customStartDate, customEndDate]);

  useEffect(() => {
    setIsChangingDates(true);
    setLoading(true);

    // Add a small delay to prevent flickering on fast date changes
    const timer = setTimeout(() => {
      setIsChangingDates(false);
    }, 300);

    // Subscribe to lead data for the date range
    const unsubscribe = leadService.subscribeToRange(
      dateRange.start,
      dateRange.end,
      (data) => {
        setLeadData(data);
        setLoading(false);
        setHasQueriedData(true);
        setIsChangingDates(false);
      }
    );

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
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

    // Filter revenue data to match the selected date range
    const filteredRevenue = revenueData.filter(
      (r) => r.date >= dateRange.start && r.date <= dateRange.end
    );

    // Process each date in the range
    leadData.forEach((leadEntry, date) => {
      const revenueEntry = filteredRevenue.find((r) => r.date === date);

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
  }, [leadData, revenueData, targetSettings, dateRange.start, dateRange.end]);

  // Show loading spinner only on initial load or when actively changing dates
  if ((loading && !hasQueriedData) || !targetSettings) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", p: 4, gap: 2 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Loading insights...
        </Typography>
      </Box>
    );
  }

  const hasData = combinedMetrics.length > 0;

  // Show different messages based on the state
  if (!hasData && !isChangingDates) {
    const dateRangeText = `${format(new Date(dateRange.start), "MMM d, yyyy")} to ${format(new Date(dateRange.end), "MMM d, yyyy")}`;
    
    return (
      <Box sx={{ width: "100%", minWidth: 0, maxWidth: "100%", overflow: "visible" }}>
        <Stack spacing={3} sx={{ width: "100%" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
            <Typography
              variant="h5"
              sx={{ fontWeight: 600, color: "text.primary" }}
            >
              Lead & Sales Correlation Analysis
            </Typography>
            
            {/* Date Range Selector - Keep it visible even with no data */}
            <Stack direction="row" spacing={2} alignItems="center">
              <ToggleButtonGroup
                value={preset}
                exclusive
                onChange={(_, newPreset) => {
                  if (newPreset !== null) {
                    setPreset(newPreset);
                  }
                }}
                size="small"
                disabled={isChangingDates}
                sx={{ bgcolor: "background.paper" }}
              >
                <ToggleButton value="7d" sx={{ px: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <DateRange fontSize="small" />
                    <Typography variant="body2">7D</Typography>
                  </Stack>
                </ToggleButton>
                <ToggleButton value="30d" sx={{ px: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <DateRange fontSize="small" />
                    <Typography variant="body2">30D</Typography>
                  </Stack>
                </ToggleButton>
                <ToggleButton value="mtd" sx={{ px: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CalendarMonth fontSize="small" />
                    <Typography variant="body2">MTD</Typography>
                  </Stack>
                </ToggleButton>
                <ToggleButton value="lastMonth" sx={{ px: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CalendarMonth fontSize="small" />
                    <Typography variant="body2">Last Month</Typography>
                  </Stack>
                </ToggleButton>
                <ToggleButton value="custom" sx={{ px: 2 }}>
                  <Typography variant="body2">Custom</Typography>
                </ToggleButton>
              </ToggleButtonGroup>
              
              {preset === "custom" && (
                <>
                  <TextField
                    type="date"
                    value={customStartDate}
                    onChange={(e) => {
                      setCustomStartDate(e.target.value);
                      if (customEndDate && e.target.value > customEndDate) {
                        setCustomEndDate(e.target.value);
                      }
                    }}
                    size="small"
                    disabled={isChangingDates}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: 140 }}
                  />
                  <Typography variant="body2">to</Typography>
                  <TextField
                    type="date"
                    value={customEndDate}
                    onChange={(e) => {
                      if (!customStartDate || e.target.value >= customStartDate) {
                        setCustomEndDate(e.target.value);
                      }
                    }}
                    size="small"
                    disabled={isChangingDates}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: 140 }}
                    inputProps={{
                      min: customStartDate || undefined,
                    }}
                  />
                </>
              )}
            </Stack>
          </Stack>

          <Alert severity="info" sx={{ mt: 3 }}>
            <Stack spacing={1}>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                No data available for {dateRangeText}
              </Typography>
              <Typography variant="body2">
                To see insights, please ensure:
              </Typography>
              <ul style={{ margin: '8px 0', paddingLeft: '24px' }}>
                <li><Typography variant="body2">Lead data has been entered in the Lead Attainment tab</Typography></li>
                <li><Typography variant="body2">Sales data has been entered in the Overview tab</Typography></li>
                <li><Typography variant="body2">Both types of data exist for the same dates</Typography></li>
              </ul>
              <Typography variant="body2" color="text.secondary">
                Try selecting a different date range or entering data for the selected period.
              </Typography>
            </Stack>
          </Alert>
        </Stack>
      </Box>
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
    <Box sx={{ width: "100%", minWidth: 0, maxWidth: "100%", overflow: "visible", position: "relative" }}>
      {/* Loading overlay when changing dates */}
      {isChangingDates && hasData && (
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: "rgba(255, 255, 255, 0.8)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
            borderRadius: 2,
          }}
        >
          <CircularProgress size={48} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Updating insights...
          </Typography>
        </Box>
      )}
      
    <Stack spacing={3} sx={{ width: "100%" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Typography
            variant="h5"
            sx={{ fontWeight: 600, color: "text.primary" }}
          >
            Lead & Sales Correlation Analysis
          </Typography>
          
          {/* Date Range Selector */}
          <Stack direction="row" spacing={2} alignItems="center">
            <ToggleButtonGroup
              value={preset}
              exclusive
              onChange={(_, newPreset) => {
                if (newPreset !== null) {
                  setPreset(newPreset);
                }
              }}
              size="small"
              disabled={isChangingDates}
              sx={{ bgcolor: "background.paper" }}
            >
              <ToggleButton value="7d" sx={{ px: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <DateRange fontSize="small" />
                  <Typography variant="body2">7D</Typography>
                </Stack>
              </ToggleButton>
              <ToggleButton value="30d" sx={{ px: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <DateRange fontSize="small" />
                  <Typography variant="body2">30D</Typography>
                </Stack>
              </ToggleButton>
              <ToggleButton value="mtd" sx={{ px: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <CalendarMonth fontSize="small" />
                  <Typography variant="body2">MTD</Typography>
                </Stack>
              </ToggleButton>
              <ToggleButton value="lastMonth" sx={{ px: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <CalendarMonth fontSize="small" />
                  <Typography variant="body2">Last Month</Typography>
                </Stack>
              </ToggleButton>
              <ToggleButton value="custom" sx={{ px: 2 }}>
                <Typography variant="body2">Custom</Typography>
              </ToggleButton>
            </ToggleButtonGroup>
            
            {preset === "custom" && (
              <>
                <TextField
                  type="date"
                  value={customStartDate}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value);
                    // Ensure end date is not before start date
                    if (customEndDate && e.target.value > customEndDate) {
                      setCustomEndDate(e.target.value);
                    }
                  }}
                  size="small"
                  disabled={isChangingDates}
                  InputLabelProps={{ shrink: true }}
                  sx={{ width: 140 }}
                />
                <Typography variant="body2">to</Typography>
                <TextField
                  type="date"
                  value={customEndDate}
                  onChange={(e) => {
                    // Ensure end date is not before start date
                    if (!customStartDate || e.target.value >= customStartDate) {
                      setCustomEndDate(e.target.value);
                    }
                  }}
                  size="small"
                  disabled={isChangingDates}
                  InputLabelProps={{ shrink: true }}
                  sx={{ width: 140 }}
                  inputProps={{
                    min: customStartDate || undefined,
                  }}
                />
              </>
            )}
          </Stack>
        </Stack>

        {/* Date range info */}
        <Typography variant="body2" color="text.secondary" sx={{ mt: -2 }}>
          Showing data from {format(new Date(dateRange.start), "MMM d, yyyy")} to {format(new Date(dateRange.end), "MMM d, yyyy")}
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

            <Box sx={{ width: "100%", height: 400, position: "relative", overflow: "hidden" }}>
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
            </Box>

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

            {/* Quadrant Guide */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Performance Quadrants:
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ 
                      width: 80, 
                      height: 60, 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr',
                      gridTemplateRows: '1fr 1fr',
                      border: '1px solid #e5e7eb',
                      borderRadius: 1,
                      overflow: 'hidden'
                    }}>
                      <Box sx={{ bgcolor: '#fef3c7', border: '1px solid #e5e7eb' }} />
                      <Box sx={{ bgcolor: '#d1fae5', border: '1px solid #e5e7eb' }} />
                      <Box sx={{ bgcolor: '#fee2e2', border: '1px solid #e5e7eb' }} />
                      <Box sx={{ bgcolor: '#fed7aa', border: '1px solid #e5e7eb' }} />
                    </Box>
                    <Stack spacing={0.5}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box sx={{ width: 12, height: 12, bgcolor: "#d1fae5", border: '1px solid #10b981' }} />
                        <Typography variant="caption">High Lead + High Sales (Goal)</Typography>
                      </Stack>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box sx={{ width: 12, height: 12, bgcolor: "#fed7aa", border: '1px solid #f59e0b' }} />
                        <Typography variant="caption">High Lead + Low Sales (Conversion Issue)</Typography>
                      </Stack>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box sx={{ width: 12, height: 12, bgcolor: "#fef3c7", border: '1px solid #f59e0b' }} />
                        <Typography variant="caption">Low Lead + High Sales (Need Leads)</Typography>
                      </Stack>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box sx={{ width: 12, height: 12, bgcolor: "#fee2e2", border: '1px solid #ef4444' }} />
                        <Typography variant="caption">Low Lead + Low Sales (Critical)</Typography>
                      </Stack>
                    </Stack>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Stack spacing={1}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: '#10b981', border: '2px solid #10b981' }} />
                      <Typography variant="caption">High performance (both ≥ 100%)</Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: '#f59e0b', border: '2px solid #f59e0b' }} />
                      <Typography variant="caption">Mixed performance (one ≥ 100%)</Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: '#ef4444', border: '2px solid #ef4444' }} />
                                              <Typography variant="caption">Low performance (both &lt; 100%)</Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: 'transparent', border: '3px solid #1e293b' }} />
                      <Typography variant="caption">Recent days (last 3)</Typography>
                    </Stack>
                  </Stack>
                </Grid>
              </Grid>
            </Box>

            <Box sx={{ width: "100%", height: 450, position: "relative", overflow: "hidden" }}>
              <ResponsiveContainer width="100%" height={450}>
                <ScatterChart margin={{ top: 40, right: 60, bottom: 60, left: 80 }}>
                <defs>
                  <linearGradient id="lowLowGradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#fee2e2" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#fee2e2" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="highHighGradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#d1fae5" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#d1fae5" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="mixedGradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#fed7aa" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#fed7aa" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                
                {/* Quadrant backgrounds */}
                <ReferenceArea x1={0} x2={100} y1={0} y2={100} fill="url(#lowLowGradient)" />
                <ReferenceArea x1={100} x2={200} y1={0} y2={100} fill="url(#mixedGradient)" />
                <ReferenceArea x1={0} x2={100} y1={100} y2={200} fill="url(#mixedGradient)" />
                <ReferenceArea x1={100} x2={200} y1={100} y2={200} fill="url(#highHighGradient)" />
                
                <XAxis
                  type="number"
                  dataKey="leadAttainmentCombined"
                  name="Lead Attainment"
                  domain={[0, (dataMax) => Math.ceil(dataMax / 20) * 20 + 20]}
                  ticks={[0, 20, 40, 60, 80, 100, 120, 140, 160]}
                  tickFormatter={(value) => `${Math.round(value)}%`}
                  label={{
                    value: "Lead Attainment %",
                    position: "insideBottom",
                    offset: -10,
                    style: { textAnchor: 'middle' }
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="salesAttainmentCombined"
                  name="Sales Attainment"
                  domain={[0, (dataMax) => Math.ceil(dataMax / 20) * 20 + 20]}
                  ticks={[0, 20, 40, 60, 80, 100, 120, 140, 160]}
                  tickFormatter={(value) => `${Math.round(value)}%`}
                  label={{
                    value: "Sales Attainment %",
                    angle: -90,
                    position: "insideLeft",
                    style: { textAnchor: 'middle' }
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
                <ReferenceLine 
                  x={100} 
                  stroke="#94a3b8" 
                  strokeDasharray="5 5" 
                  strokeWidth={2}
                  label={{ 
                    value: "Target", 
                    position: "top",
                    offset: 10,
                    style: { fill: '#64748b', fontSize: 12 }
                  }} 
                />
                <ReferenceLine 
                  y={100} 
                  stroke="#94a3b8" 
                  strokeDasharray="5 5" 
                  strokeWidth={2}
                  label={{ 
                    value: "Target", 
                    position: "right",
                    offset: 10,
                    style: { fill: '#64748b', fontSize: 12 }
                  }} 
                />
                
                <Scatter
                  name="Daily Performance"
                  data={combinedMetrics}
                  fill="#8b5cf6"
                  shape={(props) => {
                    const { cx, cy, payload, index } = props;
                    const isRecent = index >= combinedMetrics.length - 3;
                    const fill = 
                      payload.leadAttainmentCombined >= 100 && payload.salesAttainmentCombined >= 100
                        ? "#10b981"
                        : payload.leadAttainmentCombined >= 100 || payload.salesAttainmentCombined >= 100
                        ? "#f59e0b"
                        : "#ef4444";
                    
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isRecent ? 8 : 6}
                        fill={fill}
                        stroke={isRecent ? "#1e293b" : fill}
                        strokeWidth={isRecent ? 3 : 1.5}
                        style={{ cursor: 'pointer' }}
                      />
                    );
                  }}
                />
              </ScatterChart>
              </ResponsiveContainer>
            </Box>

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
              <Box sx={{ width: "100%", height: 300, position: "relative", overflow: "hidden" }}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={combinedMetrics} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => format(parseISO(value), "MMM d")}
                  />
                  <YAxis 
                    domain={[0, (dataMax) => Math.max(150, Math.ceil(dataMax / 20) * 20)]}
                    ticks={[0, 25, 50, 75, 100, 125, 150]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    formatter={(value: number) => `${value.toFixed(1)}%`}
                    labelFormatter={(label) => format(parseISO(label), "MMM d, yyyy")}
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e5e7eb' }}
                  />
                  <Legend />
                  <ReferenceLine y={100} stroke="#94a3b8" strokeDasharray="5 5" label="Target" />
                  <Bar
                    dataKey="leadAttainmentATX"
                    fill="#3b82f6"
                    name="Lead %"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="salesAttainmentATX"
                    fill="#10b981"
                    name="Sales %"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
                </ResponsiveContainer>
              </Box>
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
              <Box sx={{ width: "100%", height: 300, position: "relative", overflow: "hidden" }}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={combinedMetrics} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => format(parseISO(value), "MMM d")}
                  />
                  <YAxis 
                    domain={[0, (dataMax) => Math.max(150, Math.ceil(dataMax / 20) * 20)]}
                    ticks={[0, 25, 50, 75, 100, 125, 150]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    formatter={(value: number) => `${value.toFixed(1)}%`}
                    labelFormatter={(label) => format(parseISO(label), "MMM d, yyyy")}
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e5e7eb' }}
                  />
                  <Legend />
                  <ReferenceLine y={100} stroke="#94a3b8" strokeDasharray="5 5" label="Target" />
                  <Bar
                    dataKey="leadAttainmentCLT"
                    fill="#3b82f6"
                    name="Lead %"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="salesAttainmentCLT"
                    fill="#10b981"
                    name="Sales %"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Stack>
    </Box>
  );
};
