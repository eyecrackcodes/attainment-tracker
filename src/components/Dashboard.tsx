import React, { useEffect, useState } from "react";
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Snackbar,
  AppBar,
  Toolbar,
  IconButton,
  Button,
} from "@mui/material";
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
import { TargetSettings as TargetSettingsComponent } from "./TargetSettings";
import { MonthlyTargetSettings as MonthlyTargetSettingsComponent } from "./MonthlyTargetSettings";

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

  useEffect(() => {
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

    return () => {
      unsubscribeRevenue();
      unsubscribeTargets();
    };
  }, []);

  const handleFilterChange = (newFilters: any) => {
    console.log("Filter change detected:", newFilters);
    setState((prevState) => {
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
    <Container maxWidth="xl">
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

      <Box sx={{ my: 4 }}>
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Revenue Attainment Dashboard
            </Typography>
            {/* Settings buttons with improved visibility */}
            <Box sx={{ display: "flex", gap: 2, mr: 2, alignItems: "center" }}>
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
              <Box sx={{ display: "none" }}>
                <TargetSettingsComponent
                  currentSettings={state.targetSettings}
                  onSettingsChange={handleTargetsChange}
                />
                <MonthlyTargetSettingsComponent
                  currentSettings={state.targetSettings}
                  onSettingsChange={handleTargetsChange}
                />
              </Box>
            </Box>
          </Toolbar>
        </AppBar>

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

        <Grid container spacing={3}>
          {/* Summary Metrics - Moved to top for immediate insights */}
          <Grid item xs={12}>
            <SummaryMetrics
              data={state.revenueData}
              timeFrame={state.filters.timeFrame}
              targetSettings={state.targetSettings}
              startDate={state.filters.startDate}
              endDate={state.filters.endDate}
            />
          </Grid>

          {/* Daily Entry Form - Kept near top for easy data entry */}
          <Grid item xs={12} md={4}>
            <DailyEntryForm
              onSubmit={handleDailyDataAdd}
              existingData={state.revenueData}
              targets={state.targetSettings}
            />
          </Grid>

          {/* Filters and Data Import/Export */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2, mb: 3 }}>
              <Grid container spacing={2}>
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
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Main Chart - Full width for better visibility */}
          <Grid item xs={12}>
            <RevenueComparisonChart
              data={state.revenueData}
              timeFrame={state.filters.timeFrame}
              targetSettings={state.targetSettings}
              startDate={state.filters.startDate}
              endDate={state.filters.endDate}
              location={state.filters.location}
            />
          </Grid>

          {/* Two column charts */}
          <Grid item xs={12} md={6}>
            <DailyAttainmentChart
              data={state.revenueData}
              filters={state.filters}
              targets={state.targetSettings}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TimePeriodsChart
              data={state.revenueData}
              filters={state.filters}
              targets={state.targetSettings}
            />
          </Grid>

          {/* Distribution Charts - Full width at bottom */}
          <Grid item xs={12}>
            <DistributionCharts
              data={state.revenueData}
              filters={state.filters}
              targets={state.targetSettings}
            />
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};
