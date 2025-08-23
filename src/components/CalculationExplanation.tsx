import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Divider,
  Paper,
  Stack,
  Chip,
  IconButton,
} from "@mui/material";
import {
  Info,
  Calculate,
  Psychology,
  TrendingUp,
  Close,
} from "@mui/icons-material";

interface CalculationExplanationProps {
  open: boolean;
  onClose: () => void;
  metric: string;
  value: number;
  details?: {
    formula: string;
    variables: { [key: string]: number | string };
    methodology: string;
    interpretation: string;
  };
}

export const CalculationExplanation: React.FC<CalculationExplanationProps> = ({
  open,
  onClose,
  metric,
  value,
  details,
}) => {
  const getMetricExplanation = () => {
    switch (metric) {
      case "currentPerformance":
        return {
          title: "Current Performance (MTD Attainment)",
          formula: "Current Performance = (MTD Revenue / MTD Target) × 100",
          variables: details?.variables || {},
          methodology: `
            This metric measures your Month-to-Date (MTD) performance against your prorated target.
            
            • MTD Revenue: Total revenue generated from the 1st of the month to today
            • MTD Target: Prorated target based on elapsed business days
            • Business Days: Only weekdays (Mon-Fri) are counted, excluding weekends
            
            The calculation automatically adjusts for:
            - Number of business days elapsed vs. total in the month
            - Custom working day configurations if set
            - Location-specific targets and performance
          `,
          interpretation: `
            • > 100%: Ahead of target (green)
            • 95-100%: On track (yellow)
            • < 95%: Behind target (red)
            
            This metric updates daily and provides real-time visibility into performance.
          `,
          scientificBasis: `
            Based on Key Performance Indicator (KPI) theory and balanced scorecard methodology.
            The prorated approach ensures fair comparison regardless of the day of the month.
          `,
        };

      case "monthEndProjection":
        return {
          title: "Month-End Projection",
          formula:
            "Projection = Current Revenue + (Weighted Daily Average × Trend Multiplier × Remaining Days)",
          variables: details?.variables || {},
          methodology: `
            This projection uses a weighted moving average with trend analysis:
            
            1. Weighted Daily Average:
               • 70% weight on last 5 business days (recent performance)
               • 30% weight on full month history (baseline performance)
               
            2. Trend Multiplier:
               • Calculated from 10-day performance velocity
               • Capped at ±10% to prevent unrealistic projections
               • Formula: 1 + (capped_trend_velocity / 100)
               
            3. Remaining Business Days:
               • Calculated based on your working day configuration
               • Excludes weekends and any custom non-working days
          `,
          interpretation: `
            The projection becomes more accurate as the month progresses.
            Early in the month, rely more on historical patterns.
            Late in the month, the projection is highly reliable.
          `,
          scientificBasis: `
            Uses exponentially weighted moving average (EWMA) principles and 
            time-series forecasting with trend dampening to prevent overfitting.
          `,
        };

      case "confidence":
        return {
          title: "Confidence Score",
          formula:
            "Confidence = Base Score - Days Penalty + Stability Bonus + Accuracy Bonus",
          variables: details?.variables || {},
          methodology: `
            Confidence is calculated using three key factors:
            
            1. Base Confidence (100%):
               • Reduced by up to 30% based on days remaining
               • Formula: 100 - (remaining_days / total_days × 30)
               
            2. Performance Stability (0-30% bonus):
               • Measures day-to-day consistency
               • Low variance = higher confidence
               • Based on coefficient of variation
               
            3. Historical Accuracy (0-40% bonus):
               • Tracks how accurate past projections were
               • Self-learning system that improves over time
               • Based on mean absolute percentage error (MAPE)
               
            Final score is capped between 30% and 95% for realism.
          `,
          interpretation: `
            • 80-95%: High confidence - projections are reliable
            • 60-80%: Moderate confidence - monitor closely
            • 30-60%: Low confidence - high uncertainty
          `,
          scientificBasis: `
            Based on statistical confidence intervals and prediction interval theory.
            Incorporates machine learning concepts of model confidence scoring.
          `,
        };

      case "riskLevel":
        return {
          title: "Risk Level Assessment",
          formula: "Risk = f(Performance, Projection, Stability, Confidence)",
          variables: details?.variables || {},
          methodology: `
            Risk is determined by a multi-factor scoring system:
            
            LOW RISK requires ALL of:
            • Current performance ≥ 95%
            • Projected performance ≥ 100%
            • Stability score ≥ 70%
            • Confidence ≥ 80%
            
            MEDIUM RISK requires ALL of:
            • Current performance ≥ 85%
            • Projected performance ≥ 90%
            • Stability score ≥ 50%
            • Confidence ≥ 60%
            
            HIGH RISK: Anything below medium thresholds
          `,
          interpretation: `
            • Low Risk: On track, maintain current approach
            • Medium Risk: Attention needed, tactical adjustments recommended
            • High Risk: Immediate action required, strategic intervention needed
          `,
          scientificBasis: `
            Based on risk management frameworks including:
            - Value at Risk (VaR) principles
            - Monte Carlo simulation concepts
            - Multi-criteria decision analysis (MCDA)
          `,
        };

      case "consistencyScore":
        return {
          title: "Performance Consistency",
          formula: "Consistency = (1 - Coefficient of Variation) × 100",
          variables: details?.variables || {},
          methodology: `
            Measures how stable your daily performance is:
            
            1. Calculate daily revenue variations
            2. Compute standard deviation of daily revenues
            3. Divide by mean daily revenue (Coefficient of Variation)
            4. Invert and scale to 0-100%
            
            Lower variation = Higher consistency = Better predictability
          `,
          interpretation: `
            • 80-100%: Very consistent - reliable performance
            • 60-80%: Moderately consistent - some variability
            • < 60%: Inconsistent - high variability, harder to predict
          `,
          scientificBasis: `
            Based on statistical process control (SPC) and Six Sigma principles.
            Lower variation indicates a more controlled, predictable process.
          `,
        };

      default:
        return {
          title: metric,
          formula: "Custom calculation",
          variables: details?.variables || {},
          methodology: "Calculation methodology varies by metric.",
          interpretation: "Please refer to documentation for details.",
          scientificBasis: "Based on industry best practices.",
        };
    }
  };

  const explanation = getMetricExplanation();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <Calculate color="primary" />
            <Typography variant="h6">{explanation.title}</Typography>
          </Stack>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* Current Value */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              bgcolor: "primary.50",
              border: "1px solid",
              borderColor: "primary.200",
            }}
          >
            <Typography variant="h4" color="primary.main" gutterBottom>
              {typeof value === "number" ? `${value.toFixed(1)}%` : value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Current Value
            </Typography>
          </Paper>

          {/* Formula */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <Calculate fontSize="small" color="action" />
              <Typography variant="subtitle1" fontWeight={600}>
                Formula
              </Typography>
            </Stack>
            <Paper
              elevation={0}
              sx={{ p: 2, bgcolor: "grey.50", fontFamily: "monospace" }}
            >
              <Typography variant="body1" sx={{ fontFamily: "monospace" }}>
                {explanation.formula}
              </Typography>
            </Paper>
          </Box>

          {/* Variables */}
          {Object.keys(explanation.variables).length > 0 && (
            <Box>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Current Values
              </Typography>
              <Stack spacing={1}>
                {Object.entries(explanation.variables).map(([key, value]) => (
                  <Box
                    key={key}
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Typography variant="body2" color="text.secondary">
                      {key}:
                    </Typography>
                    <Chip
                      label={
                        typeof value === "number" ? value.toFixed(2) : value
                      }
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          <Divider />

          {/* Methodology */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <Psychology fontSize="small" color="action" />
              <Typography variant="subtitle1" fontWeight={600}>
                Methodology
              </Typography>
            </Stack>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ whiteSpace: "pre-line" }}
            >
              {explanation.methodology.trim()}
            </Typography>
          </Box>

          {/* Interpretation */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <TrendingUp fontSize="small" color="action" />
              <Typography variant="subtitle1" fontWeight={600}>
                How to Interpret
              </Typography>
            </Stack>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ whiteSpace: "pre-line" }}
            >
              {explanation.interpretation.trim()}
            </Typography>
          </Box>

          {/* Scientific Basis */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <Info fontSize="small" color="action" />
              <Typography variant="subtitle1" fontWeight={600}>
                Scientific Basis
              </Typography>
            </Stack>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                bgcolor: "info.50",
                border: "1px solid",
                borderColor: "info.200",
              }}
            >
              <Typography variant="body2" color="info.dark">
                {explanation.scientificBasis.trim()}
              </Typography>
            </Paper>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
