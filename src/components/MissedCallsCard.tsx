import React from "react";
import {
  Card,
  CardContent,
  Typography,
  Box,
  useTheme,
  Stack,
  Chip,
  LinearProgress,
} from "@mui/material";
import {
  PhoneMissed as PhoneMissedIcon,
  TrendingDown as TrendingDownIcon,
  TrendingUp as TrendingUpIcon,
} from "@mui/icons-material";
import { DailyLeadMetrics } from "../types/snowflake";
import { format } from "date-fns";

interface MissedCallsCardProps {
  data: DailyLeadMetrics[];
  timeFrame: string;
}

export const MissedCallsCard: React.FC<MissedCallsCardProps> = ({
  data,
  timeFrame,
}) => {
  const theme = useTheme();

  // Calculate missed calls metrics
  const metrics = React.useMemo(() => {
    if (!data || data.length === 0) {
      return {
        total: 0,
        rate: 0,
        trend: 0,
        byLocation: { ATX: 0, CLT: 0 },
        dailyAvg: 0,
      };
    }

    // Calculate totals
    const totalMissed = data.reduce((sum, d) => sum + (d.missedCalls || 0), 0);
    const totalCalls = data.reduce((sum, d) => sum + d.totalCalls, 0);
    const missedRate = totalCalls > 0 ? (totalMissed / totalCalls) * 100 : 0;

    // Calculate by location
    const atxMissed = data
      .filter((d) => d.site === "ATX")
      .reduce((sum, d) => sum + (d.missedCalls || 0), 0);
    const cltMissed = data
      .filter((d) => d.site === "CLT")
      .reduce((sum, d) => sum + (d.missedCalls || 0), 0);

    // Calculate daily average
    const dailyAvg = data.length > 0 ? totalMissed / data.length : 0;

    // Calculate trend (compare last 7 days to previous 7 days)
    const sortedData = [...data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const midPoint = Math.floor(sortedData.length / 2);
    const firstHalf = sortedData.slice(0, midPoint);
    const secondHalf = sortedData.slice(midPoint);

    const firstHalfAvg =
      firstHalf.reduce((sum, d) => sum + (d.missedCalls || 0), 0) /
      (firstHalf.length || 1);
    const secondHalfAvg =
      secondHalf.reduce((sum, d) => sum + (d.missedCalls || 0), 0) /
      (secondHalf.length || 1);

    const trend =
      firstHalfAvg > 0
        ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100
        : 0;

    return {
      total: totalMissed,
      rate: missedRate,
      trend,
      byLocation: { ATX: atxMissed, CLT: cltMissed },
      dailyAvg,
    };
  }, [data]);

  const getTrendIcon = () => {
    if (metrics.trend > 5) {
      return <TrendingUpIcon sx={{ color: theme.palette.error.main }} />;
    } else if (metrics.trend < -5) {
      return <TrendingDownIcon sx={{ color: theme.palette.success.main }} />;
    }
    return null;
  };

  const getTrendColor = () => {
    if (metrics.trend > 5) return theme.palette.error.main;
    if (metrics.trend < -5) return theme.palette.success.main;
    return theme.palette.text.secondary;
  };

  return (
    <Card
      sx={{
        height: "100%",
        background: `linear-gradient(135deg, ${theme.palette.error.light}10 0%, ${theme.palette.background.paper} 100%)`,
      }}
    >
      <CardContent>
        <Stack spacing={2}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom
              >
                Missed Calls ({timeFrame})
              </Typography>
              <Typography variant="h4" fontWeight="bold">
                {metrics.total.toLocaleString()}
              </Typography>
            </Box>
            <PhoneMissedIcon
              sx={{
                fontSize: 40,
                color: theme.palette.error.main,
                opacity: 0.8,
              }}
            />
          </Box>

          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Miss Rate
              </Typography>
              <Typography
                variant="body2"
                fontWeight="bold"
                color={
                  metrics.rate > 10
                    ? "error.main"
                    : metrics.rate > 5
                    ? "warning.main"
                    : "success.main"
                }
              >
                {metrics.rate.toFixed(1)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(metrics.rate, 100)}
              sx={{
                height: 6,
                borderRadius: 3,
                backgroundColor: theme.palette.grey[200],
                "& .MuiLinearProgress-bar": {
                  backgroundColor:
                    metrics.rate > 10
                      ? theme.palette.error.main
                      : metrics.rate > 5
                      ? theme.palette.warning.main
                      : theme.palette.success.main,
                },
              }}
            />
          </Box>

          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <Chip
              size="small"
              label={`ATX: ${metrics.byLocation.ATX}`}
              sx={{
                backgroundColor: theme.palette.primary.light + "20",
                fontWeight: "medium",
              }}
            />
            <Chip
              size="small"
              label={`CLT: ${metrics.byLocation.CLT}`}
              sx={{
                backgroundColor: theme.palette.secondary.light + "20",
                fontWeight: "medium",
              }}
            />
          </Box>

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              pt: 1,
              borderTop: `1px solid ${theme.palette.divider}`,
            }}
          >
            {getTrendIcon()}
            <Typography variant="body2" color={getTrendColor()}>
              {metrics.trend > 0 ? "+" : ""}
              {metrics.trend.toFixed(1)}% vs previous period
            </Typography>
          </Box>

          <Typography variant="caption" color="text.secondary">
            Daily Average: {metrics.dailyAvg.toFixed(1)} missed calls
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
};
