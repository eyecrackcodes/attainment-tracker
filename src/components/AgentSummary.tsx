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
} from "@mui/icons-material";
import { format, subDays, startOfMonth, endOfMonth, isWeekend } from "date-fns";
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

export const AgentSummary: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [yesterdayMetrics, setYesterdayMetrics] = useState<DailyMetrics | null>(null);
  const [locationStats, setLocationStats] = useState<{
    atx: LocationStats;
    clt: LocationStats;
    combined: LocationStats;
  }>({
    atx: { avgAgents: 0, avgMeetingMin: 0, avgAttainment: 0, daysWithData: 0, outages: 0 },
    clt: { avgAgents: 0, avgMeetingMin: 0, avgAttainment: 0, daysWithData: 0, outages: 0 },
    combined: { avgAgents: 0, avgMeetingMin: 0, avgAttainment: 0, daysWithData: 0, outages: 0 },
  });

  useEffect(() => {
    // Get yesterday's date (since data is from previous day)
    const yesterday = subDays(new Date(), 1);
    const yesterdayStr = format(yesterday, "yyyy-MM-dd");
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

    // Subscribe to yesterday's data
    const unsubYesterday = leadService.subscribeToDate(yesterdayStr, (data) => {
      const atx = data.ATX;
      const clt = data.CLT;
      
      setYesterdayMetrics({
        date: yesterdayStr,
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
          agents: (atx?.availableAgents || 0) + (clt?.availableAgents || 0),
          meetingMin: (atx?.agentsMeetingMin || 0) + (clt?.agentsMeetingMin || 0),
          meetingMinPct: 0, // Will be calculated below
        },
      });
      
      // Calculate meeting min percentage
      const totalAgents = (atx?.availableAgents || 0) + (clt?.availableAgents || 0);
      const totalMeetingMin = (atx?.agentsMeetingMin || 0) + (clt?.agentsMeetingMin || 0);
      if (totalAgents > 0) {
        setYesterdayMetrics((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            total: {
              ...prev.total,
              meetingMinPct: (totalMeetingMin / totalAgents) * 100,
            },
          };
        });
      }
    });

    // Subscribe to month data for statistics
    const unsubMonth = leadService.subscribeToRange(monthStart, monthEnd, (dataMap) => {
      // Initialize stats
      const stats = {
        atx: { totalAgents: 0, totalMeetingMin: 0, totalAttainment: 0, daysWithData: 0, agentsByDay: [] as number[] },
        clt: { totalAgents: 0, totalMeetingMin: 0, totalAttainment: 0, daysWithData: 0, agentsByDay: [] as number[] },
      };

      // Process each day
      dataMap.forEach((dayData, date) => {
        // Skip weekends for business metrics
        if (isWeekend(new Date(date))) return;

        const atx = dayData.ATX;
        const clt = dayData.CLT;
        
        // ATX stats
        if (atx && atx.availableAgents > 0) {
          stats.atx.daysWithData++;
          stats.atx.totalAgents += atx.availableAgents;
          stats.atx.totalMeetingMin += atx.agentsMeetingMin || 0;
          stats.atx.totalAttainment += atx.derived?.attainmentPct || 0;
          stats.atx.agentsByDay.push(atx.availableAgents);
        }
        
        // CLT stats
        if (clt && clt.availableAgents > 0) {
          stats.clt.daysWithData++;
          stats.clt.totalAgents += clt.availableAgents;
          stats.clt.totalMeetingMin += clt.agentsMeetingMin || 0;
          stats.clt.totalAttainment += clt.derived?.attainmentPct || 0;
          stats.clt.agentsByDay.push(clt.availableAgents);
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
      unsubYesterday();
      unsubMonth();
    };
  }, []);

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

  const hasYesterdayData = yesterdayMetrics && yesterdayMetrics.total.agents > 0;
  const yesterdayDate = subDays(new Date(), 1);
  const isYesterdayWeekend = isWeekend(yesterdayDate);

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
        <Stack direction="row" alignItems="center" spacing={2}>
          <GroupsIcon sx={{ fontSize: 28, color: "primary.main" }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Agent Performance Insights
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {format(yesterdayDate, "MMMM d, yyyy")} performance and MTD trends
            </Typography>
          </Box>
        </Stack>

        <Grid container spacing={3}>
          {/* Yesterday's Performance */}
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ 
              p: 2, 
              bgcolor: hasYesterdayData ? "primary.lighter" : "grey.100", 
              borderRadius: 2,
              border: "1px solid",
              borderColor: hasYesterdayData ? "primary.light" : "grey.300",
            }}>
              <Stack spacing={1}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Assessment fontSize="small" color={hasYesterdayData ? "primary" : "disabled"} />
                  <Typography variant="body2" color="text.secondary">
                    Yesterday's Total
                  </Typography>
                </Stack>
                <Typography variant="h4" sx={{ fontWeight: 700, color: hasYesterdayData ? "primary.main" : "text.disabled" }}>
                  {hasYesterdayData ? yesterdayMetrics.total.agents : "-"}
                </Typography>
                <Stack direction="row" spacing={1}>
                  {hasYesterdayData ? (
                    <>
                      <Chip 
                        label={`ATX: ${yesterdayMetrics.atx.agents}`} 
                        size="small" 
                        sx={{ bgcolor: "background.paper" }}
                      />
                      <Chip 
                        label={`CLT: ${yesterdayMetrics.clt.agents}`} 
                        size="small"
                        sx={{ bgcolor: "background.paper" }}
                      />
                    </>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      {isYesterdayWeekend ? "Weekend - No data" : "No data entered"}
                    </Typography>
                  )}
                </Stack>
              </Stack>
            </Box>
          </Grid>

          {/* Yesterday's Meeting Minimum */}
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ 
              p: 2, 
              bgcolor: hasYesterdayData 
                ? (yesterdayMetrics.total.meetingMinPct >= 80 ? "success.lighter" : "warning.lighter")
                : "grey.100", 
              borderRadius: 2,
              border: "1px solid",
              borderColor: hasYesterdayData 
                ? (yesterdayMetrics.total.meetingMinPct >= 80 ? "success.light" : "warning.light")
                : "grey.300",
            }}>
              <Stack spacing={1}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Person fontSize="small" color={hasYesterdayData ? "inherit" : "disabled"} />
                  <Typography variant="body2" color="text.secondary">
                    Met 8+ Leads
                  </Typography>
                </Stack>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {hasYesterdayData ? yesterdayMetrics.total.meetingMin : "-"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {hasYesterdayData 
                    ? `${yesterdayMetrics.total.meetingMinPct.toFixed(0)}% of agents`
                    : "No data"
                  }
                </Typography>
              </Stack>
            </Box>
          </Grid>

          {/* MTD Average Agents */}
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
                    MTD Average
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

          {/* MTD Performance */}
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
                    MTD Performance
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
            {/* Staffing comparison */}
            {hasYesterdayData && locationStats.combined.avgAgents > 0 && (
              <Typography 
                variant="caption" 
                color={yesterdayMetrics.total.agents < locationStats.combined.avgAgents * 0.9 ? "error.dark" : "success.dark"}
              >
                • Yesterday's staffing was {
                  yesterdayMetrics.total.agents < locationStats.combined.avgAgents * 0.9
                    ? `${((1 - yesterdayMetrics.total.agents / locationStats.combined.avgAgents) * 100).toFixed(0)}% below`
                    : yesterdayMetrics.total.agents > locationStats.combined.avgAgents * 1.1
                    ? `${((yesterdayMetrics.total.agents / locationStats.combined.avgAgents - 1) * 100).toFixed(0)}% above`
                    : "on par with"
                } the MTD average
              </Typography>
            )}
            
            {/* Performance insights */}
            {locationStats.atx.avgAttainment < 100 && locationStats.atx.daysWithData > 0 && (
              <Typography variant="caption" color="warning.dark">
                • Austin is averaging {(100 - locationStats.atx.avgAttainment).toFixed(0)}% below lead targets
              </Typography>
            )}
            
            {locationStats.clt.avgAttainment < 100 && locationStats.clt.daysWithData > 0 && (
              <Typography variant="caption" color="warning.dark">
                • Charlotte is averaging {(100 - locationStats.clt.avgAttainment).toFixed(0)}% below lead targets
              </Typography>
            )}
            
            {/* Outage warnings */}
            {locationStats.combined.outages > 2 && (
              <Typography variant="caption" color="error.dark">
                • {locationStats.combined.outages} days this month had significant staffing shortages
              </Typography>
            )}
            
            {/* No data warning */}
            {!hasYesterdayData && !isYesterdayWeekend && (
              <Typography variant="caption" color="info.dark">
                • Yesterday's data has not been entered yet
              </Typography>
            )}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
};