import React, { useMemo } from "react";
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
  const [expandedLocation, setExpandedLocation] = React.useState<string | null>(null);

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
    const currentWeekData = revenueData.filter(
      (d) => {
        const date = parseISO(d.date);
        return date >= currentWeekStart && date <= currentWeekEnd;
      }
    );

    const previousWeekData = revenueData.filter(
      (d) => {
        const date = parseISO(d.date);
        return date >= previousWeekStart && date <= previousWeekEnd;
      }
    );

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

      const currentTotal = location === "Austin" 
        ? currentMetrics.austin.revenue
        : location === "Charlotte"
        ? currentMetrics.charlotte.revenue
        : currentMetrics.total.revenue;

      const previousTotal = location === "Austin"
        ? previousMetrics.austin.revenue
        : location === "Charlotte"
        ? previousMetrics.charlotte.revenue
        : previousMetrics.total.revenue;

      const currentAttainment = location === "Austin"
        ? currentMetrics.austin.attainment
        : location === "Charlotte"
        ? currentMetrics.charlotte.attainment
        : currentMetrics.total.attainment;

      const previousAttainment = location === "Austin"
        ? previousMetrics.austin.attainment
        : location === "Charlotte"
        ? previousMetrics.charlotte.attainment
        : previousMetrics.total.attainment;

      const changePercentage = previousTotal > 0
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

        const currentDayData = currentWeekData.find(d => d.date === currentDateStr);
        const previousDayData = previousWeekData.find(d => d.date === previousDateStr);

        if (currentDayData && previousDayData) {
          const currentRevenue = location === "Austin"
            ? currentDayData.austin
            : location === "Charlotte"
            ? currentDayData.charlotte
            : currentDayData.austin + currentDayData.charlotte;

          const previousRevenue = location === "Austin"
            ? previousDayData.austin
            : location === "Charlotte"
            ? previousDayData.charlotte
            : previousDayData.austin + previousDayData.charlotte;

          const dropPercentage = previousRevenue > 0
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

          const currentDayAttainment = location === "Austin"
            ? dailyMetrics.austin.attainment
            : location === "Charlotte"
            ? dailyMetrics.charlotte.attainment
            : dailyMetrics.total.attainment;

          const previousDayAttainment = location === "Austin"
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
    return null;
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
        p: 3,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        mb: 3,
      }}
    >
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <WarningIcon sx={{ color: "warning.main", fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Weekly Performance Alerts
          </Typography>
          <Chip
            label={`${weeklyComparisons.length} Alert${weeklyComparisons.length > 1 ? 's' : ''}`}
            color="warning"
            size="small"
          />
        </Stack>

        <Typography variant="body2" color="text.secondary">
          Locations with week-over-week revenue drops exceeding 7%
        </Typography>

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
                  <span>{Math.abs(comparison.changePercentage).toFixed(1)}% Drop</span>
                </Stack>
              </AlertTitle>
              
              <Stack spacing={1}>
                <Typography variant="body2">
                  Current Week: {formatCurrency(comparison.currentWeekTotal)} ({comparison.currentWeekAttainment.toFixed(1)}% attainment)
                </Typography>
                <Typography variant="body2">
                  Previous Week: {formatCurrency(comparison.previousWeekTotal)} ({comparison.previousWeekAttainment.toFixed(1)}% attainment)
                </Typography>
                {comparison.dailyAlerts.length > 0 && (
                  <Typography variant="body2" sx={{ fontWeight: 500, mt: 1 }}>
                    {comparison.dailyAlerts.length} day{comparison.dailyAlerts.length > 1 ? 's' : ''} with drops &gt;7%
                  </Typography>
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
                            <TableCell align="right">Current</TableCell>
                            <TableCell align="right">Previous</TableCell>
                            <TableCell align="right">Drop</TableCell>
                            <TableCell align="right">Attainment</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {comparison.dailyAlerts.map((alert) => (
                            <TableRow key={alert.date}>
                              <TableCell>
                                <Stack direction="row" alignItems="center" spacing={1}>
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
                                  label={`${alert.dropPercentage.toFixed(1)}%`}
                                  size="small"
                                  color={alert.dropPercentage > 15 ? "error" : "warning"}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <Stack spacing={0}>
                                  <Typography variant="body2">
                                    {alert.currentAttainment.toFixed(1)}%
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    vs {alert.previousAttainment.toFixed(1)}%
                                  </Typography>
                                </Stack>
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
    </Paper>
  );
};
