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
      <Box sx={{ p: 4 }}>
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
      <Box sx={{ p: 4 }}>
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
      <Box sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Executive Dashboard
        </Typography>
        <Alert severity="error">
          Error calculating insights. Please try again or contact support.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      <Stack spacing={4}>
        {/* Header */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={2}
        >
          <Stack direction="row" alignItems="center" spacing={2}>
            <Assessment sx={{ fontSize: 32, color: "primary.main" }} />
            <Stack>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                Executive Dashboard
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Strategic insights and performance analytics
              </Typography>
            </Stack>
          </Stack>
          <RiskIndicator
            level={stakeholderInsights.executiveSummary.riskLevel}
          />
        </Stack>

        {/* Main Metrics */}
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Current Performance"
              value={stakeholderInsights.executiveSummary.currentPerformance}
              subtitle="Monthly attainment"
              trend={
                stakeholderInsights.performanceForecasting.trendAnalysis
                  .velocity
              }
              icon={<Speed />}
              color="primary"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Month-End Projection"
              value={stakeholderInsights.executiveSummary.monthlyProjection}
              subtitle={`${stakeholderInsights.performanceForecasting.monthEndProjection.confidence}% confidence`}
              icon={<Timeline />}
              color="success"
              progress={
                stakeholderInsights.performanceForecasting.monthEndProjection
                  .confidence
              }
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Revenue at Risk"
              value={formatCurrency(
                stakeholderInsights.riskAnalysis.revenueAtRisk
              )}
              subtitle={`${stakeholderInsights.riskAnalysis.daysToRecovery} days to recover`}
              icon={<AccountBalance />}
              color="warning"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Consistency Score"
              value={businessIntelligence.performanceMetrics.consistencyScore}
              subtitle="Performance stability"
              icon={<Speed />}
              color="info"
              progress={
                businessIntelligence.performanceMetrics.consistencyScore
              }
            />
          </Grid>
        </Grid>

        {/* Strategic Recommendations */}
        <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Lightbulb color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Strategic Recommendations
              </Typography>
            </Stack>

            <Grid container spacing={3}>
              {/* Immediate Actions */}
              <Grid item xs={12} md={4}>
                <Typography
                  variant="subtitle1"
                  color="primary"
                  sx={{ fontWeight: 600, mb: 1 }}
                >
                  Immediate Actions (Today)
                </Typography>
                <Stack spacing={1}>
                  {stakeholderInsights.strategicRecommendations.immediate.map(
                    (action, index) => (
                      <Typography key={index} variant="body2">
                        • {action}
                      </Typography>
                    )
                  )}
                </Stack>
              </Grid>

              {/* Short-term Actions */}
              <Grid item xs={12} md={4}>
                <Typography
                  variant="subtitle1"
                  color="primary"
                  sx={{ fontWeight: 600, mb: 1 }}
                >
                  Short-term (This Week)
                </Typography>
                <Stack spacing={1}>
                  {stakeholderInsights.strategicRecommendations.shortTerm.map(
                    (action, index) => (
                      <Typography key={index} variant="body2">
                        • {action}
                      </Typography>
                    )
                  )}
                </Stack>
              </Grid>

              {/* Long-term Actions */}
              <Grid item xs={12} md={4}>
                <Typography
                  variant="subtitle1"
                  color="primary"
                  sx={{ fontWeight: 600, mb: 1 }}
                >
                  Long-term (This Month)
                </Typography>
                <Stack spacing={1}>
                  {stakeholderInsights.strategicRecommendations.longTerm.map(
                    (action, index) => (
                      <Typography key={index} variant="body2">
                        • {action}
                      </Typography>
                    )
                  )}
                </Stack>
              </Grid>
            </Grid>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
};
