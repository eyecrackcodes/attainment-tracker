import React, { useState, useMemo } from "react";
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  Stack,
  Card,
  CardContent,
  useTheme,
  alpha,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  TrendingUp,
  TrendingDown,
  LocationOn,
  DateRange,
  AttachMoney,
  Phone,
  PhoneMissed,
  Assessment,
  FullscreenOutlined,
  FullscreenExitOutlined,
} from "@mui/icons-material";
import ApexCharts from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import { format, parseISO } from "date-fns";
import { RevenueData, TargetSettings } from "../types/revenue";
import { DailyLeadMetrics } from "../types/snowflake";
import {
  filterDataByTimeFrame,
  calculateLocationMetrics,
} from "../utils/calculations";
import { formatCurrency } from "../utils/formatters";

interface CleanDashboardProps {
  data: RevenueData[];
  filters: any;
  targetSettings: TargetSettings;
  snowflakeData: {
    dailyMetrics: DailyLeadMetrics[];
    [key: string]: any;
  };
}

// Clean metric card component
const MetricCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: number;
  color?: string;
}> = ({ title, value, subtitle, icon, trend, color }) => {
  const theme = useTheme();

  return (
    <Card
      sx={{
        height: "100%",
        background: `linear-gradient(135deg, ${alpha(
          color || theme.palette.primary.main,
          0.1
        )} 0%, ${theme.palette.background.paper} 100%)`,
        boxShadow: theme.shadows[2],
        transition: "transform 0.2s, box-shadow 0.2s",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: theme.shadows[8],
        },
      }}
    >
      <CardContent>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" fontWeight="bold">
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 48,
              height: 48,
              borderRadius: 2,
              backgroundColor: alpha(color || theme.palette.primary.main, 0.1),
            }}
          >
            {icon}
          </Box>
        </Box>
        {trend !== undefined && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            {trend > 0 ? (
              <TrendingUp
                sx={{ fontSize: 16, color: theme.palette.success.main }}
              />
            ) : (
              <TrendingDown
                sx={{ fontSize: 16, color: theme.palette.error.main }}
              />
            )}
            <Typography
              variant="caption"
              sx={{
                color:
                  trend > 0
                    ? theme.palette.success.main
                    : theme.palette.error.main,
              }}
            >
              {Math.abs(trend).toFixed(1)}% vs last period
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export const CleanDashboard: React.FC<CleanDashboardProps> = ({
  data,
  filters,
  targetSettings,
  snowflakeData,
}) => {
  const theme = useTheme();
  const [selectedView, setSelectedView] = useState<
    "revenue" | "leads" | "performance"
  >("revenue");
  const [expandedChart, setExpandedChart] = useState<string | null>(null);

  // Process data
  const processedData = useMemo(() => {
    const filteredData = filterDataByTimeFrame(
      data,
      filters.timeFrame,
      undefined,
      targetSettings,
      filters.startDate,
      filters.endDate,
      filters.location
    );

    const metrics = calculateLocationMetrics(
      filteredData,
      targetSettings,
      filters.location,
      filters.timeFrame
    );

    // Get daily data for charts - ensure we have valid data
    const dailyData = snowflakeData?.dailyMetrics || [];
    const sortedDaily = [...dailyData]
      .filter(d => d && d.date) // Filter out invalid entries
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      filtered: filteredData,
      metrics,
      daily: sortedDaily,
    };
  }, [data, filters, targetSettings, snowflakeData]);

  // Chart configurations
  const revenueChartOptions: ApexOptions = {
    chart: {
      type: "area",
      toolbar: {
        show: false,
      },
      zoom: {
        enabled: false,
      },
    },
    colors: [theme.palette.primary.main, theme.palette.secondary.main],
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: "smooth",
      width: 2,
    },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.7,
        opacityTo: 0.2,
        stops: [0, 90, 100],
      },
    },
    xaxis: {
      categories: processedData.daily.length > 0 
        ? processedData.daily.map((d) => {
            try {
              return format(parseISO(d.date), "MMM d");
            } catch {
              return d.date; // Fallback if date parsing fails
            }
          })
        : [],
      labels: {
        rotate: -45,
        style: {
          colors: theme.palette.text.secondary,
        },
      },
    },
    yaxis: {
      labels: {
        formatter: (value) => formatCurrency(value),
        style: {
          colors: theme.palette.text.secondary,
        },
      },
    },
    tooltip: {
      theme: theme.palette.mode,
      y: {
        formatter: (value) => formatCurrency(value),
      },
    },
    legend: {
      position: "top",
      horizontalAlign: "right",
    },
  };

  const leadConversionOptions: ApexOptions = {
    chart: {
      type: "donut",
      toolbar: {
        show: false,
      },
    },
    colors: [
      theme.palette.success.main,
      theme.palette.warning.main,
      theme.palette.error.main,
    ],
    labels: ["Converted", "Billable", "Missed"],
    dataLabels: {
      enabled: true,
      formatter: function (val, opts) {
        return (
          opts.w.config.series[opts.seriesIndex] + " (" + val.toFixed(1) + "%)"
        );
      },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "70%",
          labels: {
            show: true,
            total: {
              show: true,
              showAlways: true,
              label: "Total Calls",
              formatter: function (w) {
                return w.globals.seriesTotals
                  .reduce((a: number, b: number) => a + b, 0)
                  .toLocaleString();
              },
            },
          },
        },
      },
    },
    legend: {
      position: "bottom",
    },
    tooltip: {
      theme: theme.palette.mode,
    },
  };

  const performanceBarOptions: ApexOptions = {
    chart: {
      type: "bar",
      toolbar: {
        show: false,
      },
    },
    colors: [theme.palette.primary.main, theme.palette.secondary.main],
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "55%",
        borderRadius: 4,
      },
    },
    dataLabels: {
      enabled: false,
    },
    xaxis: {
      categories: ["Target", "Actual", "Pace"],
      labels: {
        style: {
          colors: theme.palette.text.secondary,
        },
      },
    },
    yaxis: {
      labels: {
        formatter: (value) => formatCurrency(value),
        style: {
          colors: theme.palette.text.secondary,
        },
      },
    },
    fill: {
      opacity: 1,
    },
    tooltip: {
      theme: theme.palette.mode,
      y: {
        formatter: (value) => formatCurrency(value),
      },
    },
    legend: {
      position: "top",
      horizontalAlign: "right",
    },
  };

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    if (!processedData.daily || processedData.daily.length === 0) {
      return {
        totalCalls: 0,
        totalBillable: 0,
        totalSales: 0,
        totalMissed: 0,
        totalRevenue: 0,
        conversionRate: 0,
        missRate: 0,
      };
    }

    const totalCalls = processedData.daily.reduce(
      (sum, d) => sum + (d?.totalCalls || 0),
      0
    );
    const totalBillable = processedData.daily.reduce(
      (sum, d) => sum + (d?.billableLeads || 0),
      0
    );
    const totalSales = processedData.daily.reduce((sum, d) => sum + (d?.sales || 0), 0);
    const totalMissed = processedData.daily.reduce(
      (sum, d) => sum + (d?.missedCalls || 0),
      0
    );
    const totalRevenue = processedData.daily.reduce(
      (sum, d) => sum + (d?.revenue || 0),
      0
    );

    return {
      totalCalls,
      totalBillable,
      totalSales,
      totalMissed,
      totalRevenue,
      conversionRate:
        totalBillable > 0 ? (totalSales / totalBillable) * 100 : 0,
      missRate: totalCalls > 0 ? (totalMissed / totalCalls) * 100 : 0,
    };
  }, [processedData.daily]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: theme.palette.grey[50], pb: 4 }}>
      <Container maxWidth="xl" sx={{ pt: 3 }}>
        {/* Header Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Life Insurance Analytics Dashboard
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Chip
              icon={<DateRange />}
              label={filters.timeFrame}
              color="primary"
              variant="outlined"
            />
            {filters.location && filters.location !== "Combined" && (
              <Chip
                icon={<LocationOn />}
                label={filters.location}
                color="secondary"
                variant="outlined"
              />
            )}
          </Stack>
        </Box>

        {/* View Toggle */}
        <Box sx={{ mb: 3 }}>
          <ToggleButtonGroup
            value={selectedView}
            exclusive
            onChange={(_, newView) => newView && setSelectedView(newView)}
            sx={{ bgcolor: "background.paper", boxShadow: 1 }}
          >
            <ToggleButton value="revenue">Revenue Overview</ToggleButton>
            <ToggleButton value="leads">Lead Analytics</ToggleButton>
            <ToggleButton value="performance">Performance Metrics</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Metrics Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Total Revenue"
              value={formatCurrency(summaryMetrics.totalRevenue)}
              subtitle={`Target: ${formatCurrency(
                processedData.metrics.total.monthlyTarget
              )}`}
              icon={<AttachMoney sx={{ color: theme.palette.success.main }} />}
              trend={15.2}
              color={theme.palette.success.main}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Total Calls"
              value={summaryMetrics.totalCalls.toLocaleString()}
              subtitle={`Billable: ${summaryMetrics.totalBillable.toLocaleString()}`}
              icon={<Phone sx={{ color: theme.palette.info.main }} />}
              trend={8.5}
              color={theme.palette.info.main}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Conversion Rate"
              value={`${summaryMetrics.conversionRate.toFixed(1)}%`}
              subtitle={`${summaryMetrics.totalSales} sales`}
              icon={<TrendingUp sx={{ color: theme.palette.primary.main }} />}
              trend={-2.3}
              color={theme.palette.primary.main}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Missed Calls"
              value={summaryMetrics.totalMissed.toLocaleString()}
              subtitle={`${summaryMetrics.missRate.toFixed(1)}% miss rate`}
              icon={<PhoneMissed sx={{ color: theme.palette.error.main }} />}
              trend={-12.1}
              color={theme.palette.error.main}
            />
          </Grid>
        </Grid>

        {/* Main Charts Section */}
        {selectedView === "revenue" && (
          <Grid container spacing={3}>
            <Grid item xs={12} lg={8}>
              <Paper sx={{ p: 3, height: "100%" }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    mb: 2,
                  }}
                >
                  <Typography variant="h6">Revenue Trend</Typography>
                  <IconButton
                    onClick={() =>
                      setExpandedChart(
                        expandedChart === "revenue" ? null : "revenue"
                      )
                    }
                  >
                    {expandedChart === "revenue" ? (
                      <FullscreenExitOutlined />
                    ) : (
                      <FullscreenOutlined />
                    )}
                  </IconButton>
                </Box>
                {processedData.daily.length > 0 ? (
                  <ApexCharts
                    options={revenueChartOptions}
                    series={[
                      {
                        name: "Austin",
                        data: processedData.daily
                          .filter((d) => d && d.site === "ATX")
                          .map((d) => d.revenue || 0),
                      },
                      {
                        name: "Charlotte",
                        data: processedData.daily
                          .filter((d) => d && d.site === "CLT")
                          .map((d) => d.revenue || 0),
                      },
                    ]}
                    type="area"
                    height={expandedChart === "revenue" ? 500 : 350}
                  />
                ) : (
                  <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 350 }}>
                    <Typography color="text.secondary">Loading revenue data...</Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
            <Grid item xs={12} lg={4}>
              <Paper sx={{ p: 3, height: "100%" }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Performance vs Target
                </Typography>
                {processedData.metrics ? (
                  <ApexCharts
                    options={performanceBarOptions}
                    series={[
                      {
                        name: "Austin",
                        data: [
                          processedData.metrics.austin?.monthlyTarget || 0,
                          processedData.metrics.austin?.revenue || 0,
                          processedData.metrics.austin?.projectedRevenue || 0,
                        ],
                      },
                      {
                        name: "Charlotte",
                        data: [
                          processedData.metrics.charlotte?.monthlyTarget || 0,
                          processedData.metrics.charlotte?.revenue || 0,
                          processedData.metrics.charlotte?.projectedRevenue || 0,
                        ],
                      },
                    ]}
                    type="bar"
                    height={350}
                  />
                ) : (
                  <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 350 }}>
                    <Typography color="text.secondary">Loading performance data...</Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        )}

        {selectedView === "leads" && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, height: "100%" }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Lead Conversion Funnel
                </Typography>
                <ApexCharts
                  options={leadConversionOptions}
                  series={[
                    summaryMetrics.totalSales,
                    summaryMetrics.totalBillable - summaryMetrics.totalSales,
                    summaryMetrics.totalMissed,
                  ]}
                  type="donut"
                  height={300}
                />
              </Paper>
            </Grid>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 3, height: "100%" }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Daily Lead Volume
                </Typography>
                <ApexCharts
                  options={{
                    ...revenueChartOptions,
                    chart: {
                      ...revenueChartOptions.chart,
                      type: "bar",
                    },
                    yaxis: {
                      labels: {
                        formatter: (value) => value.toFixed(0),
                        style: {
                          colors: theme.palette.text.secondary,
                        },
                      },
                    },
                    tooltip: {
                      theme: theme.palette.mode,
                      y: {
                        formatter: (value) => `${value} leads`,
                      },
                    },
                  }}
                    series={[
                      {
                        name: "Billable Leads",
                        data: processedData.daily.map((d) => d?.billableLeads || 0),
                      },
                      {
                        name: "Sales",
                        data: processedData.daily.map((d) => d?.sales || 0),
                      },
                    ]}
                  type="bar"
                  height={350}
                />
              </Paper>
            </Grid>
          </Grid>
        )}

        {selectedView === "performance" && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Key Performance Indicators
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <ApexCharts
                      options={{
                        chart: {
                          type: "radialBar",
                          toolbar: {
                            show: false,
                          },
                        },
                        plotOptions: {
                          radialBar: {
                            startAngle: -135,
                            endAngle: 225,
                            hollow: {
                              margin: 0,
                              size: "70%",
                              background: "transparent",
                            },
                            track: {
                              background: theme.palette.grey[200],
                              strokeWidth: "100%",
                              margin: 0,
                            },
                            dataLabels: {
                              show: true,
                              name: {
                                show: true,
                                fontSize: "16px",
                                fontWeight: 600,
                                color: theme.palette.text.primary,
                                offsetY: -10,
                              },
                              value: {
                                show: true,
                                fontSize: "24px",
                                fontWeight: 700,
                                color: theme.palette.text.primary,
                                offsetY: 10,
                                formatter: function (val) {
                                  return val.toFixed(1) + "%";
                                },
                              },
                            },
                          },
                        },
                        fill: {
                          type: "gradient",
                          gradient: {
                            shade: "dark",
                            type: "vertical",
                            shadeIntensity: 0.5,
                            gradientToColors: [theme.palette.success.main],
                            inverseColors: false,
                            opacityFrom: 1,
                            opacityTo: 1,
                            stops: [0, 100],
                          },
                        },
                        colors: [theme.palette.primary.main],
                        labels: ["Attainment"],
                      }}
                      series={[processedData.metrics.total.attainment]}
                      type="radialBar"
                      height={300}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="subtitle1" gutterBottom>
                          Austin Performance
                        </Typography>
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 2 }}
                        >
                          <Box sx={{ flexGrow: 1 }}>
                            <Box
                              sx={{
                                height: 8,
                                bgcolor: theme.palette.grey[200],
                                borderRadius: 4,
                                overflow: "hidden",
                              }}
                            >
                              <Box
                                sx={{
                                  height: "100%",
                                  width: `${Math.min(
                                    processedData.metrics.austin.attainment,
                                    100
                                  )}%`,
                                  bgcolor: theme.palette.primary.main,
                                  transition: "width 0.3s",
                                }}
                              />
                            </Box>
                          </Box>
                          <Typography variant="body2" fontWeight="bold">
                            {processedData.metrics.austin.attainment.toFixed(1)}
                            %
                          </Typography>
                        </Box>
                      </Box>
                      <Box>
                        <Typography variant="subtitle1" gutterBottom>
                          Charlotte Performance
                        </Typography>
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 2 }}
                        >
                          <Box sx={{ flexGrow: 1 }}>
                            <Box
                              sx={{
                                height: 8,
                                bgcolor: theme.palette.grey[200],
                                borderRadius: 4,
                                overflow: "hidden",
                              }}
                            >
                              <Box
                                sx={{
                                  height: "100%",
                                  width: `${Math.min(
                                    processedData.metrics.charlotte.attainment,
                                    100
                                  )}%`,
                                  bgcolor: theme.palette.secondary.main,
                                  transition: "width 0.3s",
                                }}
                              />
                            </Box>
                          </Box>
                          <Typography variant="body2" fontWeight="bold">
                            {processedData.metrics.charlotte.attainment.toFixed(
                              1
                            )}
                            %
                          </Typography>
                        </Box>
                      </Box>
                    </Stack>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        )}
      </Container>
    </Box>
  );
};
