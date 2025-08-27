import React, { useMemo, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Alert,
  AlertTitle,
  Chip,
  Collapse,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import {
  Warning as WarningIcon,
  ExpandMore,
  ExpandLess,
  TrendingDown,
  LocationOn,
  CalendarToday,
} from "@mui/icons-material";
import { format, parseISO, subDays, startOfWeek, endOfWeek } from "date-fns";
import { RevenueData, TargetSettings } from "../types/revenue";
import { calculateLocationMetrics } from "../utils/calculations";
import { formatCurrency } from "../utils/formatters";

interface AttendanceAlertsProps {
  revenueData: RevenueData[];
  targetSettings: TargetSettings;
}

interface DailyAlert {
  date: string;
  location: "Austin" | "Charlotte" | "Combined";
  currentRevenue: number;
  previousRevenue: number;
  dropPercentage: number;
  currentAttainment: number;
  previousAttainment: number;
}

interface WeeklyComparison {
  location: "Austin" | "Charlotte" | "Combined";
  currentWeekTotal: number;
  previousWeekTotal: number;
  changePercentage: number;
  currentWeekAttainment: number;
  previousWeekAttainment: number;
  dailyAlerts: DailyAlert[];
}

export const AttendanceAlerts: React.FC<AttendanceAlertsProps> = ({
  revenueData,
  targetSettings,
}) => {
  const [expandedLocation, setExpandedLocation] = React.useState<string | null>(
    null
  );
  const [isMainExpanded, setIsMainExpanded] = React.useState(() => {
    const saved = localStorage.getItem("attendanceAlertsExpanded");
    return saved !== null ? saved === "true" : true;
  });

  useEffect(() => {
    localStorage.setItem("attendanceAlertsExpanded", isMainExpanded.toString());
  }, [isMainExpanded]);

  const weeklyComparisons = useMemo(() => {
    if (!revenueData || revenueData.length === 0 || !targetSettings) {
      return [];
    }

    const today = new Date();
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
    const currentWeekEnd = endOfWeek(today, { weekStartsOn: 1 });
    const previousWeekStart = subDays(currentWeekStart, 7);
    const previousWeekEnd = subDays(currentWeekEnd, 7);

    // Filter data for current and previous weeks
    const currentWeekData = revenueData.filter((d) => {
      const date = parseISO(d.date);
      return date >= currentWeekStart && date <= currentWeekEnd;
    });

    const previousWeekData = revenueData.filter((d) => {
      const date = parseISO(d.date);
      return date >= previousWeekStart && date <= previousWeekEnd;
    });

    const comparisons: WeeklyComparison[] = [];

    // Analyze each location
    ["Austin", "Charlotte", "Combined"].forEach((location) => {
      const currentMetrics = calculateLocationMetrics(
        currentWeekData,
        targetSettings,
        location,
        "custom"
      );

      const previousMetrics = calculateLocationMetrics(
        previousWeekData,
        targetSettings,
        location,
        "custom"
      );

      const currentTotal =
        location === "Austin"
          ? currentMetrics.austin.revenue
          : location === "Charlotte"
          ? currentMetrics.charlotte.revenue
          : currentMetrics.total.revenue;

      const previousTotal =
        location === "Austin"
          ? previousMetrics.austin.revenue
          : location === "Charlotte"
          ? previousMetrics.charlotte.revenue
          : previousMetrics.total.revenue;

      const currentAttainment =
        location === "Austin"
          ? currentMetrics.austin.attainment
          : location === "Charlotte"
          ? currentMetrics.charlotte.attainment
          : currentMetrics.total.attainment;

      const previousAttainment =
        location === "Austin"
          ? previousMetrics.austin.attainment
          : location === "Charlotte"
          ? previousMetrics.charlotte.attainment
          : previousMetrics.total.attainment;

      const changePercentage =
        previousTotal > 0
          ? ((currentTotal - previousTotal) / previousTotal) * 100
          : 0;

      // Check daily alerts
      const dailyAlerts: DailyAlert[] = [];

      // For each day in current week, compare with same day previous week
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(currentWeekStart);
        currentDate.setDate(currentDate.getDate() + i);
        const previousDate = new Date(previousWeekStart);
        previousDate.setDate(previousDate.getDate() + i);

        const currentDateStr = format(currentDate, "yyyy-MM-dd");
        const previousDateStr = format(previousDate, "yyyy-MM-dd");

        const currentDayData = currentWeekData.find(
          (d) => d.date === currentDateStr
        );
        const previousDayData = previousWeekData.find(
          (d) => d.date === previousDateStr
        );

        if (currentDayData && previousDayData) {
          const currentRevenue =
            location === "Austin"
              ? currentDayData.austin
              : location === "Charlotte"
              ? currentDayData.charlotte
              : currentDayData.austin + currentDayData.charlotte;

          const previousRevenue =
            location === "Austin"
              ? previousDayData.austin
              : location === "Charlotte"
              ? previousDayData.charlotte
              : previousDayData.austin + previousDayData.charlotte;

          const dropPercentage =
            previousRevenue > 0
              ? ((previousRevenue - currentRevenue) / previousRevenue) * 100
              : 0;

          // Calculate daily attainment
          const dailyMetrics = calculateLocationMetrics(
            [currentDayData],
            targetSettings,
            location,
            "custom"
          );

          const previousDailyMetrics = calculateLocationMetrics(
            [previousDayData],
            targetSettings,
            location,
            "custom"
          );

          const currentDayAttainment =
            location === "Austin"
              ? dailyMetrics.austin.attainment
              : location === "Charlotte"
              ? dailyMetrics.charlotte.attainment
              : dailyMetrics.total.attainment;

          const previousDayAttainment =
            location === "Austin"
              ? previousDailyMetrics.austin.attainment
              : location === "Charlotte"
              ? previousDailyMetrics.charlotte.attainment
              : previousDailyMetrics.total.attainment;

          if (dropPercentage > 7) {
            dailyAlerts.push({
              date: currentDateStr,
              location: location as "Austin" | "Charlotte" | "Combined",
              currentRevenue,
              previousRevenue,
              dropPercentage,
              currentAttainment: currentDayAttainment,
              previousAttainment: previousDayAttainment,
            });
          }
        }
      }

      if (changePercentage < -7 || dailyAlerts.length > 0) {
        comparisons.push({
          location: location as "Austin" | "Charlotte" | "Combined",
          currentWeekTotal: currentTotal,
          previousWeekTotal: previousTotal,
          changePercentage,
          currentWeekAttainment: currentAttainment,
          previousWeekAttainment: previousAttainment,
          dailyAlerts,
        });
      }
    });

    return comparisons.sort((a, b) => a.changePercentage - b.changePercentage);
  }, [revenueData, targetSettings]);

  if (weeklyComparisons.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          border: "1px solid",
          borderColor: "success.light",
          borderRadius: 2,
          mb: 3,
          bgcolor: "success.lighter",
          overflow: "hidden",
        }}
      >
        <Box sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                bgcolor: "success.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Typography variant="h6" sx={{ color: "white" }}>
                ✓
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: "success.dark" }}>
                Weekly Revenue Performance Monitoring
              </Typography>
              <Typography variant="body2" color="text.secondary">
                All locations are maintaining consistent week-over-week revenue performance.
                No significant drops detected.
              </Typography>
            </Box>
            <IconButton
              onClick={() => setIsMainExpanded(!isMainExpanded)}
              sx={{ ml: "auto" }}
            >
              {isMainExpanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Stack>
        </Box>
      </Paper>
    );
  }

  const getSeverity = (dropPercentage: number) => {
    if (Math.abs(dropPercentage) > 20) return "error";
    if (Math.abs(dropPercentage) > 10) return "warning";
    return "info";
  };

  const handleToggleExpand = (location: string) => {
    setExpandedLocation(expandedLocation === location ? null : location);
  };

  return (
    <Paper
      elevation={0}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        mb: 3,
        overflow: "hidden",
      }}
    >
      <Box sx={{ p: 3, pb: isMainExpanded ? 0 : 3 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <WarningIcon sx={{ color: "warning.main", fontSize: 28 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Weekly Revenue Performance Monitoring
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Automated alerts for significant week-over-week revenue changes
            </Typography>
          </Box>
          <Chip
            label={`${weeklyComparisons.length} Alert${
              weeklyComparisons.length > 1 ? "s" : ""
            }`}
            color="warning"
            size="small"
            sx={{ mr: 1 }}
          />
          <IconButton
            onClick={() => setIsMainExpanded(!isMainExpanded)}
            sx={{ ml: "auto" }}
          >
            {isMainExpanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Stack>
      </Box>

      <Collapse in={isMainExpanded}>
        <Box sx={{ p: 3, pt: 0 }}>
          <Stack spacing={3}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  This system monitors week-over-week revenue changes to identify potential issues early:
                </Typography>
            <Stack direction="row" spacing={3} flexWrap="wrap">
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box sx={{ width: 12, height: 12, bgcolor: "info.main", borderRadius: "2px" }} />
                <Typography variant="caption">7-10% drop: Monitor closely</Typography>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box sx={{ width: 12, height: 12, bgcolor: "warning.main", borderRadius: "2px" }} />
                <Typography variant="caption">10-20% drop: Investigation needed</Typography>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box sx={{ width: 12, height: 12, bgcolor: "error.main", borderRadius: "2px" }} />
                <Typography variant="caption">&gt;20% drop: Immediate action required</Typography>
              </Stack>
            </Stack>
              </Box>
            </Stack>

            <Stack spacing={2}>
          {weeklyComparisons.map((comparison) => (
            <Alert
              key={comparison.location}
              severity={getSeverity(comparison.changePercentage)}
              action={
                comparison.dailyAlerts.length > 0 && (
                  <IconButton
                    size="small"
                    onClick={() => handleToggleExpand(comparison.location)}
                  >
                    {expandedLocation === comparison.location ? (
                      <ExpandLess />
                    ) : (
                      <ExpandMore />
                    )}
                  </IconButton>
                )
              }
            >
              <AlertTitle sx={{ fontWeight: 600 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <LocationOn fontSize="small" />
                  <span>{comparison.location}</span>
                  <TrendingDown fontSize="small" />
                  <span>
                    {comparison.changePercentage > 0 ? "+" : ""}{comparison.changePercentage.toFixed(1)}% {comparison.changePercentage < 0 ? "Drop" : "Increase"}
                  </span>
                </Stack>
              </AlertTitle>

              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Revenue Comparison:
                  </Typography>
                  <Typography variant="body2">
                    This Week: {formatCurrency(comparison.currentWeekTotal)}
                  </Typography>
                  <Typography variant="body2">
                    Last Week: {formatCurrency(comparison.previousWeekTotal)}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    Change: {formatCurrency(Math.abs(comparison.currentWeekTotal - comparison.previousWeekTotal))} 
                    {comparison.changePercentage < 0 ? " decrease" : " increase"}
                  </Typography>
                </Box>
                
                {Math.abs(comparison.changePercentage) > 10 && (
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: "warning.dark" }}>
                      Business Impact:
                    </Typography>
                    <Typography variant="body2">
                      {comparison.changePercentage < -15 
                        ? "Significant revenue decline requiring immediate attention. Review staffing, lead quality, and operational issues."
                        : comparison.changePercentage < -10
                        ? "Notable revenue drop. Investigate potential causes including agent availability, training needs, or market conditions."
                        : "Revenue variance within acceptable range but worth monitoring for trends."
                      }
                    </Typography>
                  </Box>
                )}
                
                {comparison.dailyAlerts.length > 0 && (
                  <Typography variant="body2" sx={{ fontWeight: 500, mt: 1 }}>
                    {comparison.dailyAlerts.length} day{comparison.dailyAlerts.length > 1 ? "s" : ""} had significant drops (&gt;7%)
                  </Typography>
                )}
                
                {Math.abs(comparison.changePercentage) > 15 && (
                  <Box sx={{ mt: 1, p: 1.5, bgcolor: "action.hover", borderRadius: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>
                      Recommended Actions:
                    </Typography>
                    <Typography variant="caption" component="ul" sx={{ m: 0, pl: 2 }}>
                      <li>Check agent staffing levels and attendance</li>
                      <li>Review lead quality and conversion rates</li>
                      <li>Verify no technical issues with systems</li>
                      <li>Compare with same period last month for patterns</li>
                    </Typography>
                  </Box>
                )}
              </Stack>

              {comparison.dailyAlerts.length > 0 && (
                <Collapse in={expandedLocation === comparison.location}>
                  <Box sx={{ mt: 2 }}>
                    <TableContainer>
                      <Table size="small">
                                                    <TableHead>
                          <TableRow>
                            <TableCell>Date</TableCell>
                            <TableCell align="right">This Week</TableCell>
                            <TableCell align="right">Last Week</TableCell>
                            <TableCell align="right">Change</TableCell>
                            <TableCell align="right">Day of Week</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {comparison.dailyAlerts.map((alert) => (
                            <TableRow key={alert.date}>
                              <TableCell>
                                <Stack
                                  direction="row"
                                  alignItems="center"
                                  spacing={1}
                                >
                                  <CalendarToday fontSize="small" />
                                  {format(parseISO(alert.date), "MMM d")}
                                </Stack>
                              </TableCell>
                              <TableCell align="right">
                                {formatCurrency(alert.currentRevenue)}
                              </TableCell>
                              <TableCell align="right">
                                {formatCurrency(alert.previousRevenue)}
                              </TableCell>
                              <TableCell align="right">
                                <Chip
                                  label={`-${alert.dropPercentage.toFixed(1)}%`}
                                  size="small"
                                  color={
                                    alert.dropPercentage > 15
                                      ? "error"
                                      : "warning"
                                  }
                                />
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2">
                                  {format(parseISO(alert.date), "EEEE")}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                </Collapse>
              )}
            </Alert>
          ))}
        </Stack>
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
};
