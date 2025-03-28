import React from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
} from "recharts";
import {
  Typography,
  Box,
  Grid,
  useTheme,
  Paper,
  Divider,
  Stack,
} from "@mui/material";
import { RevenueData, TimeFrame, TargetSettings } from "../../types/revenue";
import {
  filterDataByTimeFrame,
  getTargetForDate,
} from "../../utils/calculations";

interface DistributionChartsProps {
  data: RevenueData[];
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
  targets: TargetSettings;
}

export const DistributionCharts: React.FC<DistributionChartsProps> = ({
  data,
  filters,
  targets,
}) => {
  const theme = useTheme();

  // Simplified color scheme with more distinct colors
  const COLORS = {
    poor: "#d32f2f", // Red - Below 75%
    fair: "#ff9800", // Orange - 76-100%
    good: "#4caf50", // Green - 101-125%
    excellent: "#2e7d32", // Dark Green - Above 125%
  };

  // Filter data based on selected time frame
  const filteredData = filterDataByTimeFrame(
    data,
    filters.timeFrame,
    filters.attainmentThreshold,
    targets,
    filters.startDate,
    filters.endDate,
    filters.location
  );

  // Calculate attainment distribution with corrected ranges
  const calculateDistribution = () => {
    if (filteredData.length === 0) return [];

    // Corrected attainment ranges
    const ranges = [
      { name: "Below 75%", min: 0, max: 75, color: COLORS.poor },
      { name: "76-100%", min: 75.01, max: 100, color: COLORS.fair },
      { name: "101-125%", min: 100.01, max: 125, color: COLORS.good },
      {
        name: "Above 125%",
        min: 125.01,
        max: Infinity,
        color: COLORS.excellent,
      },
    ];

    // Initialize counts
    const austinCounts = ranges.map((range) => ({ ...range, count: 0 }));
    const charlotteCounts = ranges.map((range) => ({ ...range, count: 0 }));
    const combinedCounts = ranges.map((range) => ({ ...range, count: 0 }));

    // Count entries in each range
    filteredData.forEach((item) => {
      const dateParts = item.date.split("-");
      const year = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]) - 1;
      const day = parseInt(dateParts[2]);

      const date = new Date(year, month, day);
      const dailyTarget = getTargetForDate(date, targets);

      // Skip days with zero targets (non-working days)
      if (dailyTarget.austin === 0 && dailyTarget.charlotte === 0) {
        return;
      }

      const austinAttainment =
        dailyTarget.austin > 0 ? (item.austin / dailyTarget.austin) * 100 : 0;

      const charlotteAttainment =
        dailyTarget.charlotte > 0
          ? (item.charlotte / dailyTarget.charlotte) * 100
          : 0;

      const combinedTarget = dailyTarget.austin + dailyTarget.charlotte;
      const combinedRevenue = item.austin + item.charlotte;
      const combinedAttainment =
        combinedTarget > 0 ? (combinedRevenue / combinedTarget) * 100 : 0;

      // Increment counts for each location using corrected ranges
      austinCounts.forEach((range) => {
        if (austinAttainment >= range.min && austinAttainment <= range.max) {
          range.count++;
        }
      });

      charlotteCounts.forEach((range) => {
        if (
          charlotteAttainment >= range.min &&
          charlotteAttainment <= range.max
        ) {
          range.count++;
        }
      });

      combinedCounts.forEach((range) => {
        if (
          combinedAttainment >= range.min &&
          combinedAttainment <= range.max
        ) {
          range.count++;
        }
      });
    });

    // Filter out ranges with zero count for cleaner pie charts
    const filteredAustinCounts = austinCounts.filter(
      (range) => range.count > 0
    );
    const filteredCharlotteCounts = charlotteCounts.filter(
      (range) => range.count > 0
    );
    const filteredCombinedCounts = combinedCounts.filter(
      (range) => range.count > 0
    );

    // Calculate total counts for percentage calculation
    const austinTotal = filteredAustinCounts.reduce(
      (sum, item) => sum + item.count,
      0
    );
    const charlotteTotal = filteredCharlotteCounts.reduce(
      (sum, item) => sum + item.count,
      0
    );
    const combinedTotal = filteredCombinedCounts.reduce(
      (sum, item) => sum + item.count,
      0
    );

    // Add percentage to each item
    const austinWithPercentage = filteredAustinCounts.map((item) => ({
      ...item,
      percentage:
        austinTotal > 0 ? Math.round((item.count / austinTotal) * 100) : 0,
    }));

    const charlotteWithPercentage = filteredCharlotteCounts.map((item) => ({
      ...item,
      percentage:
        charlotteTotal > 0
          ? Math.round((item.count / charlotteTotal) * 100)
          : 0,
    }));

    const combinedWithPercentage = filteredCombinedCounts.map((item) => ({
      ...item,
      percentage:
        combinedTotal > 0 ? Math.round((item.count / combinedTotal) * 100) : 0,
    }));

    return {
      austin: austinWithPercentage,
      charlotte: charlotteWithPercentage,
      combined: combinedWithPercentage,
      austinTotal,
      charlotteTotal,
      combinedTotal,
    };
  };

  const distribution = calculateDistribution();

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <Paper sx={{ p: 2, boxShadow: 2 }}>
          <Typography variant="subtitle2">{payload[0].name}</Typography>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                backgroundColor: payload[0].payload.color,
                mr: 1,
              }}
            />
            <Typography variant="body2">
              {payload[0].value} days ({payload[0].payload.percentage}%)
            </Typography>
          </Box>
        </Paper>
      );
    }
    return null;
  };

  // Custom label for pie chart
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
    index,
    name,
    value,
    payload,
  }: any) => {
    if (percent < 0.1) return null; // Don't show labels for small segments

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={14}
        fontWeight="bold"
      >
        {`${payload.percentage}%`}
      </text>
    );
  };

  // Simple legend component that directly uses our data
  const SimpleLegend = ({ data }: { data: any[] }) => {
    if (!data || data.length === 0) return null;

    return (
      <Stack direction="column" spacing={1} sx={{ mt: 2 }}>
        {data.map((item, index) => (
          <Box
            key={`legend-${index}`}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
            }}
          >
            <Box
              sx={{
                width: 12,
                height: 12,
                backgroundColor: item.color,
              }}
            />
            <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
              {item.name}: {item.count} days
            </Typography>
          </Box>
        ))}
      </Stack>
    );
  };

  return (
    <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Attainment Distribution
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        How often each location achieves different attainment levels
      </Typography>
      {filteredData.length === 0 ? (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: 300,
          }}
        >
          <Typography variant="body1" color="text.secondary">
            No data available for the selected time frame
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Paper elevation={1} sx={{ p: 2, height: "100%" }}>
              <Typography
                variant="subtitle1"
                align="center"
                gutterBottom
                fontWeight="bold"
              >
                Austin
              </Typography>
              <Typography
                variant="body2"
                align="center"
                color="text.secondary"
                gutterBottom
              >
                {distribution.austinTotal} days total
              </Typography>
              <Box sx={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distribution.austin}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderCustomizedLabel}
                      outerRadius={80}
                      innerRadius={40}
                      fill="#8884d8"
                      dataKey="count"
                      nameKey="name"
                      paddingAngle={4}
                    >
                      {distribution.austin.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          stroke={theme.palette.background.paper}
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
              <SimpleLegend data={distribution.austin} />
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper elevation={1} sx={{ p: 2, height: "100%" }}>
              <Typography
                variant="subtitle1"
                align="center"
                gutterBottom
                fontWeight="bold"
              >
                Charlotte
              </Typography>
              <Typography
                variant="body2"
                align="center"
                color="text.secondary"
                gutterBottom
              >
                {distribution.charlotteTotal} days total
              </Typography>
              <Box sx={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distribution.charlotte}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderCustomizedLabel}
                      outerRadius={80}
                      innerRadius={40}
                      fill="#8884d8"
                      dataKey="count"
                      nameKey="name"
                      paddingAngle={4}
                    >
                      {distribution.charlotte.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          stroke={theme.palette.background.paper}
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
              <SimpleLegend data={distribution.charlotte} />
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper elevation={1} sx={{ p: 2, height: "100%" }}>
              <Typography
                variant="subtitle1"
                align="center"
                gutterBottom
                fontWeight="bold"
              >
                Combined
              </Typography>
              <Typography
                variant="body2"
                align="center"
                color="text.secondary"
                gutterBottom
              >
                {distribution.combinedTotal} days total
              </Typography>
              <Box sx={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distribution.combined}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderCustomizedLabel}
                      outerRadius={80}
                      innerRadius={40}
                      fill="#8884d8"
                      dataKey="count"
                      nameKey="name"
                      paddingAngle={4}
                    >
                      {distribution.combined.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          stroke={theme.palette.background.paper}
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
              <SimpleLegend data={distribution.combined} />
            </Paper>
          </Grid>
        </Grid>
      )}
    </Paper>
  );
};
