import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  Divider,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  TrendingUp,
  TrendingDown,
  Groups,
  Assignment,
  CheckCircle,
  Warning,
  LocationOn,
  AddCircleOutline,
  Info as InfoIcon,
} from "@mui/icons-material";
import { format } from "date-fns";
import { leadService, LeadEntryStored, SiteKey } from "../services/leadService";

interface LeadAttainmentSummaryProps {
  date?: Date;
  showCombined?: boolean;
}

interface SiteMetrics {
  site: SiteKey;
  data: LeadEntryStored | null;
}

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: string;
  trend?: "up" | "down" | "neutral";
}> = ({ title, value, subtitle, icon, color = "primary.main", trend }) => {
  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend === "up") return <TrendingUp color="success" fontSize="small" />;
    if (trend === "down")
      return <TrendingDown color="error" fontSize="small" />;
    return null;
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
        transition: "all 0.2s",
        "&:hover": {
          borderColor: "primary.main",
          transform: "translateY(-2px)",
          boxShadow: 1,
        },
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Stack spacing={1}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            {icon && <Box sx={{ color, opacity: 0.8 }}>{icon}</Box>}
            {getTrendIcon()}
          </Stack>
          <Box>
            <Typography
              variant="body2"
              color="text.secondary"
              gutterBottom
              sx={{ fontWeight: 500 }}
            >
              {title}
            </Typography>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                color,
                letterSpacing: "-0.02em",
              }}
            >
              {value}
            </Typography>
            {subtitle && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

export const LeadAttainmentSummary: React.FC<LeadAttainmentSummaryProps> = ({
  date = new Date(),
  showCombined = true,
}) => {
  const [loading, setLoading] = useState(true);
  const [siteData, setSiteData] = useState<
    Record<SiteKey, LeadEntryStored | null>
  >({
    ATX: null,
    CLT: null,
  });

  const dateISO = format(date, "yyyy-MM-dd");

  useEffect(() => {
    setLoading(true);
    const unsubscribe = leadService.subscribeToDate(dateISO, (data) => {
      setSiteData(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [dateISO]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const hasData = siteData.ATX || siteData.CLT;

  if (!hasData) {
    return (
      <Alert severity="info" sx={{ mb: 3 }}>
        No lead attainment data available for {format(date, "MMMM d, yyyy")}.
        Please enter data using the form above.
      </Alert>
    );
  }

  // Calculate combined metrics
  const combinedMetrics = {
    availableAgents:
      (siteData.ATX?.availableAgents || 0) +
      (siteData.CLT?.availableAgents || 0),
    totalBillableLeads:
      (siteData.ATX?.totalBillableLeads || 0) +
      (siteData.CLT?.totalBillableLeads || 0),
    targetLeads:
      (siteData.ATX?.derived.targetLeads || 0) +
      (siteData.CLT?.derived.targetLeads || 0),
    agentsMeetingMin:
      (siteData.ATX?.agentsMeetingMin || 0) +
      (siteData.CLT?.agentsMeetingMin || 0),
    openOrderZeroLeads:
      (siteData.ATX?.openOrderZeroLeads || 0) +
      (siteData.CLT?.openOrderZeroLeads || 0),
  };

  const combinedAttainment =
    combinedMetrics.targetLeads > 0
      ? (combinedMetrics.totalBillableLeads / combinedMetrics.targetLeads) * 100
      : 0;

  const combinedPctAgentsMeetingMin =
    combinedMetrics.availableAgents > 0
      ? (combinedMetrics.agentsMeetingMin / combinedMetrics.availableAgents) *
        100
      : 0;

  const getAttainmentStatus = (pct: number) => {
    if (pct >= 100) return { color: "success.main", icon: <CheckCircle /> };
    if (pct >= 80) return { color: "warning.main", icon: <Warning /> };
    return { color: "error.main", icon: <Warning /> };
  };

  const renderSiteMetrics = (site: SiteKey, data: LeadEntryStored | null) => {
    if (!data) return null;

    const attainmentPct = data.derived.attainmentPct * 100;
    const status = getAttainmentStatus(attainmentPct);

    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
        }}
      >
        <Stack spacing={3}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <LocationOn sx={{ color: "primary.main" }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {site === "ATX" ? "Austin" : "Charlotte"}
            </Typography>
            <Chip
              label={`${attainmentPct.toFixed(1)}%`}
              color={
                attainmentPct >= 100
                  ? "success"
                  : attainmentPct >= 80
                  ? "warning"
                  : "error"
              }
              size="small"
              icon={status.icon}
            />
          </Stack>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                md: "repeat(3, 1fr)",
              },
              gap: 2,
            }}
          >
            <MetricCard
              title="Available Agents"
              value={data.availableAgents}
              icon={<Groups />}
              color="info.main"
            />
            <MetricCard
              title="Billable Leads"
              value={data.totalBillableLeads}
              subtitle={`Target: ${data.derived.targetLeads}`}
              icon={<Assignment />}
              color="primary.main"
            />
            <MetricCard
              title="Lead Attainment"
              value={`${attainmentPct.toFixed(1)}%`}
              icon={status.icon}
              color={status.color}
              trend={attainmentPct >= 100 ? "up" : "down"}
            />
            {data.agentsMeetingMin !== undefined && (
              <MetricCard
                title="Agents Meeting Min"
                value={data.agentsMeetingMin}
                subtitle={`${(data.derived.pctAgentsMeetingMin! * 100).toFixed(
                  1
                )}% of agents`}
                color="secondary.main"
              />
            )}
            {data.openOrderZeroLeads !== undefined && (
              <MetricCard
                title="Absent Agents"
                value={data.openOrderZeroLeads}
                color="warning.main"
              />
            )}
          </Box>

          {data.notes && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Notes:</strong> {data.notes}
              </Typography>
            </Box>
          )}
        </Stack>
      </Paper>
    );
  };

  return (
    <Stack spacing={3}>
      <Typography
        variant="h5"
        sx={{ fontWeight: 600, color: "text.primary", mb: 1 }}
      >
        Lead Attainment Summary
      </Typography>

      {showCombined && hasData && (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
          }}
        >
          <Stack spacing={3}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Groups sx={{ color: "primary.main", fontSize: 28 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Combined Performance
              </Typography>
              <Chip
                label={`${combinedAttainment.toFixed(1)}%`}
                color={
                  combinedAttainment >= 100
                    ? "success"
                    : combinedAttainment >= 80
                    ? "warning"
                    : "error"
                }
                size="medium"
                icon={getAttainmentStatus(combinedAttainment).icon}
              />
            </Stack>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, 1fr)",
                  md: "repeat(4, 1fr)",
                },
                gap: 2,
              }}
            >
              <MetricCard
                title="Total Agents"
                value={combinedMetrics.availableAgents}
                icon={<Groups />}
                color="info.main"
              />
              <MetricCard
                title="Total Leads"
                value={combinedMetrics.totalBillableLeads}
                subtitle={`Target: ${combinedMetrics.targetLeads}`}
                icon={<Assignment />}
                color="primary.main"
              />
              <MetricCard
                title="Combined Attainment"
                value={`${combinedAttainment.toFixed(1)}%`}
                icon={getAttainmentStatus(combinedAttainment).icon}
                color={getAttainmentStatus(combinedAttainment).color}
                trend={combinedAttainment >= 100 ? "up" : "down"}
              />
              {combinedMetrics.agentsMeetingMin > 0 && (
                <MetricCard
                  title="Total Meeting Min"
                  value={combinedMetrics.agentsMeetingMin}
                  subtitle={`${combinedPctAgentsMeetingMin.toFixed(
                    1
                  )}% of all agents`}
                  color="secondary.main"
                />
              )}
            </Box>
          </Stack>
        </Paper>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} lg={6}>
          {siteData.ATX ? (
            renderSiteMetrics("ATX", siteData.ATX)
          ) : (
            <Paper
              elevation={0}
              sx={{
                p: 3,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                bgcolor: "background.default",
              }}
            >
              <Stack spacing={2} alignItems="center">
                <AddCircleOutline
                  sx={{ fontSize: 48, color: "text.secondary", opacity: 0.5 }}
                />
                <Typography variant="h6" color="text.secondary">
                  No Austin Data
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  textAlign="center"
                >
                  Lead attainment data for Austin has not been entered for{" "}
                  {format(date, "MMMM d, yyyy")}
                </Typography>
              </Stack>
            </Paper>
          )}
        </Grid>
        <Grid item xs={12} lg={6}>
          {siteData.CLT ? (
            renderSiteMetrics("CLT", siteData.CLT)
          ) : (
            <Paper
              elevation={0}
              sx={{
                p: 3,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                bgcolor: "background.default",
              }}
            >
              <Stack spacing={2} alignItems="center">
                <AddCircleOutline
                  sx={{ fontSize: 48, color: "text.secondary", opacity: 0.5 }}
                />
                <Typography variant="h6" color="text.secondary">
                  No Charlotte Data
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  textAlign="center"
                >
                  Lead attainment data for Charlotte has not been entered for{" "}
                  {format(date, "MMMM d, yyyy")}
                </Typography>
              </Stack>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Stack>
  );
};
