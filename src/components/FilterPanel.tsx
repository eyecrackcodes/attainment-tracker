import React, { useState, useEffect } from "react";
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Slider,
  Typography,
  Grid,
  Paper,
  Chip,
  Tooltip,
  IconButton,
  Button,
  Stack,
  Divider,
} from "@mui/material";
import {
  FilterAlt as FilterIcon,
  RestartAlt as ResetIcon,
  Check as CheckIcon,
  Info as InfoIcon,
} from "@mui/icons-material";
import { FilterOptions, Location, TimeFrame } from "../types/revenue";
import { format } from "date-fns";

interface FilterPanelProps {
  filters: {
    timeFrame: TimeFrame;
    attainmentThreshold: {
      min: number;
      max: number;
    };
    location: string;
    startDate?: string | null;
    endDate?: string | null;
  };
  onFilterChange: (newFilters: any) => void;
}

const defaultFilters: FilterOptions = {
  startDate: null,
  endDate: null,
  location: "Combined",
  timeFrame: "MTD",
  attainmentThreshold: {
    min: 0,
    max: 200,
  },
};

const timeFrameOptions = [
  { value: "MTD", label: "Month to Date" },
  { value: "This Week", label: "This Week" },
  { value: "last30", label: "Last 30 Days" },
  { value: "last90", label: "Last 90 Days" },
  { value: "YTD", label: "Year to Date" },
  { value: "all", label: "All Time" },
  { value: "custom", label: "Custom Range" },
];

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFilterChange,
}) => {
  // Local state to track changes before applying
  const [localFilters, setLocalFilters] = useState<FilterOptions>({
    ...filters,
    startDate: filters.startDate || null,
    endDate: filters.endDate || null,
  });
  const [isDirty, setIsDirty] = useState(false);

  // Update local filters when props change
  useEffect(() => {
    console.log("FilterPanel received new filters:", filters);
    setLocalFilters({
      ...filters,
      startDate: filters.startDate || null,
      endDate: filters.endDate || null,
    });
    setIsDirty(false);
  }, [filters]);

  const handleLocalChange = (field: keyof FilterOptions, value: any) => {
    console.log(`Changing ${field} to:`, value);
    // If changing timeFrame to anything other than custom, reset date range
    if (field === "timeFrame" && value !== "custom") {
      setLocalFilters({
        ...localFilters,
        timeFrame: value,
        startDate: null,
        endDate: null,
      });
    } else {
      setLocalFilters({
        ...localFilters,
        [field]: value,
      });
    }
    setIsDirty(true);
  };

  const handleThresholdChange = (event: Event, newValue: number | number[]) => {
    const [min, max] = newValue as number[];
    setLocalFilters({
      ...localFilters,
      attainmentThreshold: { min, max },
    });
    setIsDirty(true);
  };

  const handleReset = () => {
    setLocalFilters(defaultFilters);
    setIsDirty(true);
  };

  const handleApply = () => {
    console.log("Applying filters:", localFilters);
    onFilterChange(localFilters);
    setIsDirty(false);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (localFilters.location !== defaultFilters.location) count++;
    if (localFilters.timeFrame !== defaultFilters.timeFrame) count++;
    if (localFilters.startDate || localFilters.endDate) count++;
    if (
      localFilters.attainmentThreshold.min !==
        defaultFilters.attainmentThreshold.min ||
      localFilters.attainmentThreshold.max !==
        defaultFilters.attainmentThreshold.max
    )
      count++;
    return count;
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <FilterIcon sx={{ mr: 1, color: "primary.main" }} />
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Filters
        </Typography>
        {getActiveFiltersCount() > 0 && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Chip
              label={`${getActiveFiltersCount()} active filters`}
              color="primary"
              size="small"
            />
            <Tooltip title="Reset all filters">
              <IconButton onClick={handleReset} size="small" color="secondary">
                <ResetIcon />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth>
            <InputLabel>Location</InputLabel>
            <Select
              value={localFilters.location}
              label="Location"
              onChange={(e) =>
                handleLocalChange("location", e.target.value as Location)
              }
            >
              <MenuItem value="Austin">Austin</MenuItem>
              <MenuItem value="Charlotte">Charlotte</MenuItem>
              <MenuItem value="Combined">Combined</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={3}>
          <FormControl fullWidth>
            <InputLabel>Time Frame</InputLabel>
            <Select
              value={localFilters.timeFrame}
              label="Time Frame"
              onChange={(e) =>
                handleLocalChange("timeFrame", e.target.value as TimeFrame)
              }
            >
              {timeFrameOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            type="date"
            label="Start Date"
            value={localFilters.startDate || ""}
            onChange={(e) => handleLocalChange("startDate", e.target.value)}
            disabled={localFilters.timeFrame !== "custom"}
            InputLabelProps={{ shrink: true }}
            helperText={
              localFilters.timeFrame !== "custom"
                ? "Select 'Custom Range' to enable"
                : ""
            }
          />
        </Grid>

        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            type="date"
            label="End Date"
            value={localFilters.endDate || ""}
            onChange={(e) => handleLocalChange("endDate", e.target.value)}
            disabled={localFilters.timeFrame !== "custom"}
            InputLabelProps={{ shrink: true }}
            helperText={
              localFilters.timeFrame !== "custom"
                ? "Select 'Custom Range' to enable"
                : ""
            }
          />
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ px: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Typography>
                Attainment Threshold: {localFilters.attainmentThreshold.min}% -{" "}
                {localFilters.attainmentThreshold.max}%
              </Typography>
              <Tooltip title="This filter shows only data points where attainment percentage falls within the selected range. For example, setting the range to 75%-125% will only show days where attainment was between 75% and 125% of target.">
                <IconButton size="small" color="primary">
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Slider
              value={[
                localFilters.attainmentThreshold.min,
                localFilters.attainmentThreshold.max,
              ]}
              onChange={handleThresholdChange}
              valueLabelDisplay="auto"
              min={0}
              max={200}
              step={5}
              marks={[
                { value: 0, label: "0%" },
                { value: 100, label: "100%" },
                { value: 200, label: "200%" },
              ]}
            />
          </Box>
        </Grid>

        <Grid item xs={12}>
          <Divider sx={{ my: 1 }} />
          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button
              variant="outlined"
              color="secondary"
              onClick={handleReset}
              startIcon={<ResetIcon />}
            >
              Reset
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleApply}
              disabled={!isDirty}
              startIcon={<CheckIcon />}
            >
              Apply Filters
            </Button>
          </Stack>
        </Grid>
      </Grid>
    </Paper>
  );
};
