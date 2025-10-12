import React, { useState, useEffect } from "react";
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Tabs,
  Tab,
  Divider,
  Collapse,
  IconButton,
  useTheme,
  Card,
  CardHeader,
  CardContent,
  Button,
  Stack,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Dashboard as DashboardIcon,
  Analytics as AnalyticsIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  SmartToy as SmartToyIcon,
  Speed as SpeedIcon,
} from "@mui/icons-material";
import { FilterPanel } from "./FilterPanel";
import { DaysBehindAlert } from "./DaysBehindAlert";
import SummaryMetrics from "./SummaryMetrics";
import { RevenueComparisonChart } from "./charts/RevenueComparisonChart";
import { LocationMTDChart } from "./charts/LocationMTDChart";
import { LocationDailyChart } from "./charts/LocationDailyChart";
import { LeadQualityScore } from "./charts/LeadQualityScore";
import { SalesConversionAnalytics } from "./charts/SalesConversionAnalytics";
import { AILeadInsights } from "./charts/AILeadInsights";
import { DataSourceStatus } from "./DataSourceStatus";
import { GoalPrompt } from "./GoalPrompt";

// Section wrapper component for collapsible sections
interface SectionWrapperProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

const SectionWrapper: React.FC<SectionWrapperProps> = ({
  title,
  icon,
  children,
  defaultExpanded = true,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const theme = useTheme();

  return (
    <Paper
      sx={{
        mb: 3,
        overflow: "hidden",
        transition: "all 0.3s",
      }}
    >
      <Box
        sx={{
          p: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          bgcolor: theme.palette.mode === "dark" ? "grey.900" : "grey.50",
          cursor: "pointer",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          {icon}
          <Typography variant="h6" fontWeight="medium">
            {title}
          </Typography>
        </Box>
        <IconButton size="small">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ p: 3 }}>{children}</Box>
      </Collapse>
    </Paper>
  );
};

interface DashboardV2Props {
  data: any;
  filters: any;
  onFiltersChange: (filters: any) => void;
  targetSettings: any;
  snowflakeData: any;
}

export const DashboardV2: React.FC<DashboardV2Props> = ({
  data,
  filters,
  onFiltersChange,
  targetSettings,
  snowflakeData,
}) => {
  const theme = useTheme();

  return (
    <Container maxWidth={false} sx={{ py: 3 }}>
      {/* Header Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom fontWeight="bold">
          Life Insurance Call Center Analytics
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Comprehensive insights into agent performance, lead quality, and
          revenue optimization
        </Typography>
      </Box>

      {/* Filter Panel */}
      <Box sx={{ mb: 4 }}>
        <FilterPanel filters={filters} onFiltersChange={onFiltersChange} />
      </Box>

      {/* Data Source Status */}
      <Box sx={{ mb: 3 }}>
        <DataSourceStatus />
      </Box>

      {/* Alerts Section */}
      <Box sx={{ mb: 3 }}>
        <DaysBehindAlert data={data} targetSettings={targetSettings} />
      </Box>

      {/* Main Dashboard Sections */}
      <Stack spacing={3}>
        {/* Overview Section */}
        <SectionWrapper
          title="Executive Overview"
          icon={<DashboardIcon color="primary" />}
          defaultExpanded={true}
        >
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <SummaryMetrics
                data={data}
                filters={filters}
                targetSettings={targetSettings}
                snowflakeData={snowflakeData}
              />
            </Grid>
            <Grid item xs={12} lg={6}>
              <RevenueComparisonChart
                data={data}
                timeFrame={filters.timeFrame}
                targetSettings={targetSettings}
                startDate={filters.startDate}
                endDate={filters.endDate}
                location={filters.location}
              />
            </Grid>
            <Grid item xs={12} lg={6}>
              <LocationMTDChart
                data={data}
                location={filters.location || "Combined"}
                targetSettings={targetSettings}
                timeFrame={filters.timeFrame}
              />
            </Grid>
          </Grid>
        </SectionWrapper>

        {/* Lead Performance Section */}
        <SectionWrapper
          title="Lead Performance Analysis"
          icon={<TrendingUpIcon color="primary" />}
          defaultExpanded={false}
        >
          <Grid container spacing={3}>
            <Grid item xs={12} lg={8}>
              <LocationDailyChart
                data={data}
                location={filters.location || "Combined"}
                targetSettings={targetSettings}
                timeFrame={filters.timeFrame}
              />
            </Grid>
            <Grid item xs={12} lg={4}>
              <Card>
                <CardHeader title="Performance Insights" />
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    Daily lead performance trends showing conversion rates and
                    volume patterns across locations.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </SectionWrapper>

        {/* Lead Quality Section */}
        <SectionWrapper
          title="Lead Quality Scoring"
          icon={<SpeedIcon color="primary" />}
          defaultExpanded={false}
        >
          <Box sx={{ minHeight: 600 }}>
            <LeadQualityScore
              data={snowflakeData.leadQualityData}
              isLoading={!snowflakeData.lastFetch}
            />
          </Box>
        </SectionWrapper>

        {/* Sales Analytics Section */}
        <SectionWrapper
          title="Sales Conversion Analytics"
          icon={<AnalyticsIcon color="primary" />}
          defaultExpanded={false}
        >
          <Box sx={{ minHeight: 600 }}>
            <SalesConversionAnalytics
              data={snowflakeData.dailyMetrics}
              isLoading={!snowflakeData.lastFetch}
            />
          </Box>
        </SectionWrapper>

        {/* AI Insights Section */}
        <SectionWrapper
          title="AI Lead Insights"
          icon={<SmartToyIcon color="primary" />}
          defaultExpanded={false}
        >
          <Box sx={{ minHeight: 600 }}>
            <AILeadInsights
              data={snowflakeData.agentComparison}
              isLoading={!snowflakeData.lastFetch}
            />
          </Box>
        </SectionWrapper>
      </Stack>
    </Container>
  );
};
