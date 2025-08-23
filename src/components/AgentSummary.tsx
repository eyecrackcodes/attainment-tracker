import React, { useState, useEffect } from "react";
import {
  Paper,
  Typography,
  Box,
  Grid,
  Stack,
  Skeleton,
  Chip,
} from "@mui/material";
import {
  Groups as GroupsIcon,
  TrendingUp,
  TrendingDown,
  Person,
} from "@mui/icons-material";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { leadService, LeadEntryStored, SiteKey } from "../services/leadService";

interface AgentMetrics {
  date: string;
  atxAgents: number;
  cltAgents: number;
  totalAgents: number;
  atxMeetingMin: number;
  cltMeetingMin: number;
  totalMeetingMin: number;
}

export const AgentSummary: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [todayMetrics, setTodayMetrics] = useState<AgentMetrics | null>(null);
  const [monthMetrics, setMonthMetrics] = useState<{
    avgAgents: number;
    avgMeetingMin: number;
    totalDays: number;
  }>({ avgAgents: 0, avgMeetingMin: 0, totalDays: 0 });

  useEffect(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

    // Subscribe to today's data
    const unsubToday = leadService.subscribeToDate(today, (data) => {
      const atx = data.ATX;
      const clt = data.CLT;
      
      setTodayMetrics({
        date: today,
        atxAgents: atx?.availableAgents || 0,
        cltAgents: clt?.availableAgents || 0,
        totalAgents: (atx?.availableAgents || 0) + (clt?.availableAgents || 0),
        atxMeetingMin: atx?.agentsMeetingMin || 0,
        cltMeetingMin: clt?.agentsMeetingMin || 0,
        totalMeetingMin: (atx?.agentsMeetingMin || 0) + (clt?.agentsMeetingMin || 0),
      });
    });

    // Subscribe to month data
    const unsubMonth = leadService.subscribeToRange(monthStart, monthEnd, (dataMap) => {
      let totalAgents = 0;
      let totalMeetingMin = 0;
      let daysWithData = 0;

      dataMap.forEach((dayData) => {
        const atx = dayData.ATX;
        const clt = dayData.CLT;
        
        if (atx || clt) {
          daysWithData++;
          totalAgents += (atx?.availableAgents || 0) + (clt?.availableAgents || 0);
          totalMeetingMin += (atx?.agentsMeetingMin || 0) + (clt?.agentsMeetingMin || 0);
        }
      });

      setMonthMetrics({
        avgAgents: daysWithData > 0 ? totalAgents / daysWithData : 0,
        avgMeetingMin: daysWithData > 0 ? totalMeetingMin / daysWithData : 0,
        totalDays: daysWithData,
      });
      setLoading(false);
    });

    return () => {
      unsubToday();
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

  const meetingMinPercentage = todayMetrics && todayMetrics.totalAgents > 0
    ? (todayMetrics.totalMeetingMin / todayMetrics.totalAgents) * 100
    : 0;

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
              Agent Performance Summary
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Today's staffing and performance metrics
            </Typography>
          </Box>
        </Stack>

        <Grid container spacing={3}>
          {/* Today's Total Agents */}
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ 
              p: 2, 
              bgcolor: "primary.lighter", 
              borderRadius: 2,
              border: "1px solid",
              borderColor: "primary.light",
            }}>
              <Stack spacing={1}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <GroupsIcon fontSize="small" color="primary" />
                  <Typography variant="body2" color="text.secondary">
                    Available Today
                  </Typography>
                </Stack>
                <Typography variant="h4" sx={{ fontWeight: 700, color: "primary.main" }}>
                  {todayMetrics?.totalAgents || 0}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Chip 
                    label={`ATX: ${todayMetrics?.atxAgents || 0}`} 
                    size="small" 
                    sx={{ bgcolor: "background.paper" }}
                  />
                  <Chip 
                    label={`CLT: ${todayMetrics?.cltAgents || 0}`} 
                    size="small"
                    sx={{ bgcolor: "background.paper" }}
                  />
                </Stack>
              </Stack>
            </Box>
          </Grid>

          {/* Meeting Minimum */}
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ 
              p: 2, 
              bgcolor: meetingMinPercentage >= 80 ? "success.lighter" : "warning.lighter", 
              borderRadius: 2,
              border: "1px solid",
              borderColor: meetingMinPercentage >= 80 ? "success.light" : "warning.light",
            }}>
              <Stack spacing={1}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Person fontSize="small" />
                  <Typography variant="body2" color="text.secondary">
                    Meeting Minimum
                  </Typography>
                </Stack>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {todayMetrics?.totalMeetingMin || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {meetingMinPercentage.toFixed(0)}% of agents
                </Typography>
              </Stack>
            </Box>
          </Grid>

          {/* Month Average */}
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
                  {monthMetrics.avgAgents.toFixed(0)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  agents per day
                </Typography>
              </Stack>
            </Box>
          </Grid>

          {/* Efficiency Score */}
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ 
              p: 2, 
              bgcolor: "info.lighter", 
              borderRadius: 2,
              border: "1px solid",
              borderColor: "info.light",
            }}>
              <Stack spacing={1}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <TrendingUp fontSize="small" color="info" />
                  <Typography variant="body2" color="text.secondary">
                    MTD Performance
                  </Typography>
                </Stack>
                <Typography variant="h4" sx={{ fontWeight: 700, color: "info.main" }}>
                  {monthMetrics.avgAgents > 0 
                    ? ((monthMetrics.avgMeetingMin / monthMetrics.avgAgents) * 100).toFixed(0)
                    : 0}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  meeting minimum
                </Typography>
              </Stack>
            </Box>
          </Grid>
        </Grid>

        {/* Quick Insights */}
        {todayMetrics && (
          <Box sx={{ p: 2, bgcolor: "grey.50", borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Today's Insights:
            </Typography>
            <Stack spacing={0.5}>
              {todayMetrics.totalAgents < monthMetrics.avgAgents * 0.9 && (
                <Typography variant="caption" color="warning.dark">
                  • Staffing is {((1 - todayMetrics.totalAgents / monthMetrics.avgAgents) * 100).toFixed(0)}% below monthly average
                </Typography>
              )}
              {meetingMinPercentage < 70 && (
                <Typography variant="caption" color="error.dark">
                  • Only {meetingMinPercentage.toFixed(0)}% of agents meeting minimum lead requirement
                </Typography>
              )}
              {meetingMinPercentage >= 85 && (
                <Typography variant="caption" color="success.dark">
                  • Excellent performance - {meetingMinPercentage.toFixed(0)}% of agents meeting targets
                </Typography>
              )}
              {todayMetrics.atxAgents === 0 || todayMetrics.cltAgents === 0 && (
                <Typography variant="caption" color="error.dark">
                  • Warning: No agents recorded for {todayMetrics.atxAgents === 0 ? "Austin" : "Charlotte"}
                </Typography>
              )}
            </Stack>
          </Box>
        )}
      </Stack>
    </Paper>
  );
};
