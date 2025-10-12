import React, { useState, useEffect } from "react";
import {
  Alert,
  AlertTitle,
  Box,
  Typography,
  Chip,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemText,
  Button,
  CircularProgress,
} from "@mui/material";
import {
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CalendarMonth as CalendarIcon,
  Sync as SyncIcon,
  CloudSync as CloudSyncIcon,
} from "@mui/icons-material";
import { RevenueData, TargetSettings } from "../types/revenue";
import { calculateMissingDataDays } from "../utils/calculations";
import { dataPollingService, SyncStatus } from "../services/dataPollingService";
import { snowflakeService } from "../services/snowflake";
import { leadService } from "../services/leadService";
import { format, parseISO } from "date-fns";

interface DaysBehindAlertProps {
  data: RevenueData[];
  targetSettings: TargetSettings;
}

export const DaysBehindAlert: React.FC<DaysBehindAlertProps> = ({
  data,
  targetSettings,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncedDates, setSyncedDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Subscribe to sync status
    const unsubscribe = dataPollingService.subscribeToStatus((status) => {
      setSyncStatus(status);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const missingData = calculateMissingDataDays(data, targetSettings);

  const formatDate = (dateStr: string) => {
    // Parse date string consistently to avoid timezone issues
    const [year, month, day] = dateStr.split("-").map((num) => parseInt(num));
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const syncMissingData = async () => {
    setIsSyncing(true);
    const newlySyncedDates = new Set<string>();

    try {
      // Get the date range for missing data
      if (missingData.missingDates.length > 0) {
        const startDate =
          missingData.missingDates[missingData.missingDates.length - 1];
        const endDate = missingData.missingDates[0];

        // Fetch data from Snowflake for the missing dates
        // Ensure dates are in 2025 for test data
        const adjustedStartDate = startDate.startsWith("2024")
          ? startDate.replace("2024", "2025")
          : startDate;
        const adjustedEndDate = endDate.startsWith("2024")
          ? endDate.replace("2024", "2025")
          : endDate;

        const snowflakeData = await snowflakeService.getDailyLeadMetrics(
          adjustedStartDate,
          adjustedEndDate
        );

        // Process and sync each missing date
        for (const date of missingData.missingDates) {
          const dayData = snowflakeData.filter((d) => d.date === date);

          if (dayData.length > 0) {
            // Aggregate data by location
            const atxData = dayData.find((d) => d.site === "ATX");
            const cltData = dayData.find((d) => d.site === "CLT");

            // Create lead entry for this date
            await leadService.upsertLeadEntry({
              date: date,
              leads: {
                austin: atxData?.billableLeads || 0,
                charlotte: cltData?.billableLeads || 0,
              },
              totalCalls:
                (atxData?.totalCalls || 0) + (cltData?.totalCalls || 0),
              sales: (atxData?.sales || 0) + (cltData?.sales || 0),
              revenue: (atxData?.revenue || 0) + (cltData?.revenue || 0),
              avgCallDuration:
                ((atxData?.avgCallDuration || 0) +
                  (cltData?.avgCallDuration || 0)) /
                2,
              demographics: {
                avgAge:
                  ((atxData?.demographics?.avgAge || 0) +
                    (cltData?.demographics?.avgAge || 0)) /
                  2,
                genderDistribution: {
                  Male:
                    (atxData?.demographics?.genderDistribution?.Male || 0) +
                    (cltData?.demographics?.genderDistribution?.Male || 0),
                  Female:
                    (atxData?.demographics?.genderDistribution?.Female || 0) +
                    (cltData?.demographics?.genderDistribution?.Female || 0),
                },
                smokerDistribution: {
                  "Non-Smoker":
                    (atxData?.demographics?.smokerDistribution?.[
                      "Non-Smoker"
                    ] || 0) +
                    (cltData?.demographics?.smokerDistribution?.[
                      "Non-Smoker"
                    ] || 0),
                  Smoker:
                    (atxData?.demographics?.smokerDistribution?.["Smoker"] ||
                      0) +
                    (cltData?.demographics?.smokerDistribution?.["Smoker"] ||
                      0),
                },
              },
            });

            newlySyncedDates.add(date);
          }
        }

        setSyncedDates(new Set([...syncedDates, ...newlySyncedDates]));

        // Trigger a refresh of the dashboard data
        await dataPollingService.manualRefresh();
      }
    } catch (error) {
      console.error("Error syncing missing data:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (missingData.missingDays === 0) {
    return (
      <Alert severity="success" icon={<CheckIcon />} sx={{ mb: 3 }}>
        <AlertTitle>Data Up to Date</AlertTitle>
        All expected business days have data entries. Last entry:{" "}
        {missingData.lastDataDate
          ? formatDate(missingData.lastDataDate)
          : "No data"}
      </Alert>
    );
  }

  const getSeverity = () => {
    if (missingData.missingDays <= 1) return "warning";
    if (missingData.missingDays <= 3) return "error";
    return "error";
  };

  return (
    <Alert
      severity={getSeverity()}
      icon={<WarningIcon />}
      sx={{ mb: 3 }}
      action={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chip
            icon={<CalendarIcon />}
            label={`${missingData.missingDays} days behind`}
            color={getSeverity()}
            size="small"
          />
          <IconButton
            size="small"
            onClick={() => setExpanded(!expanded)}
            sx={{ color: "inherit" }}
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      }
    >
      <AlertTitle>Missing Data Entries</AlertTitle>
      <Typography variant="body2">
        {missingData.missingDays} business day
        {missingData.missingDays !== 1 ? "s" : ""} missing since last data
        entry.
        {missingData.lastDataDate && (
          <> Last entry was on {formatDate(missingData.lastDataDate)}.</>
        )}
      </Typography>

      {syncStatus?.snowflake.available && (
        <Box sx={{ mt: 1 }}>
          <Button
            size="small"
            variant="contained"
            color="primary"
            startIcon={
              isSyncing ? <CircularProgress size={16} /> : <CloudSyncIcon />
            }
            onClick={syncMissingData}
            disabled={isSyncing || missingData.missingDays === 0}
          >
            {isSyncing ? "Syncing..." : "Sync from Snowflake"}
          </Button>
          {syncedDates.size > 0 && (
            <Chip
              icon={<CheckIcon />}
              label={`${syncedDates.size} dates synced`}
              color="success"
              size="small"
              sx={{ ml: 1 }}
            />
          )}
        </Box>
      )}

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Missing dates:
          </Typography>
          <List dense sx={{ py: 0 }}>
            {missingData.missingDates.slice(0, 10).map((date) => (
              <ListItem key={date} sx={{ py: 0.5, px: 0 }}>
                <ListItemText
                  primary={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {formatDate(date)}
                      {syncedDates.has(date) && (
                        <Chip
                          icon={<SyncIcon />}
                          label="Synced"
                          color="success"
                          size="small"
                          sx={{ height: 20 }}
                        />
                      )}
                    </Box>
                  }
                  primaryTypographyProps={{ variant: "body2" }}
                />
              </ListItem>
            ))}
            {missingData.missingDates.length > 10 && (
              <ListItem sx={{ py: 0.5, px: 0 }}>
                <ListItemText
                  primary={`... and ${
                    missingData.missingDates.length - 10
                  } more`}
                  primaryTypographyProps={{
                    variant: "body2",
                    fontStyle: "italic",
                  }}
                />
              </ListItem>
            )}
          </List>
        </Box>
      </Collapse>
    </Alert>
  );
};
