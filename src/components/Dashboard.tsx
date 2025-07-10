import React, { useEffect, useState } from "react";
import {
  Box,
  Container,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Snackbar,
  AppBar,
  Toolbar,
  IconButton,
  Button,
  Tabs,
  Tab,
  Fade,
  Stack,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  Settings as SettingsIcon,
  CalendarMonth as CalendarIcon,
} from "@mui/icons-material";
import { RevenueData, TimeFrame, TargetSettings } from "../types/revenue";
import { FilterPanel } from "./FilterPanel";
import { DataImportExport } from "./DataImportExport";
import { DailyAttainmentChart } from "./charts/DailyAttainmentChart";
import { TimePeriodsChart } from "./charts/TimePeriodsChart";
import { RevenueComparisonChart } from "./charts/RevenueComparisonChart";
import { DistributionCharts } from "./charts/DistributionCharts";
import SummaryMetrics from "./SummaryMetrics";
import { DailyEntryForm } from "./DailyEntryForm";
import { revenueService } from "../services/firebase";
import { localStorageService } from "../services/localStorage";
import { TargetSettings as TargetSettingsComponent } from "./TargetSettings";
import { MonthlyTargetSettings as MonthlyTargetSettingsComponent } from "./MonthlyTargetSettings";
import { HistoricalTrendsView } from "./charts/HistoricalTrendsView";
import { DailyPatternsView } from "./charts/DailyPatternsView";
import { LocationDailyChart } from "./charts/LocationDailyChart";
import { LocationMTDChart } from "./charts/LocationMTDChart";
import { 
  filterDataByTimeFrame, 
  calculateLocationMetrics, 
  calculateTimePeriodsMetrics, 
  validateDataIntegrity,
  validateDataConsistency,
  recalculateMonthlyGoals
} from "../utils/calculations";
import { DaysBehindAlert } from "./DaysBehindAlert";
import { ExecutiveDashboard } from "./ExecutiveDashboard";

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
  });

  const [activeTab, setActiveTab] = useState<number>(0);
  const [isTabLoading, setIsTabLoading] = useState(false);
  const showLocationCharts = state.filters.location !== "Combined";

  useEffect(() => {
    // Try Firebase first, fallback to localStorage
    const unsubscribeRevenue = revenueService.subscribeToRevenueData((data) => {
      // If Firebase returns empty data, try localStorage
      if (data.length === 0) {
        const localData = localStorageService.getRevenueData();
        setState((prevState) => ({
          ...prevState,
          revenueData: localData,
          loading: false,
        }));
      } else {
        setState((prevState) => ({
          ...prevState,
          revenueData: data,
          loading: false,
        }));
      }
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

    // Also load from localStorage initially
    const localData = localStorageService.getRevenueData();
    const localSettings = localStorageService.getTargetSettings();
    
    setState((prevState) => ({
      ...prevState,
      revenueData: localData,
      targetSettings: localSettings,
    }));

    return () => {
      unsubscribeRevenue();
      unsubscribeTargets();
    };
  }, []);

  useEffect(() => {
    if (state.revenueData.length > 0 && state.targetSettings) {
      // Existing data integrity validation
      const validation = validateDataIntegrity(state.revenueData, state.targetSettings);
      
      if (!validation.isValid) {
        console.error("Data validation errors:", validation.errors);
        setState((prevState) => ({
          ...prevState,
          snackbar: {
            open: true,
            message: `Data validation failed: ${validation.errors.join(', ')}`,
            severity: "error",
          },
        }));
      } else if (validation.warnings.length > 0) {
        console.warn("Data validation warnings:", validation.warnings);
        // Only show first few warnings to avoid overwhelming the user
        const warningMessage = validation.warnings.slice(0, 3).join(', ');
        setState((prevState) => ({
          ...prevState,
          snackbar: {
            open: true,
            message: `Data warnings: ${warningMessage}${validation.warnings.length > 3 ? ' and more...' : ''}`,
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

      // Log detailed validation results for debugging
      console.log("Data Consistency Check:", {
        isValid: consistencyCheck.isValid,
        summary: consistencyCheck.summary,
        errors: consistencyCheck.errors,
        warnings: consistencyCheck.warnings,
      });

      // Handle critical consistency errors
      if (!consistencyCheck.isValid && consistencyCheck.errors.length > 0) {
        console.error("Critical data consistency errors:", consistencyCheck.errors);
        
        // Show error notification for critical issues
        const criticalErrors = consistencyCheck.errors.filter(error => 
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
        console.log("Monthly goal inconsistency detected, attempting recalculation...");
        
        try {
          const recalculatedSettings = recalculateMonthlyGoals(state.targetSettings, false);
          
          // Only update if there are actual changes
          if (JSON.stringify(recalculatedSettings) !== JSON.stringify(state.targetSettings)) {
            console.log("Updating target settings with recalculated monthly goals");
            setState((prevState) => ({
              ...prevState,
              targetSettings: recalculatedSettings,
              snackbar: {
                open: true,
                message: "Monthly goals have been automatically recalculated for consistency",
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
    console.log("Filter change detected:", newFilters);
    setState((prevState) => {
      // Allow users to select any timeFrame with any location
      // Remove the automatic MTD reset logic that was causing issues
      const updatedState = {
        ...prevState,
        filters: newFilters,
      };
      console.log("Updated state filters:", updatedState.filters);
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
      
      // Also save to localStorage as backup
      localStorageService.saveTargetSettings(newTargets);

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
      
      // Save to localStorage as fallback
      localStorageService.saveTargetSettings(newTargets);

      // Still update local state even if the save failed
      setState((prevState) => ({
        ...prevState,
        targetSettings: newTargets,
        loading: false,
        snackbar: {
          open: true,
          message:
            "Target settings saved locally. Firebase connection unavailable.",
          severity: "warning",
        },
      }));
    }
  };

  const handleDataUpdate = async (newData: RevenueData[]) => {
    setState((prevState) => ({
      ...prevState,
      loading: true,
    }));
    try {
      // Try Firebase first
      const results = await Promise.all(
        newData.map((entry) => revenueService.addRevenueEntry(entry))
      );
      
      const firebaseFailures = results.filter(result => !result).length;
      
      // If any Firebase saves failed, save all to localStorage
      if (firebaseFailures > 0) {
        newData.forEach(entry => localStorageService.addRevenueEntry(entry));
        const updatedData = localStorageService.getRevenueData();
        
        setState((prevState) => ({
          ...prevState,
          revenueData: updatedData,
          loading: false,
          snackbar: {
            open: true,
            message: `Imported ${newData.length} entries to local storage`,
            severity: "warning",
          },
        }));
        return;
      }
      
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
      // Try Firebase first
      const firebaseSuccess = await revenueService.addRevenueEntry(newEntry);
      
      // If Firebase fails, use localStorage
      if (!firebaseSuccess) {
        const localSuccess = localStorageService.addRevenueEntry(newEntry);
        if (localSuccess) {
          // Update state with new data from localStorage
          const updatedData = localStorageService.getRevenueData();
          setState((prevState) => ({
            ...prevState,
            revenueData: updatedData,
            loading: false,
            snackbar: {
              open: true,
              message: "Revenue data saved locally!",
              severity: "success",
            },
          }));
          return;
        }
      }
      
      setState((prevState) => ({
        ...prevState,
        loading: false,
        snackbar: {
          open: true,
          message: firebaseSuccess ? "Revenue data added successfully!" : "Failed to add data. Please try again.",
          severity: firebaseSuccess ? "success" : "error",
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
            <Stack spacing={5}>
              {/* Days Behind Alert */}
              <Box>
                <DaysBehindAlert 
                  data={state.revenueData}
                  targetSettings={state.targetSettings}
                />
              </Box>

              {/* Summary Metrics */}
              <Box>
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
              </Box>

              {/* Daily Entry Form and Filters Row */}
              <Box sx={{ mt: 1 }}>
                <Grid container spacing={4}>
                  <Grid size={{ xs: 12, lg: 5 }}>
                    <DailyEntryForm
                      onSubmit={handleDailyDataAdd}
                      existingData={state.revenueData}
                      targets={state.targetSettings}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, lg: 7 }}>
                    <Paper 
                      elevation={2} 
                      sx={{ 
                        p: 4, 
                        height: "100%",
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                    >
                      <Grid container spacing={3}>
                        <Grid size={{ xs: 12, md: 8 }}>
                          <FilterPanel
                            filters={state.filters}
                            onFilterChange={handleFilterChange}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
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
                <Stack spacing={6}>
                  <Box>
                    <Paper 
                      elevation={3} 
                      sx={{ 
                        p: 4, 
                        height: 550,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
                      }}
                    >
                      <RevenueComparisonChart
                        data={state.revenueData}
                        timeFrame={state.filters.timeFrame}
                        targetSettings={state.targetSettings}
                        startDate={state.filters.startDate}
                        endDate={state.filters.endDate}
                        location={state.filters.location}
                      />
                    </Paper>
                  </Box>

                  <Box>
                    <Paper 
                      elevation={3} 
                      sx={{ 
                        p: 4, 
                        height: 550,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
                      }}
                    >
                      <DailyAttainmentChart
                        data={state.revenueData}
                        filters={state.filters}
                        targets={state.targetSettings}
                      />
                    </Paper>
                  </Box>

                  <Box>
                    <Paper 
                      elevation={3} 
                      sx={{ 
                        p: 4, 
                        height: 550,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
                      }}
                    >
                      <TimePeriodsChart
                        data={state.revenueData}
                        filters={state.filters}
                        targets={state.targetSettings}
                      />
                    </Paper>
                  </Box>

                  <Box>
                    <Paper 
                      elevation={3} 
                      sx={{ 
                        p: 4, 
                        height: 650,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
                      }}
                    >
                      <DistributionCharts
                        data={state.revenueData}
                        filters={state.filters}
                        targets={state.targetSettings}
                      />
                    </Paper>
                  </Box>
                </Stack>
              ) : (
                // Show location-specific charts
                <Stack spacing={6}>
                  <Box>
                    <Paper 
                      elevation={3} 
                      sx={{ 
                        p: 4, 
                        height: 550,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
                      }}
                    >
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
                    </Paper>
                  </Box>
                  <Box>
                    <Paper 
                      elevation={3} 
                      sx={{ 
                        p: 4, 
                        height: 550,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
                      }}
                    >
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
                    </Paper>
                  </Box>
                </Stack>
              )}
            </Stack>
          );
        case 1:
          return (
            <HistoricalTrendsView
              data={state.revenueData}
              targetSettings={state.targetSettings}
              isLoading={isTabLoading}
            />
          );
        case 2:
          return (
            <DailyPatternsView
              data={state.revenueData}
              targetSettings={state.targetSettings}
              isLoading={isTabLoading}
            />
          );
        case 3:
          return (
            <ExecutiveDashboard
              data={state.revenueData}
              targetSettings={state.targetSettings}
            />
          );
        default:
          return null;
      }
    })();

    return (
      <Fade in={!isTabLoading} timeout={300}>
        <Box>{view}</Box>
      </Fade>
    );
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

  return (
    <Box sx={{ flexGrow: 1, bgcolor: "#F3F4F6", minHeight: "100vh", pt: 2 }}>
      <Container maxWidth={false} sx={{ px: { xs: 2, sm: 3, md: 4, lg: 6 }, py: 2 }}>
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

        <Box sx={{ mb: 3 }}>
          <AppBar position="static" sx={{ borderRadius: 2 }}>
            <Toolbar>
              <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                Revenue Attainment Dashboard
              </Typography>
              <Box sx={{ display: "flex", gap: 2 }}>
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
              </Box>
            </Toolbar>
          </AppBar>
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
            <Tab label="Historical Trends" />
            <Tab label="Daily Patterns" />
            <Tab label="Executive Dashboard" />
          </Tabs>
        </Paper>

        {state.loading && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              bgcolor: "rgba(255, 255, 255, 0.7)",
              zIndex: 9999,
            }}
          >
            <CircularProgress color="primary" />
          </Box>
        )}

        {renderActiveView()}

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
