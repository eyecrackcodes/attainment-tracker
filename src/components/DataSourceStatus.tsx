import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  LinearProgress,
  Box,
  Button,
  Collapse,
  Alert,
  Divider,
} from "@mui/material";
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  Storage as StorageIcon,
  Cloud as CloudIcon,
} from "@mui/icons-material";
import { dataPollingService } from "../services/dataPollingService";
import { snowflakeService } from "../services/snowflake";
import {
  validateSnowflakeData,
  createValidationReport,
} from "../utils/dataValidation";
import { format } from "date-fns";

interface DataSourceStatusProps {
  onStatusChange?: (status: any) => void;
}

export const DataSourceStatus: React.FC<DataSourceStatusProps> = ({
  onStatusChange,
}) => {
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [snowflakeStatus, setSnowflakeStatus] = useState<any>(null);
  const [validationReport, setValidationReport] = useState<string>("");
  const [showDetails, setShowDetails] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    // Subscribe to sync status
    const unsubscribe = dataPollingService.subscribeToStatus((status) => {
      setSyncStatus(status);
      onStatusChange?.(status);
    });

    // Get initial Snowflake status
    setSnowflakeStatus(snowflakeService.getConnectionStatus());

    return () => unsubscribe();
  }, [onStatusChange]);

  const runValidationTest = async () => {
    setTesting(true);
    try {
      // Test Snowflake connection and data
      const endDate = format(new Date(), "yyyy-MM-dd");
      const startDate = format(
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        "yyyy-MM-dd"
      );

      const metrics = await snowflakeService.getDailyLeadMetrics(
        startDate,
        endDate
      );
      const validation = validateSnowflakeData(metrics);
      const report = createValidationReport([validation]);

      setValidationReport(report);
      setShowDetails(true);
    } catch (error) {
      setValidationReport(`Validation failed: ${(error as Error).message}`);
      setShowDetails(true);
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = (available: boolean) => {
    return available ? (
      <CheckCircleIcon color="success" />
    ) : (
      <ErrorIcon color="error" />
    );
  };

  const getStatusColor = (available: boolean) => {
    return available ? "success" : "error";
  };

  if (!syncStatus) {
    return <LinearProgress />;
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          <Typography variant="h6" gutterBottom>
            Data Source Status
          </Typography>

          <Stack direction="row" spacing={2}>
            {/* Snowflake Status */}
            <Card variant="outlined" sx={{ flex: 1 }}>
              <CardContent>
                <Stack spacing={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <CloudIcon color="primary" />
                    <Typography variant="subtitle1">Snowflake</Typography>
                  </Box>

                  <Chip
                    icon={getStatusIcon(syncStatus.snowflake.available)}
                    label={
                      syncStatus.snowflake.available
                        ? "Connected"
                        : "Disconnected"
                    }
                    color={getStatusColor(syncStatus.snowflake.available)}
                    size="small"
                  />

                  {syncStatus.snowflake.lastSync && (
                    <Typography variant="caption" color="text.secondary">
                      Last sync:{" "}
                      {format(
                        new Date(syncStatus.snowflake.lastSync),
                        "MMM dd, HH:mm"
                      )}
                    </Typography>
                  )}

                  {syncStatus.snowflake.error && (
                    <Alert severity="error" icon={<ErrorIcon />}>
                      <Typography variant="caption">
                        {syncStatus.snowflake.error}
                      </Typography>
                    </Alert>
                  )}

                  {snowflakeStatus && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Retry count: {snowflakeStatus.retryCount}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>

            {/* Firebase Status */}
            <Card variant="outlined" sx={{ flex: 1 }}>
              <CardContent>
                <Stack spacing={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <StorageIcon color="secondary" />
                    <Typography variant="subtitle1">Firebase</Typography>
                  </Box>

                  <Chip
                    icon={getStatusIcon(syncStatus.firebase.available)}
                    label={
                      syncStatus.firebase.available
                        ? "Available"
                        : "Unavailable"
                    }
                    color={getStatusColor(syncStatus.firebase.available)}
                    size="small"
                  />

                  {syncStatus.firebase.lastSync && (
                    <Typography variant="caption" color="text.secondary">
                      Last sync:{" "}
                      {format(
                        new Date(syncStatus.firebase.lastSync),
                        "MMM dd, HH:mm"
                      )}
                    </Typography>
                  )}

                  <Chip
                    icon={<InfoIcon />}
                    label={`Active: ${
                      syncStatus.activeSource === "firebase"
                        ? "Yes"
                        : "Fallback"
                    }`}
                    color={
                      syncStatus.activeSource === "firebase"
                        ? "primary"
                        : "default"
                    }
                    size="small"
                  />
                </Stack>
              </CardContent>
            </Card>
          </Stack>

          <Divider />

          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Active Data Source:{" "}
              <strong>{syncStatus.activeSource.toUpperCase()}</strong>
            </Typography>

            <Box flex={1} />

            <Button
              size="small"
              startIcon={<RefreshIcon />}
              onClick={() => dataPollingService.manualRefresh()}
            >
              Manual Refresh
            </Button>

            <Button
              size="small"
              variant="outlined"
              onClick={runValidationTest}
              disabled={testing}
            >
              {testing ? "Testing..." : "Run Validation"}
            </Button>
          </Stack>

          <Collapse in={showDetails}>
            <Alert severity="info" onClose={() => setShowDetails(false)}>
              <Typography variant="subtitle2" gutterBottom>
                Validation Report
              </Typography>
              <Typography
                variant="body2"
                component="pre"
                sx={{
                  fontFamily: "monospace",
                  fontSize: "0.75rem",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {validationReport}
              </Typography>
            </Alert>
          </Collapse>
        </Stack>
      </CardContent>
    </Card>
  );
};
