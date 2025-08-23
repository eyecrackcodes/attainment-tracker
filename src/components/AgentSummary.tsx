import React, { useState, useEffect } from "react";
import {
  Paper,
  Typography,
  Box,
  Grid,
  Stack,
  Skeleton,
  Chip,
  Divider,
  Alert,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import {
  Groups as GroupsIcon,
  TrendingUp,
  TrendingDown,
  Person,
  Warning,
  CheckCircle,
  Assessment,
  LocationOn,
  CalendarMonth,
  DateRange,
  Today,
} from "@mui/icons-material";
import { format, subDays, startOfMonth, endOfMonth, isWeekend, parseISO, differenceInDays } from "date-fns";
import { leadService, LeadEntryStored, SiteKey } from "../services/leadService";

interface DailyMetrics {
  date: string;
  atx: {
    agents: number;
    meetingMin: number;
    attainmentPct: number;
  };
  clt: {
    agents: number;
    meetingMin: number;
    attainmentPct: number;
  };
  total: {
    agents: number;
    meetingMin: number;
    meetingMinPct: number;
  };
}

interface LocationStats {
  avgAgents: number;
  avgMeetingMin: number;
  avgAttainment: number;
  daysWithData: number;
  outages: number; // days with <80% of average agents
}

type DateRangePreset = "yesterday" | "7d" | "30d" | "mtd" | "custom";

export const AgentSummary: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [selectedDayMetrics, setSelectedDayMetrics] = useState<DailyMetrics | null>(null);
  const [rangeMetrics, setRangeMetrics] = useState<DailyMetrics[]>([]);
  const [locationStats, setLocationStats] = useState<{
    atx: LocationStats;
    clt: LocationStats;
    combined: LocationStats;
  }>({
    atx: { avgAgents: 0, avgMeetingMin: 0, avgAttainment: 0, daysWithData: 0, outages: 0 },
    clt: { avgAgents: 0, avgMeetingMin: 0, avgAttainment: 0, daysWithData: 0, outages: 0 },
    combined: { avgAgents: 0, avgMeetingMin: 0, avgAttainment: 0, daysWithData: 0, outages: 0 },
  });
  
  const [preset, setPreset] = useState<DateRangePreset>("yesterday");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  
  // Calculate date range based on preset
  const getDateRange = () => {
    const today = new Date();
    let start: Date;
    let end: Date;

    switch (preset) {
      case "yesterday":
        start = subDays(today, 1);
        end = subDays(today, 1);
        break;
      case "7d":
        start = subDays(today, 7);
        end = subDays(today, 1);
        break;
      case "30d":
        start = subDays(today, 30);
        end = subDays(today, 1);
        break;
      case "mtd":
        start = startOfMonth(today);
        end = subDays(today, 1);
        break;
      case "custom":
        start = customStartDate ? new Date(customStartDate) : subDays(today, 7);
        end = customEndDate ? new Date(customEndDate) : subDays(today, 1);
        break;
      default:
        start = subDays(today, 1);
        end = subDays(today, 1);
    }

    return {
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
    };
  };

  const dateRange = getDateRange();
  const isDateRangeValid = dateRange.start <= dateRange.end;

  // Initialize custom dates when switching to custom preset
  useEffect(() => {
    if (preset === "custom" && !customStartDate && !customEndDate) {
      const today = new Date();
      const sevenDaysAgo = subDays(today, 7);
      const yesterday = subDays(today, 1);
      setCustomStartDate(format(sevenDaysAgo, "yyyy-MM-dd"));
      setCustomEndDate(format(yesterday, "yyyy-MM-dd"));
    }
  }, [preset, customStartDate, customEndDate]);

  useEffect(() => {
    setLoading(true);
    
    if (!isDateRangeValid) {
      setLoading(false);
      return;
    }

    // Subscribe to the date range data
    const unsubRange = leadService.subscribeToRange(dateRange.start, dateRange.end, (dataMap) => {
      // Collect all metrics for the range
      const metrics: DailyMetrics[] = [];
      
      dataMap.forEach((dayData, date) => {
        const atx = dayData.ATX;
        const clt = dayData.CLT;
        
        const totalAgents = (atx?.availableAgents || 0) + (clt?.availableAgents || 0);
        const totalMeetingMin = (atx?.agentsMeetingMin || 0) + (clt?.agentsMeetingMin || 0);
        
        metrics.push({
          date,
          atx: {
            agents: atx?.availableAgents || 0,
            meetingMin: atx?.agentsMeetingMin || 0,
            attainmentPct: atx?.derived?.attainmentPct ? atx.derived.attainmentPct * 100 : 0,
          },
          clt: {
            agents: clt?.availableAgents || 0,
            meetingMin: clt?.agentsMeetingMin || 0,
            attainmentPct: clt?.derived?.attainmentPct ? clt.derived.attainmentPct * 100 : 0,
          },
          total: {
            agents: totalAgents,
            meetingMin: totalMeetingMin,
            meetingMinPct: totalAgents > 0 ? (totalMeetingMin / totalAgents) * 100 : 0,
          },
        });
      });
      
      // Sort by date
      metrics.sort((a, b) => a.date.localeCompare(b.date));
      setRangeMetrics(metrics);
      
      // Set the most recent day as selected (or the only day for single day ranges)
      if (metrics.length > 0) {
        setSelectedDayMetrics(metrics[metrics.length - 1]);
      } else {
        setSelectedDayMetrics(null);
      }
      
      // Calculate statistics from the range metrics
      const stats = {
        atx: { totalAgents: 0, totalMeetingMin: 0, totalAttainment: 0, daysWithData: 0, agentsByDay: [] as number[] },
        clt: { totalAgents: 0, totalMeetingMin: 0, totalAttainment: 0, daysWithData: 0, agentsByDay: [] as number[] },
      };

      // Process each day's metrics
      metrics.forEach((dayMetrics) => {
        // Skip weekends for business metrics
        if (isWeekend(new Date(dayMetrics.date))) return;
        
        // ATX stats
        if (dayMetrics.atx.agents > 0) {
          stats.atx.daysWithData++;
          stats.atx.totalAgents += dayMetrics.atx.agents;
          stats.atx.totalMeetingMin += dayMetrics.atx.meetingMin;
          stats.atx.totalAttainment += dayMetrics.atx.attainmentPct / 100; // Convert back to decimal
          stats.atx.agentsByDay.push(dayMetrics.atx.agents);
        }
        
        // CLT stats
        if (dayMetrics.clt.agents > 0) {
          stats.clt.daysWithData++;
          stats.clt.totalAgents += dayMetrics.clt.agents;
          stats.clt.totalMeetingMin += dayMetrics.clt.meetingMin;
          stats.clt.totalAttainment += dayMetrics.clt.attainmentPct / 100; // Convert back to decimal
          stats.clt.agentsByDay.push(dayMetrics.clt.agents);
        }
      });

      // Calculate averages and outages
      const calculateLocationStats = (data: typeof stats.atx): LocationStats => {
        if (data.daysWithData === 0) {
          return { avgAgents: 0, avgMeetingMin: 0, avgAttainment: 0, daysWithData: 0, outages: 0 };
        }
        
        const avgAgents = data.totalAgents / data.daysWithData;
        const avgMeetingMin = data.totalMeetingMin / data.daysWithData;
        const avgAttainment = (data.totalAttainment / data.daysWithData) * 100;
        
        // Count outages (days with <80% of average agents)
        const outages = data.agentsByDay.filter(agents => agents < avgAgents * 0.8).length;
        
        return {
          avgAgents,
          avgMeetingMin,
          avgAttainment,
          daysWithData: data.daysWithData,
          outages,
        };
      };

      const atxStats = calculateLocationStats(stats.atx);
      const cltStats = calculateLocationStats(stats.clt);
      
      // Combined stats
      const combinedDays = Math.max(stats.atx.daysWithData, stats.clt.daysWithData);
      const combinedStats: LocationStats = {
        avgAgents: atxStats.avgAgents + cltStats.avgAgents,
        avgMeetingMin: atxStats.avgMeetingMin + cltStats.avgMeetingMin,
        avgAttainment: combinedDays > 0 
          ? ((atxStats.avgAttainment * atxStats.daysWithData + cltStats.avgAttainment * cltStats.daysWithData) / 
             (atxStats.daysWithData + cltStats.daysWithData))
          : 0,
        daysWithData: combinedDays,
        outages: Math.max(atxStats.outages, cltStats.outages), // Use max outages from either location
      };

      setLocationStats({
        atx: atxStats,
        clt: cltStats,
        combined: combinedStats,
      });
      
      setLoading(false);
    });

    return () => {
      unsubRange();
    };
  }, [dateRange.start, dateRange.end]);

  if (loading) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
        }}
      >
        <Skeleton variant="rectangular" height={120} />
      </Paper>
    );
  }

  const hasSelectedDayData = selectedDayMetrics && selectedDayMetrics.total.agents > 0;
  const selectedDate = selectedDayMetrics ? new Date(selectedDayMetrics.date) : new Date();
  const isSelectedDateWeekend = selectedDayMetrics ? isWeekend(new Date(selectedDayMetrics.date)) : false;
  const isSingleDay = dateRange.start === dateRange.end;
  const dayCount = differenceInDays(new Date(dateRange.end), new Date(dateRange.start)) + 1;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        mb: 3,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
      }}
    >
      <Stack spacing={3}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <GroupsIcon sx={{ fontSize: 28, color: "primary.main" }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Agent Performance Insights
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {isSingleDay 
                  ? format(new Date(dateRange.start), "MMMM d, yyyy")
                  : `${format(new Date(dateRange.start), "MMM d")} - ${format(new Date(dateRange.end), "MMM d, yyyy")}`
                } performance {!isSingleDay && `(${dayCount} days)`}
              </Typography>
            </Box>
          </Stack>
          
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
              sx={{ bgcolor: "background.paper" }}
            >
              <ToggleButton value="yesterday" sx={{ px: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Today fontSize="small" />
                  <Typography variant="body2">Yesterday</Typography>
                </Stack>
              </ToggleButton>
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

        <Grid container spacing={3}>
          {/* Selected Period Performance */}
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ 
              p: 2, 
              bgcolor: hasSelectedDayData ? "primary.lighter" : "grey.100", 
              borderRadius: 2,
              border: "1px solid",
              borderColor: hasSelectedDayData ? "primary.light" : "grey.300",
            }}>
              <Stack spacing={1}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Assessment fontSize="small" color={hasSelectedDayData ? "primary" : "disabled"} />
                  <Typography variant="body2" color="text.secondary">
                    {isSingleDay ? format(selectedDate, "MMM d") : "Period"} Total
                  </Typography>
                </Stack>
                <Typography variant="h4" sx={{ fontWeight: 700, color: hasSelectedDayData ? "primary.main" : "text.disabled" }}>
                  {isSingleDay && hasSelectedDayData 
                    ? selectedDayMetrics.total.agents 
                    : !isSingleDay && locationStats.combined.avgAgents > 0
                    ? locationStats.combined.avgAgents.toFixed(0)
                    : "-"}
                </Typography>
                <Stack direction="row" spacing={1}>
                  {hasSelectedDayData || locationStats.combined.avgAgents > 0 ? (
                    <>
                      <Chip 
                        label={`ATX: ${isSingleDay ? selectedDayMetrics.atx.agents : locationStats.atx.avgAgents.toFixed(0)}`} 
                        size="small" 
                        sx={{ bgcolor: "background.paper" }}
                      />
                      <Chip 
                        label={`CLT: ${isSingleDay ? selectedDayMetrics.clt.agents : locationStats.clt.avgAgents.toFixed(0)}`} 
                        size="small"
                        sx={{ bgcolor: "background.paper" }}
                      />
                    </>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      {isSelectedDateWeekend && isSingleDay ? "Weekend - No data" : "No data entered"}
                    </Typography>
                  )}
                </Stack>
              </Stack>
            </Box>
          </Grid>

          {/* Meeting Minimum Performance */}
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ 
              p: 2, 
              bgcolor: hasSelectedDayData || locationStats.combined.avgAgents > 0
                ? ((isSingleDay ? selectedDayMetrics.total.meetingMinPct : (locationStats.combined.avgMeetingMin / locationStats.combined.avgAgents) * 100) >= 80 ? "success.lighter" : "warning.lighter")
                : "grey.100", 
              borderRadius: 2,
              border: "1px solid",
              borderColor: hasSelectedDayData || locationStats.combined.avgAgents > 0
                ? ((isSingleDay ? selectedDayMetrics.total.meetingMinPct : (locationStats.combined.avgMeetingMin / locationStats.combined.avgAgents) * 100) >= 80 ? "success.light" : "warning.light")
                : "grey.300",
            }}>
              <Stack spacing={1}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Person fontSize="small" color={hasSelectedDayData || locationStats.combined.avgAgents > 0 ? "inherit" : "disabled"} />
                  <Typography variant="body2" color="text.secondary">
                    Met 8+ Leads
                  </Typography>
                </Stack>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {isSingleDay && hasSelectedDayData 
                    ? selectedDayMetrics.total.meetingMin 
                    : !isSingleDay && locationStats.combined.avgMeetingMin > 0
                    ? locationStats.combined.avgMeetingMin.toFixed(0)
                    : "-"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {isSingleDay && hasSelectedDayData 
                    ? `${selectedDayMetrics.total.meetingMinPct.toFixed(0)}% of agents`
                    : !isSingleDay && locationStats.combined.avgAgents > 0
                    ? `${((locationStats.combined.avgMeetingMin / locationStats.combined.avgAgents) * 100).toFixed(0)}% avg`
                    : "No data"
                  }
                </Typography>
              </Stack>
            </Box>
          </Grid>

          {/* Average Agents in Range */}
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ 
              p: 2, 
              bgcolor: "grey.100", 
              borderRadius: 2,
              border: "1px solid",
              borderColor: "grey.300",
            }}>
              <Stack spacing={1}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <TrendingUp fontSize="small" />
                  <Typography variant="body2" color="text.secondary">
                    {preset === "mtd" ? "MTD" : "Range"} Average
                  </Typography>
                </Stack>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {locationStats.combined.avgAgents.toFixed(0)}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Chip 
                    label={`ATX: ${locationStats.atx.avgAgents.toFixed(0)}`} 
                    size="small" 
                    variant="outlined"
                  />
                  <Chip 
                    label={`CLT: ${locationStats.clt.avgAgents.toFixed(0)}`} 
                    size="small"
                    variant="outlined"
                  />
                </Stack>
              </Stack>
            </Box>
          </Grid>

          {/* Period Performance */}
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ 
              p: 2, 
              bgcolor: locationStats.combined.avgAgents > 0 
                ? ((locationStats.combined.avgMeetingMin / locationStats.combined.avgAgents) * 100 >= 70 ? "info.lighter" : "warning.lighter")
                : "grey.100",
              borderRadius: 2,
              border: "1px solid",
              borderColor: locationStats.combined.avgAgents > 0
                ? ((locationStats.combined.avgMeetingMin / locationStats.combined.avgAgents) * 100 >= 70 ? "info.light" : "warning.light")
                : "grey.300",
            }}>
              <Stack spacing={1}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CheckCircle fontSize="small" color="info" />
                  <Typography variant="body2" color="text.secondary">
                    {preset === "mtd" ? "MTD" : "Period"} Performance
                  </Typography>
                </Stack>
                <Typography variant="h4" sx={{ fontWeight: 700, color: "info.main" }}>
                  {locationStats.combined.avgAgents > 0 
                    ? ((locationStats.combined.avgMeetingMin / locationStats.combined.avgAgents) * 100).toFixed(0)
                    : 0}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  agents meeting 8+ leads
                </Typography>
              </Stack>
            </Box>
          </Grid>
        </Grid>

        <Divider />

        {/* Location Breakdown */}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
            Location Performance Breakdown
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 2, bgcolor: "grey.50", borderRadius: 1 }}>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <LocationOn fontSize="small" sx={{ color: "primary.main" }} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Austin (ATX)
                    </Typography>
                  </Stack>
                  <Stack spacing={0.5}>
                    <Typography variant="caption">
                      • Avg daily agents: <strong>{locationStats.atx.avgAgents.toFixed(1)}</strong>
                    </Typography>
                    <Typography variant="caption">
                      • Lead attainment: <strong>{locationStats.atx.avgAttainment.toFixed(0)}%</strong>
                    </Typography>
                    <Typography variant="caption">
                      • Days with low staffing: <strong>{locationStats.atx.outages}</strong> ({locationStats.atx.daysWithData > 0 ? ((locationStats.atx.outages / locationStats.atx.daysWithData) * 100).toFixed(0) : 0}%)
                    </Typography>
                  </Stack>
                </Stack>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 2, bgcolor: "grey.50", borderRadius: 1 }}>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <LocationOn fontSize="small" sx={{ color: "secondary.main" }} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Charlotte (CLT)
                    </Typography>
                  </Stack>
                  <Stack spacing={0.5}>
                    <Typography variant="caption">
                      • Avg daily agents: <strong>{locationStats.clt.avgAgents.toFixed(1)}</strong>
                    </Typography>
                    <Typography variant="caption">
                      • Lead attainment: <strong>{locationStats.clt.avgAttainment.toFixed(0)}%</strong>
                    </Typography>
                    <Typography variant="caption">
                      • Days with low staffing: <strong>{locationStats.clt.outages}</strong> ({locationStats.clt.daysWithData > 0 ? ((locationStats.clt.outages / locationStats.clt.daysWithData) * 100).toFixed(0) : 0}%)
                    </Typography>
                  </Stack>
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Box>

        {/* Insights */}
        <Box sx={{ p: 2, bgcolor: "warning.lighter", borderRadius: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Key Insights:
          </Typography>
          <Stack spacing={0.5}>
            {/* Staffing comparison for single day */}
            {isSingleDay && hasSelectedDayData && locationStats.combined.avgAgents > 0 && (
              <Typography 
                variant="caption" 
                color={selectedDayMetrics.total.agents < locationStats.combined.avgAgents * 0.9 ? "error.dark" : "success.dark"}
              >
                • {format(selectedDate, "MMM d")} staffing was {
                  selectedDayMetrics.total.agents < locationStats.combined.avgAgents * 0.9
                    ? `${((1 - selectedDayMetrics.total.agents / locationStats.combined.avgAgents) * 100).toFixed(0)}% below`
                    : selectedDayMetrics.total.agents > locationStats.combined.avgAgents * 1.1
                    ? `${((selectedDayMetrics.total.agents / locationStats.combined.avgAgents - 1) * 100).toFixed(0)}% above`
                    : "on par with"
                } the period average
              </Typography>
            )}
            
            {/* Range statistics */}
            {!isSingleDay && rangeMetrics.length > 0 && (
              <>
                <Typography variant="caption" color="info.dark">
                  • Analyzed {rangeMetrics.length} days with data in selected range
                </Typography>
                {locationStats.combined.daysWithData < dayCount * 0.8 && (
                  <Typography variant="caption" color="warning.dark">
                    • Data missing for {dayCount - locationStats.combined.daysWithData} days in range
                  </Typography>
                )}
              </>
            )}
            
            {/* Performance insights */}
            {locationStats.atx.avgAttainment < 100 && locationStats.atx.daysWithData > 0 && (
              <Typography variant="caption" color="warning.dark">
                • Austin is averaging {(100 - locationStats.atx.avgAttainment).toFixed(0)}% below lead targets {!isSingleDay && "in this period"}
              </Typography>
            )}
            
            {locationStats.clt.avgAttainment < 100 && locationStats.clt.daysWithData > 0 && (
              <Typography variant="caption" color="warning.dark">
                • Charlotte is averaging {(100 - locationStats.clt.avgAttainment).toFixed(0)}% below lead targets {!isSingleDay && "in this period"}
              </Typography>
            )}
            
            {/* Outage warnings */}
            {locationStats.combined.outages > 0 && (
              <Typography variant="caption" color="error.dark">
                • {locationStats.combined.outages} day{locationStats.combined.outages !== 1 ? 's' : ''} in the {preset === "mtd" ? "month" : "period"} had significant staffing shortages
              </Typography>
            )}
            
            {/* Meeting minimum insights */}
            {locationStats.combined.avgAgents > 0 && (
              <Typography 
                variant="caption" 
                color={
                  (locationStats.combined.avgMeetingMin / locationStats.combined.avgAgents) * 100 >= 80 
                    ? "success.dark" 
                    : (locationStats.combined.avgMeetingMin / locationStats.combined.avgAgents) * 100 >= 60
                    ? "warning.dark"
                    : "error.dark"
                }
              >
                • {((locationStats.combined.avgMeetingMin / locationStats.combined.avgAgents) * 100).toFixed(0)}% of agents meeting 8+ lead requirement on average
              </Typography>
            )}
            
            {/* No data warning */}
            {!hasSelectedDayData && rangeMetrics.length === 0 && (
              <Typography variant="caption" color="info.dark">
                • No data available for the selected {isSingleDay ? "date" : "date range"}
              </Typography>
            )}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
};