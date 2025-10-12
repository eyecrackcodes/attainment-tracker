import React, { useEffect, useState } from "react";
import {
  Box,
  Container,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Snackbar,
  Button,
  Tabs,
  Tab,
  Stack,
} from "@mui/material";
import { ChartWrapper } from "./ChartWrapper";
import Grid from "@mui/material/Grid";
import {
  Settings as SettingsIcon,
  CalendarMonth as CalendarIcon,
  Refresh as RefreshIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
} from "@mui/icons-material";
import { RevenueData, TimeFrame, TargetSettings } from "../types/revenue";
import {
  DailyLeadMetrics,
  LeadQualityData,
  AgentPerformanceComparison,
} from "../types/snowflake";
import { FilterPanel } from "./FilterPanel";
import { DataImportExport } from "./DataImportExport";
import { DailyAttainmentChart } from "./charts/DailyAttainmentChart";
import { TimePeriodsChart } from "./charts/TimePeriodsChart";
import { RevenueComparisonChart } from "./charts/RevenueComparisonChart";
import { DistributionCharts } from "./charts/DistributionCharts";
import SummaryMetrics from "./SummaryMetrics";
import { DailyEntryForm } from "./DailyEntryForm";
import { revenueService } from "../services/firebase";
import { dataPollingService } from "../services/dataPollingService";
import { snowflakeService } from "../services/snowflake";
import { TargetSettings as TargetSettingsComponent } from "./TargetSettings";
import { MonthlyTargetSettings as MonthlyTargetSettingsComponent } from "./MonthlyTargetSettings";
// New high-impact components
import { LeadQualityScore } from "./charts/LeadQualityScore";
import { SalesConversionAnalytics } from "./charts/SalesConversionAnalytics";
import { AILeadInsights } from "./charts/AILeadInsights";
import { LocationDailyChart } from "./charts/LocationDailyChart";
import { LocationMTDChart } from "./charts/LocationMTDChart";
import { DashboardV2 } from "./DashboardV2";
import { CleanDashboard } from "./CleanDashboard";
import {
  filterDataByTimeFrame,
  calculateLocationMetrics,
  calculateTimePeriodsMetrics,
  validateDataIntegrity,
  validateDataConsistency,
  recalculateMonthlyGoals,
  getBusinessDaysInMonth,
} from "../utils/calculations";
import { DaysBehindAlert } from "./DaysBehindAlert";
import { LeadEntryForm } from "./LeadEntryForm";
import { LeadAttainmentSummary } from "./LeadAttainmentSummary";
import { LeadDataImport } from "./LeadDataImport";
import { CombinedInsights } from "./CombinedInsights";
import { AttendanceAlerts } from "./AttendanceAlerts";
import { AgentSummary } from "./AgentSummary";
import { GoalPrompt } from "./GoalPrompt";

interface DashboardState {
  revenueData: RevenueData[];
  loading: boolean;
  error: string | null;
  snackbar: {
    open: boolean;
    message: string;
    severity: "success" | "error" | "info" | "warning";
  };
  filters: {
    timeFrame: TimeFrame;
    attainmentThreshold: {
      min: number;
      max: number;
    };
    location: string;
    startDate: string | null;
    endDate: string | null;
  };
  targetSettings: TargetSettings;
  snowflakeData: {
    dailyMetrics: DailyLeadMetrics[];
    leadQualityData: LeadQualityData[];
    agentComparison: AgentPerformanceComparison[];
    lastFetch: number | null;
  };
}

export const Dashboard: React.FC = () => {
  const [state, setState] = useState<DashboardState>({
    revenueData: [],
    loading: true,
    error: null,
    snackbar: {
      open: false,
      message: "",
      severity: "info",
    },
    filters: {
      timeFrame: "MTD",
      attainmentThreshold: {
        min: 0,
        max: 200,
      },
      location: "Combined",
      startDate: null,
      endDate: null,
    },
    targetSettings: {
      dailyTargets: {
        austin: 5000,
        charlotte: 4000,
      },
      monthlyAdjustments: [],
    },
    snowflakeData: {
      dailyMetrics: [],
      leadQualityData: [],
      agentComparison: [],
      lastFetch: null,
    },
  });

  const [activeTab, setActiveTab] = useState<number>(0);
  const [isTabLoading, setIsTabLoading] = useState(false);
  const [goalPromptOpen, setGoalPromptOpen] = useState(false);
  const [useNewLayout, setUseNewLayout] = useState(true); // Default to new layout
  const [useCleanDashboard, setUseCleanDashboard] = useState(true); // Default to clean dashboard
  const showLocationCharts = state.filters.location !== "Combined";

  // Fetch data from Snowflake
  const fetchSnowflakeData = async () => {
    try {
      // For test data in 2025, use a fixed date range
      // TODO: Update this to use current dates in production
      const endDate = "2025-10-12"; // Test data end date
      const startDate = "2025-07-14"; // Test data start date (90 days before)

      // Fetch all data types in parallel
      const [dailyMetrics, leadSourceMetrics, agentComparison] =
        await Promise.all([
          snowflakeService.getDailyLeadMetrics(startDate, endDate),
          snowflakeService.getLeadSourceMetrics(startDate, endDate),
          snowflakeService.getAgentPerformanceComparison(startDate, endDate),
        ]);

      // Transform lead source metrics to lead quality data format
      const leadQualityData: LeadQualityData[] = Object.values(
        leadSourceMetrics
      ).map((metric: any) => ({
        leadSource: metric.leadSource,
        ageGroup: "35-54", // Mock data for now
        smokerStatus: "Non-Smoker",
        gender: "Mixed",
        totalLeads: metric.totalLeads,
        conversions: metric.sales,
        conversionRate: metric.conversionRate,
        avgPremium: metric.revenue / (metric.sales || 1),
        qualityScore: 0, // Will be calculated in component
      }));

      setState((prev) => ({
        ...prev,
        snowflakeData: {
          dailyMetrics,
          leadQualityData,
          agentComparison,
          lastFetch: Date.now(),
        },
      }));

      // Also transform to revenue data for existing components
      const revenueData = snowflakeService.transformToRevenueData(dailyMetrics);
      setState((prev) => ({
        ...prev,
        revenueData: [...prev.revenueData, ...revenueData],
      }));
    } catch (error) {
      console.error("Failed to fetch Snowflake data:", error);
      setState((prev) => ({
        ...prev,
        snackbar: {
          open: true,
          message: "Failed to fetch data from Snowflake. Using cached data.",
          severity: "warning",
        },
      }));
    }
  };

  useEffect(() => {
    // Initialize data polling service
    dataPollingService
      .initialize(true)
      .then(() => {
        console.log("Data polling service initialized");
      })
      .catch((error) => {
        console.error("Failed to initialize data polling service:", error);
        setState((prev) => ({
          ...prev,
          snackbar: {
            open: true,
            message: "Using Firebase data source (Snowflake unavailable)",
            severity: "info",
          },
        }));
      });

    // Subscribe to sync status updates
    const unsubscribeStatus = dataPollingService.subscribeToStatus((status) => {
      console.log("Data sync status:", status);
    });

    // Fetch initial Snowflake data
    fetchSnowflakeData();

    const unsubscribeRevenue = revenueService.subscribeToRevenueData((data) => {
      setState((prevState) => ({
        ...prevState,
        revenueData: data,
        loading: false,
      }));
    });

    const unsubscribeTargets = revenueService.subscribeToTargetSettings(
      (settings) => {
        setState((prevState) => ({
          ...prevState,
          targetSettings: settings,
          loading: false,
        }));
      }
    );

    // Set loading to false after a timeout if data hasn't loaded
    const loadingTimeout = setTimeout(() => {
      setState((prevState) => {
        if (prevState.loading) {
          console.log("Loading timeout reached, setting loading to false");
          return { ...prevState, loading: false };
        }
        return prevState;
      });
    }, 2000); // 2 second timeout

    return () => {
      unsubscribeRevenue();
      unsubscribeTargets();
      unsubscribeStatus();
      dataPollingService.cleanup();
      clearTimeout(loadingTimeout);
    };
  }, []);

  useEffect(() => {
    const today = new Date();
    const isFirstDay = today.getDate() === 1;

    if (isFirstDay) {
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const hasGoalForCurrentMonth =
        state.targetSettings.monthlyAdjustments.some(
          (adj) => adj.month === currentMonth && adj.year === currentYear
        );

      if (!hasGoalForCurrentMonth) {
        setGoalPromptOpen(true);
      }
    }
  }, [state.targetSettings.monthlyAdjustments]);

  useEffect(() => {
    if (state.revenueData.length > 0 && state.targetSettings) {
      // Existing data integrity validation
      const validation = validateDataIntegrity(
        state.revenueData,
        state.targetSettings
      );

      if (!validation.isValid) {
        console.error("Data validation errors:", validation.errors);
        setState((prevState) => ({
          ...prevState,
          snackbar: {
            open: true,
            message: `Data validation failed: ${validation.errors.join(", ")}`,
            severity: "error",
          },
        }));
      } else if (validation.warnings.length > 0) {
        console.warn("Data validation warnings:", validation.warnings);
        // Only show first few warnings to avoid overwhelming the user
        const warningMessage = validation.warnings.slice(0, 3).join(", ");
        setState((prevState) => ({
          ...prevState,
          snackbar: {
            open: true,
            message: `Data warnings: ${warningMessage}${
              validation.warnings.length > 3 ? " and more..." : ""
            }`,
            severity: "warning",
          },
        }));
      }

      // New comprehensive data consistency validation
      const consistencyCheck = validateDataConsistency(
        state.revenueData,
        state.targetSettings,
        {
          timeFrame: state.filters.timeFrame,
          location: state.filters.location,
          startDate: state.filters.startDate,
          endDate: state.filters.endDate,
        }
      );

      // Detailed validation results for debugging (commented out)
      // console.log("Data Consistency Check:", {
      //   isValid: consistencyCheck.isValid,
      //   summary: consistencyCheck.summary,
      //   errors: consistencyCheck.errors,
      //   warnings: consistencyCheck.warnings,
      // });

      // Handle critical consistency errors
      if (!consistencyCheck.isValid && consistencyCheck.errors.length > 0) {
        console.error(
          "Critical data consistency errors:",
          consistencyCheck.errors
        );

        // Show error notification for critical issues
        const criticalErrors = consistencyCheck.errors.filter(
          (error) =>
            error.includes("mismatch") || error.includes("filter not working")
        );

        if (criticalErrors.length > 0) {
          setState((prevState) => ({
            ...prevState,
            snackbar: {
              open: true,
              message: `Critical consistency issue: ${criticalErrors[0]}`,
              severity: "error",
            },
          }));
        }
      }

      // Automatically recalculate monthly goals if needed
      if (!consistencyCheck.summary.monthlyGoalConsistency) {
        // console.log(
        //   "Monthly goal inconsistency detected, attempting recalculation..."
        // );

        try {
          const recalculatedSettings = recalculateMonthlyGoals(
            state.targetSettings,
            false
          );

          // Only update if there are actual changes
          if (
            JSON.stringify(recalculatedSettings) !==
            JSON.stringify(state.targetSettings)
          ) {
            // console.log(
            //   "Updating target settings with recalculated monthly goals"
            // );
            setState((prevState) => ({
              ...prevState,
              targetSettings: recalculatedSettings,
              snackbar: {
                open: true,
                message:
                  "Monthly goals have been automatically recalculated for consistency",
                severity: "info",
              },
            }));
          }
        } catch (error) {
          console.error("Failed to recalculate monthly goals:", error);
        }
      }
    }
  }, [state.revenueData, state.targetSettings, state.filters]);

  const handleFilterChange = (newFilters: any) => {
    // console.log("Filter change detected:", newFilters);
    setState((prevState) => {
      // Allow users to select any timeFrame with any location
      // Remove the automatic MTD reset logic that was causing issues
      const updatedState = {
        ...prevState,
        filters: newFilters,
      };
      // console.log("Updated state filters:", updatedState.filters);
      return updatedState;
    });
  };

  const handleTargetsChange = async (newTargets: TargetSettings) => {
    setState((prevState) => ({
      ...prevState,
      loading: true,
    }));

    try {
      await revenueService.saveTargetSettings(newTargets);

      // Update local state regardless of whether the save was successful
      setState((prevState) => ({
        ...prevState,
        targetSettings: newTargets,
        loading: false,
        snackbar: {
          open: true,
          message: "Target settings updated successfully!",
          severity: "success",
        },
      }));
    } catch (error) {
      console.error("Error in handleTargetsChange:", error);

      // Still update local state even if the save failed
      setState((prevState) => ({
        ...prevState,
        targetSettings: newTargets,
        loading: false,
        snackbar: {
          open: true,
          message:
            "Target settings updated locally only. Changes will not persist after reload.",
          severity: "warning",
        },
      }));
    }
  };

  const handleSaveGoal = (goal: { austin: number; charlotte: number }) => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const businessDays = getBusinessDaysInMonth(currentYear, currentMonth);

    const newAdjustment = {
      month: currentMonth,
      year: currentYear,
      austin: goal.austin,
      charlotte: goal.charlotte,
      workingDays: businessDays,
    };

    const newSettings = {
      ...state.targetSettings,
      monthlyAdjustments: [
        ...state.targetSettings.monthlyAdjustments,
        newAdjustment,
      ],
    };

    handleTargetsChange(newSettings);
    setGoalPromptOpen(false);
  };

  const handleDataUpdate = async (newData: RevenueData[]) => {
    setState((prevState) => ({
      ...prevState,
      loading: true,
    }));
    try {
      // This will trigger the Firebase subscription update
      await Promise.all(
        newData.map((entry) => revenueService.addRevenueEntry(entry))
      );
      setState((prevState) => ({
        ...prevState,
        loading: false,
        snackbar: {
          open: true,
          message: `Successfully imported ${newData.length} entries`,
          severity: "success",
        },
      }));
    } catch (err) {
      setState((prevState) => ({
        ...prevState,
        loading: false,
        snackbar: {
          open: true,
          message: "Failed to import data. Please try again.",
          severity: "error",
        },
      }));
    }
  };

  const handleDailyDataAdd = async (newEntry: RevenueData) => {
    setState((prevState) => ({
      ...prevState,
      loading: true,
    }));
    try {
      await revenueService.addRevenueEntry(newEntry);
      setState((prevState) => ({
        ...prevState,
        loading: false,
        snackbar: {
          open: true,
          message: "Revenue data added successfully!",
          severity: "success",
        },
      }));
    } catch (err) {
      setState((prevState) => ({
        ...prevState,
        loading: false,
        snackbar: {
          open: true,
          message: "Failed to add data. Please try again.",
          severity: "error",
        },
      }));
    }
  };

  const handleCloseSnackbar = () => {
    setState((prevState) => ({
      ...prevState,
      snackbar: { ...prevState.snackbar, open: false },
    }));
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setIsTabLoading(true);
    setActiveTab(newValue);

    // Allow users to keep their selected timeFrame when switching tabs
    // Remove the automatic MTD reset that was limiting user choice

    // Simulate tab loading transition
    setTimeout(() => {
      setIsTabLoading(false);
    }, 300);
  };

  const renderActiveView = () => {
    const view = (() => {
      switch (activeTab) {
        case 0:
          return (
            <Stack spacing={3}>
              {/* Days Behind Alert */}
              <DaysBehindAlert
                data={state.revenueData}
                targetSettings={state.targetSettings}
              />

              {/* Attendance Alerts */}
              <AttendanceAlerts
                revenueData={state.revenueData}
                targetSettings={state.targetSettings}
              />

              {/* Agent Summary */}
              <AgentSummary />

              {/* Summary Metrics */}
              <SummaryMetrics
                data={filterDataByTimeFrame(
                  state.revenueData,
                  state.filters.timeFrame,
                  state.filters.attainmentThreshold,
                  state.targetSettings,
                  state.filters.startDate,
                  state.filters.endDate,
                  state.filters.location
                )}
                timeFrame={state.filters.timeFrame}
                targetSettings={state.targetSettings}
                startDate={state.filters.startDate}
                endDate={state.filters.endDate}
                location={state.filters.location}
              />

              {/* Daily Entry Form and Filters Row */}
              <Box sx={{ mt: 1 }}>
                <Grid container spacing={4}>
                  <Grid item xs={12} lg={5}>
                    <DailyEntryForm
                      onSubmit={handleDailyDataAdd}
                      existingData={state.revenueData}
                      targets={state.targetSettings}
                    />
                  </Grid>
                  <Grid item xs={12} lg={7}>
                    <Paper
                      elevation={2}
                      sx={{
                        p: 4,
                        height: "100%",
                        borderRadius: 2,
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={8}>
                          <FilterPanel
                            filters={state.filters}
                            onFilterChange={handleFilterChange}
                          />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <DataImportExport
                            onDataUpdate={handleDataUpdate}
                            currentData={state.revenueData}
                            targetSettings={state.targetSettings}
                          />
                        </Grid>
                      </Grid>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>

              {/* Charts Section */}
              {!showLocationCharts ? (
                // Show regular charts for combined view
                <>
                  <ChartWrapper height={400}>
                    <RevenueComparisonChart
                      data={state.revenueData}
                      timeFrame={state.filters.timeFrame}
                      targetSettings={state.targetSettings}
                      startDate={state.filters.startDate}
                      endDate={state.filters.endDate}
                      location={state.filters.location}
                    />
                  </ChartWrapper>

                  <ChartWrapper height={400}>
                    <DailyAttainmentChart
                      data={state.revenueData}
                      filters={state.filters}
                      targets={state.targetSettings}
                    />
                  </ChartWrapper>

                  <ChartWrapper height={400}>
                    <TimePeriodsChart
                      data={state.revenueData}
                      filters={state.filters}
                      targets={state.targetSettings}
                    />
                  </ChartWrapper>

                  <ChartWrapper height={450}>
                    <DistributionCharts
                      data={state.revenueData}
                      filters={state.filters}
                      targets={state.targetSettings}
                    />
                  </ChartWrapper>
                </>
              ) : (
                // Show location-specific charts
                <>
                  <ChartWrapper height={400}>
                    <LocationDailyChart
                      data={filterDataByTimeFrame(
                        state.revenueData,
                        state.filters.timeFrame,
                        state.filters.attainmentThreshold,
                        state.targetSettings,
                        state.filters.startDate,
                        state.filters.endDate,
                        state.filters.location
                      )}
                      location={state.filters.location}
                      targetSettings={state.targetSettings}
                      timeFrame={state.filters.timeFrame}
                    />
                  </ChartWrapper>

                  <ChartWrapper height={400}>
                    <LocationMTDChart
                      data={filterDataByTimeFrame(
                        state.revenueData,
                        state.filters.timeFrame,
                        state.filters.attainmentThreshold,
                        state.targetSettings,
                        state.filters.startDate,
                        state.filters.endDate,
                        state.filters.location
                      )}
                      location={state.filters.location}
                      targetSettings={state.targetSettings}
                      timeFrame={state.filters.timeFrame}
                    />
                  </ChartWrapper>
                </>
              )}
            </Stack>
          );
        // Cases 1 and 2 removed (HistoricalTrendsView and DailyPatternsView)
        case 1:
          return (
            <Stack spacing={3}>
              <Grid container spacing={3}>
                <Grid item xs={12} lg={8}>
                  <LeadEntryForm
                    defaultDate={new Date()}
                    onEntrySuccess={() => {
                      // Force refresh the summary
                      setState((prev) => ({ ...prev }));
                    }}
                  />
                </Grid>
                <Grid item xs={12} lg={4}>
                  <LeadDataImport />
                </Grid>
              </Grid>
              <LeadAttainmentSummary date={new Date()} showCombined={true} />
            </Stack>
          );
        case 2:
          return (
            <Box sx={{ width: "100%", maxWidth: "100%", overflow: "hidden" }}>
              <CombinedInsights
                revenueData={state.revenueData}
                targetSettings={state.targetSettings}
              />
            </Box>
          );
        case 3:
          return (
            <Box sx={{ pt: 2 }}>
              <LeadQualityScore
                data={state.snowflakeData.leadQualityData}
                isLoading={isTabLoading || !state.snowflakeData.lastFetch}
              />
            </Box>
          );
        case 4:
          return (
            <Box sx={{ pt: 2 }}>
              <SalesConversionAnalytics
                data={state.snowflakeData.dailyMetrics}
                isLoading={isTabLoading || !state.snowflakeData.lastFetch}
              />
            </Box>
          );
        case 5:
          return (
            <Box sx={{ pt: 2 }}>
              <AILeadInsights
                data={state.snowflakeData.agentComparison}
                isLoading={isTabLoading || !state.snowflakeData.lastFetch}
              />
            </Box>
          );
        default:
          return null;
      }
    })();

    return view;
  };

  if (state.error) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ my: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {state.error}
          </Alert>
          <Typography variant="body1">
            Please check your internet connection and reload the page.
          </Typography>
        </Box>
      </Container>
    );
  }

  // Use clean dashboard if enabled
  if (useCleanDashboard) {
    return (
      <>
        <GoalPrompt
          open={goalPromptOpen}
          onClose={() => setGoalPromptOpen(false)}
          onSave={handleSaveGoal}
        />
        <Snackbar
          open={state.snackbar.open}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Alert
            onClose={handleCloseSnackbar}
            severity={state.snackbar.severity}
            sx={{ width: "100%" }}
          >
            {state.snackbar.message}
          </Alert>
        </Snackbar>

        <Box
          sx={{
            p: 2,
            display: "flex",
            justifyContent: "space-between",
            bgcolor: "background.paper",
          }}
        >
          <FilterPanel
            filters={state.filters}
            onFiltersChange={handleFilterChange}
          />
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={async () => {
                setState((prev) => ({ ...prev, loading: true }));
                await fetchSnowflakeData();
                await dataPollingService.manualRefresh();
                setState((prev) => ({ ...prev, loading: false }));
              }}
            >
              Refresh
            </Button>
            <Button
              variant="outlined"
              onClick={() => setUseCleanDashboard(false)}
              size="small"
            >
              Legacy View
            </Button>
          </Stack>
        </Box>

        <CleanDashboard
          data={state.revenueData}
          filters={state.filters}
          targetSettings={state.targetSettings}
          snowflakeData={state.snowflakeData}
        />
      </>
    );
  }

  // Use new layout if enabled
  if (useNewLayout) {
    return (
      <Box sx={{ bgcolor: "#F3F4F6", minHeight: "100vh", pb: 4 }}>
        <Container maxWidth="xl" sx={{ pt: 3 }}>
          <GoalPrompt
            open={goalPromptOpen}
            onClose={() => setGoalPromptOpen(false)}
            onSave={handleSaveGoal}
          />
          <Snackbar
            open={state.snackbar.open}
            autoHideDuration={6000}
            onClose={handleCloseSnackbar}
            anchorOrigin={{ vertical: "top", horizontal: "center" }}
          >
            <Alert
              onClose={handleCloseSnackbar}
              severity={state.snackbar.severity}
              sx={{ width: "100%" }}
            >
              {state.snackbar.message}
            </Alert>
          </Snackbar>

          <Box
            sx={{
              mb: 3,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="h4" fontWeight="bold">
              Life Insurance Call Center Analytics
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<ViewModuleIcon />}
                onClick={() => setUseCleanDashboard(true)}
                size="small"
              >
                Clean Dashboard
              </Button>
              <Button
                variant="outlined"
                startIcon={<ViewListIcon />}
                onClick={() => setUseNewLayout(false)}
                size="small"
              >
                Switch to Classic View
              </Button>
            </Stack>
          </Box>

          <DashboardV2
            data={state.revenueData}
            filters={state.filters}
            onFiltersChange={handleFilterChange}
            targetSettings={state.targetSettings}
            snowflakeData={state.snowflakeData}
          />
        </Container>
      </Box>
    );
  }

  // Original layout
  return (
    <Box sx={{ bgcolor: "#F3F4F6", minHeight: "100vh", pb: 4 }}>
      <Container maxWidth="xl" sx={{ pt: 3 }}>
        <GoalPrompt
          open={goalPromptOpen}
          onClose={() => setGoalPromptOpen(false)}
          onSave={handleSaveGoal}
        />
        <Snackbar
          open={state.snackbar.open}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Alert
            onClose={handleCloseSnackbar}
            severity={state.snackbar.severity}
            sx={{ width: "100%" }}
          >
            {state.snackbar.message}
          </Alert>
        </Snackbar>

        <Box
          sx={{
            mb: 3,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
            Revenue Attainment Dashboard
          </Typography>
          <Box sx={{ display: "flex", gap: 2 }}>
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<ViewModuleIcon />}
                onClick={() => setUseCleanDashboard(true)}
                size="small"
              >
                Clean Dashboard
              </Button>
              <Button
                variant="outlined"
                startIcon={<ViewModuleIcon />}
                onClick={() => setUseNewLayout(true)}
                size="small"
              >
                New View
              </Button>
            </Stack>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<SettingsIcon />}
              onClick={() => {
                const targetSettingsButton = document.querySelector(
                  '[data-testid="target-settings-button"]'
                );
                if (targetSettingsButton) {
                  (targetSettingsButton as HTMLElement).click();
                }
              }}
            >
              Daily Targets
            </Button>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<CalendarIcon />}
              onClick={() => {
                const monthlySettingsButton = document.querySelector(
                  '[data-testid="monthly-settings-button"]'
                );
                if (monthlySettingsButton) {
                  (monthlySettingsButton as HTMLElement).click();
                }
              }}
            >
              Monthly Adjustments
            </Button>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<RefreshIcon />}
              onClick={async () => {
                setState((prev) => ({ ...prev, loading: true }));
                await fetchSnowflakeData();
                await dataPollingService.manualRefresh();
                setState((prev) => ({ ...prev, loading: false }));
              }}
            >
              Refresh Data
            </Button>
          </Box>
        </Box>

        <Paper sx={{ mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              "& .MuiTab-root": {
                py: 2,
              },
            }}
          >
            <Tab label="Overview" />
            <Tab label="Lead Attainment" />
            <Tab label="Lead & Sales Insights" />
            <Tab label="Lead Quality Score" />
            <Tab label="Sales Conversion" />
            <Tab label="AI Insights" />
          </Tabs>
        </Paper>

        {state.loading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              py: 10,
            }}
          >
            <CircularProgress color="primary" size={60} />
          </Box>
        ) : (
          renderActiveView()
        )}

        <TargetSettingsComponent
          currentSettings={state.targetSettings}
          onSettingsChange={handleTargetsChange}
        />
        <MonthlyTargetSettingsComponent
          currentSettings={state.targetSettings}
          onSettingsChange={handleTargetsChange}
        />
      </Container>
    </Box>
  );
};
