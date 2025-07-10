import React, { useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  Alert,
  LinearProgress,
  Card,
  CardContent,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  TrendingUp,
  TrendingDown,
  Warning,
  CheckCircle,
  Assessment,
  TrendingFlat,
  AccountBalance,
  Speed,
  Timeline,
  Lightbulb,
} from "@mui/icons-material";
import { RevenueData, TargetSettings } from "../types/revenue";
import {
  calculateStakeholderInsights,
  calculateBusinessIntelligence,
} from "../utils/calculations";
import { formatCurrency } from "../utils/formatters";

interface ExecutiveDashboardProps {
  data: RevenueData[];
  targetSettings: TargetSettings;
  isLoading?: boolean;
}

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  icon: React.ReactNode;
  color?: "primary" | "success" | "warning" | "error";
  progress?: number;
}> = ({ title, value, subtitle, trend, icon, color = "primary", progress }) => {
  const getTrendIcon = () => {
    if (trend === undefined) return null;
    if (trend > 2) return <TrendingUp color="success" fontSize="small" />;
    if (trend < -2) return <TrendingDown color="error" fontSize="small" />;
    return <TrendingFlat color="action" fontSize="small" />;
  };

  const getTrendColor = () => {
    if (trend === undefined) return "text.secondary";
    if (trend > 2) return "success.main";
    if (trend < -2) return "error.main";
    return "text.secondary";
  };

  return (
    <Card elevation={3} sx={{ height: "100%" }}>
      <CardContent sx={{ p: 3 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <Box sx={{ color: `${color}.main` }}>{icon}</Box>
          {getTrendIcon()}
        </Stack>

        <Typography
          variant="h4"
          sx={{ fontWeight: 700, color: `${color}.main`, mb: 1 }}
        >
          {typeof value === "number" ? value.toFixed(1) : value}
        </Typography>

        <Typography
          variant="h6"
          color="text.primary"
          sx={{ fontWeight: 600, mb: 1 }}
        >
          {title}
        </Typography>

        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}

        {trend !== undefined && (
          <Typography variant="body2" sx={{ color: getTrendColor(), mt: 1 }}>
            {trend > 0 ? "+" : ""}
            {trend.toFixed(1)}% trend
          </Typography>
        )}

        {progress !== undefined && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, Math.max(0, progress))}
              sx={{ height: 6, borderRadius: 3 }}
              color={color}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

const RiskIndicator: React.FC<{ level: "low" | "medium" | "high" }> = ({
  level,
}) => {
  const getColor = () => {
    switch (level) {
      case "low":
        return "success";
      case "medium":
        return "warning";
      case "high":
        return "error";
    }
  };

  const getIcon = () => {
    switch (level) {
      case "low":
        return <CheckCircle />;
      case "medium":
        return <Warning />;
      case "high":
        return <Warning />;
    }
  };

  return (
    <Chip
      icon={getIcon()}
      label={`${level.toUpperCase()} RISK`}
      color={getColor()}
      variant="filled"
      sx={{ fontWeight: 600 }}
    />
  );
};

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  data,
  targetSettings,
  isLoading = false,
}) => {
  const { stakeholderInsights, businessIntelligence } = useMemo(() => {
    if (!data || data.length === 0 || !targetSettings) {
      return { stakeholderInsights: null, businessIntelligence: null };
    }

    try {
      return {
        stakeholderInsights: calculateStakeholderInsights(data, targetSettings),
        businessIntelligence: calculateBusinessIntelligence(
          data,
          targetSettings
        ),
      };
    } catch (error) {
      console.error("Error calculating insights:", error);
      return { stakeholderInsights: null, businessIntelligence: null };
    }
  }, [data, targetSettings]);

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Executive Dashboard
        </Typography>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading executive insights...</Typography>
      </Box>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Executive Dashboard
        </Typography>
        <Alert severity="info">
          No data available. Please enter some revenue data to see insights.
        </Alert>
      </Box>
    );
  }

  if (!stakeholderInsights || !businessIntelligence) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Executive Dashboard
        </Typography>
        <Alert severity="error">
          Error calculating insights. Please check the console for details.
        </Alert>
      </Box>
    );
  }

  const {
    executiveSummary,
    performanceForecasting,
    riskAnalysis,
    strategicRecommendations,
  } = stakeholderInsights;
  const { performanceMetrics, locationAnalysis } = businessIntelligence;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 4 }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{ fontWeight: 700, color: "text.primary" }}
          >
            Executive Dashboard
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Strategic insights and performance analytics
          </Typography>
        </Box>
        <RiskIndicator level={executiveSummary.riskLevel} />
      </Stack>

      {/* Executive Summary Alert */}
      {executiveSummary.actionRequired && (
        <Alert
          severity={executiveSummary.riskLevel === "high" ? "error" : "warning"}
          sx={{ mb: 3, fontSize: "1.1rem" }}
          icon={<Assessment />}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {executiveSummary.keyInsight}
          </Typography>
        </Alert>
      )}

      {/* Key Performance Metrics */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ mb: 4 }}>
        <Box sx={{ flex: 1 }}>
          <MetricCard
            title="Current Performance"
            value={`${executiveSummary.currentPerformance.toFixed(1)}%`}
            subtitle="Monthly attainment"
            trend={performanceForecasting.trendAnalysis.velocity}
            icon={<Speed />}
            color={
              executiveSummary.currentPerformance >= 100
                ? "success"
                : executiveSummary.currentPerformance >= 90
                ? "warning"
                : "error"
            }
            progress={executiveSummary.currentPerformance}
          />
        </Box>

        <Box sx={{ flex: 1 }}>
          <MetricCard
            title="Month-End Projection"
            value={`${executiveSummary.monthlyProjection.toFixed(1)}%`}
            subtitle={`${performanceForecasting.monthEndProjection.confidence.toFixed(
              0
            )}% confidence`}
            icon={<Timeline />}
            color={
              executiveSummary.monthlyProjection >= 100 ? "success" : "warning"
            }
            progress={executiveSummary.monthlyProjection}
          />
        </Box>

        <Box sx={{ flex: 1 }}>
          <MetricCard
            title="Revenue at Risk"
            value={formatCurrency(riskAnalysis.revenueAtRisk)}
            subtitle={`${riskAnalysis.daysToRecovery} days to recover`}
            icon={<AccountBalance />}
            color={
              riskAnalysis.revenueAtRisk > 50000
                ? "error"
                : riskAnalysis.revenueAtRisk > 20000
                ? "warning"
                : "success"
            }
          />
        </Box>

        <Box sx={{ flex: 1 }}>
          <MetricCard
            title="Consistency Score"
            value={`${performanceMetrics.consistencyScore.toFixed(1)}%`}
            subtitle="Performance stability"
            icon={<Assessment />}
            color={
              performanceMetrics.consistencyScore >= 80
                ? "success"
                : performanceMetrics.consistencyScore >= 60
                ? "warning"
                : "error"
            }
            progress={performanceMetrics.consistencyScore}
          />
        </Box>
      </Stack>

      {/* Strategic Recommendations */}
      <Paper elevation={3} sx={{ p: 4, mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
          <Lightbulb color="primary" />
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Strategic Recommendations
          </Typography>
        </Stack>

        <Grid container spacing={3}>
          <Grid xs={12} md={4}>
            <Box
              sx={{
                p: 3,
                bgcolor: "error.light",
                borderRadius: 2,
                color: "error.contrastText",
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Immediate Actions (Today)
              </Typography>
              <Stack spacing={1}>
                {strategicRecommendations.immediate.map((action, index) => (
                  <Typography key={index} variant="body2">
                    • {action}
                  </Typography>
                ))}
              </Stack>
            </Box>
          </Grid>

          <Grid xs={12} md={4}>
            <Box
              sx={{
                p: 3,
                bgcolor: "warning.light",
                borderRadius: 2,
                color: "warning.contrastText",
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Short-term (This Week)
              </Typography>
              <Stack spacing={1}>
                {strategicRecommendations.shortTerm.map((action, index) => (
                  <Typography key={index} variant="body2">
                    • {action}
                  </Typography>
                ))}
              </Stack>
            </Box>
          </Grid>

          <Grid xs={12} md={4}>
            <Box
              sx={{
                p: 3,
                bgcolor: "info.light",
                borderRadius: 2,
                color: "info.contrastText",
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Long-term (This Month)
              </Typography>
              <Stack spacing={1}>
                {strategicRecommendations.longTerm.map((action, index) => (
                  <Typography key={index} variant="body2">
                    • {action}
                  </Typography>
                ))}
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Resource Allocation Recommendations */}
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
          Resource Allocation Strategy
        </Typography>

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {strategicRecommendations.resourceAllocation.reasoning}
          </Typography>
        </Alert>

        <Grid container spacing={3}>
          <Grid xs={12} md={6}>
            <Box
              sx={{
                p: 3,
                border: "2px solid",
                borderColor: "primary.main",
                borderRadius: 2,
              }}
            >
              <Typography variant="h6" color="primary" gutterBottom>
                Austin Resource Allocation
              </Typography>
              <Chip
                label={strategicRecommendations.resourceAllocation.austin.toUpperCase()}
                color={
                  strategicRecommendations.resourceAllocation.austin ===
                  "increase"
                    ? "success"
                    : strategicRecommendations.resourceAllocation.austin ===
                      "decrease"
                    ? "error"
                    : "primary"
                }
                size="large"
                sx={{ fontWeight: 600 }}
              />
            </Box>
          </Grid>

          <Grid xs={12} md={6}>
            <Box
              sx={{
                p: 3,
                border: "2px solid",
                borderColor: "secondary.main",
                borderRadius: 2,
              }}
            >
              <Typography variant="h6" color="secondary" gutterBottom>
                Charlotte Resource Allocation
              </Typography>
              <Chip
                label={strategicRecommendations.resourceAllocation.charlotte.toUpperCase()}
                color={
                  strategicRecommendations.resourceAllocation.charlotte ===
                  "increase"
                    ? "success"
                    : strategicRecommendations.resourceAllocation.charlotte ===
                      "decrease"
                    ? "error"
                    : "primary"
                }
                size="large"
                sx={{ fontWeight: 600 }}
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};
