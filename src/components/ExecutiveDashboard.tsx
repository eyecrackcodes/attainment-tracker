import React, { useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  Alert,
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
  icon?: React.ReactNode;
  color?: string;
}> = ({ title, value, subtitle, trend, icon, color = "primary.main" }) => {
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
    <Card
      elevation={0}
      sx={{
        height: "100%",
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            {icon && <Box sx={{ color }}>{icon}</Box>}
            {getTrendIcon()}
          </Stack>

          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              color,
              fontSize: "2rem",
            }}
          >
            {typeof value === "number" ? value.toFixed(1) : value}
            {typeof value === "number" && !title.includes("$") && "%"}
          </Typography>

          <Box>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                color: "text.primary",
                mb: 0.5,
              }}
            >
              {title}
            </Typography>

            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}

            {trend !== undefined && (
              <Typography
                variant="body2"
                sx={{
                  color: getTrendColor(),
                  mt: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                }}
              >
                {trend > 0 ? "+" : ""}
                {trend.toFixed(1)}% trend
              </Typography>
            )}
          </Box>
        </Stack>
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

  return (
    <Chip
      icon={<CheckCircle />}
      label={`${level.toUpperCase()} RISK`}
      color={getColor()}
      size="small"
      sx={{
        fontWeight: 600,
        borderRadius: 1,
      }}
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
        <Typography variant="h5" gutterBottom>
          Executive Dashboard
        </Typography>
        <Alert severity="info">Loading executive insights...</Alert>
      </Box>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
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
        <Typography variant="h5" gutterBottom>
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
      <Stack spacing={3}>
        {/* Header */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Assessment sx={{ fontSize: 28, color: "primary.main" }} />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Executive Dashboard
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Strategic insights and performance analytics
              </Typography>
            </Box>
          </Stack>
          <RiskIndicator
            level={stakeholderInsights.executiveSummary.riskLevel}
          />
        </Stack>

        {/* Main Metrics */}
        <Grid container spacing={4}>
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
              color="primary.main"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Month-End Projection"
              value={stakeholderInsights.executiveSummary.monthlyProjection}
              subtitle={`${stakeholderInsights.performanceForecasting.monthEndProjection.confidence}% confidence`}
              icon={<Timeline />}
              color="success.main"
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
              color="warning.main"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Consistency Score"
              value={businessIntelligence.performanceMetrics.consistencyScore}
              subtitle="Performance stability"
              icon={<Speed />}
              color="info.main"
            />
          </Grid>
        </Grid>

        {/* Strategic Recommendations */}
        <Paper
          elevation={0}
          sx={{
            p: 4,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
          }}
        >
          <Stack spacing={3}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Lightbulb sx={{ color: "primary.main" }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Strategic Recommendations
              </Typography>
            </Stack>

            <Grid container spacing={4}>
              {/* Immediate Actions */}
              <Grid item xs={12} md={4}>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, mb: 1, color: "primary.main" }}
                >
                  Immediate Actions (Today)
                </Typography>
                <Stack spacing={1}>
                  {stakeholderInsights.strategicRecommendations.immediate.map(
                    (action, index) => (
                      <Typography
                        key={index}
                        variant="body2"
                        color="text.secondary"
                      >
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
                  sx={{ fontWeight: 600, mb: 1, color: "primary.main" }}
                >
                  Short-term (This Week)
                </Typography>
                <Stack spacing={1}>
                  {stakeholderInsights.strategicRecommendations.shortTerm.map(
                    (action, index) => (
                      <Typography
                        key={index}
                        variant="body2"
                        color="text.secondary"
                      >
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
                  sx={{ fontWeight: 600, mb: 1, color: "primary.main" }}
                >
                  Long-term (This Month)
                </Typography>
                <Stack spacing={1}>
                  {stakeholderInsights.strategicRecommendations.longTerm.map(
                    (action, index) => (
                      <Typography
                        key={index}
                        variant="body2"
                        color="text.secondary"
                      >
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
