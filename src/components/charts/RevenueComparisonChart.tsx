import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  LabelList,
} from "recharts";
import { Line } from "recharts";
import { Typography, useTheme, Box, Paper, Divider } from "@mui/material";
import { RevenueData, TimeFrame, TargetSettings } from "../../types/revenue";
import {
  calculateLocationMetrics,
  filterDataByTimeFrame,
  getTargetForDate,
} from "../../utils/calculations";
import { format } from "date-fns";

interface RevenueComparisonChartProps {
  data: RevenueData[];
  timeFrame: TimeFrame;
  targetSettings: TargetSettings;
  startDate?: string | null;
  endDate?: string | null;
  location?: string;
}

export const RevenueComparisonChart: React.FC<RevenueComparisonChartProps> = ({
  data,
  timeFrame,
  targetSettings,
  startDate,
  endDate,
  location = "Combined",
}) => {
  const theme = useTheme();
  const brandColors = {
    austin: theme.palette.primary.main,
    charlotte: theme.palette.secondary.main,
    target: theme.palette.grey[500],
  };

  // Filter data based on selected time frame
  const filteredData = filterDataByTimeFrame(
    data,
    timeFrame,
    undefined,
    targetSettings,
    startDate,
    endDate,
    location
  );

  // Sort data by date to ensure correct order
  const sortedData = [...filteredData].sort((a, b) => {
    const aDateParts = a.date.split("-");
    const aYear = parseInt(aDateParts[0]);
    const aMonth = parseInt(aDateParts[1]) - 1;
    const aDay = parseInt(aDateParts[2]);

    const bDateParts = b.date.split("-");
    const bYear = parseInt(bDateParts[0]);
    const bMonth = parseInt(bDateParts[1]) - 1;
    const bDay = parseInt(bDateParts[2]);

    const aDate = new Date(aYear, aMonth, aDay);
    const bDate = new Date(bYear, bMonth, bDay);

    return aDate.getTime() - bDate.getTime();
  });

  // Actual dates in the data for debugging (commented out)
  // console.log(
  //   "Actual dates in data:",
  //   sortedData.map((entry) => entry.date)
  // );

  // Transform data for the chart - only include dates that have actual data
  const chartData = sortedData.map((entry) => {
    // Parse the date string correctly
    // The date string is in format 'YYYY-MM-DD'
    const dateParts = entry.date.split("-");
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1; // JavaScript months are 0-indexed
    const day = parseInt(dateParts[2]);

    const date = new Date(year, month, day);
    // console.log(
    //   `Original date string: ${entry.date}, Parsed date: ${date.toISOString()}`
    // );

    // Use a more detailed date format that includes the year to avoid confusion
    const formattedDate = format(date, "MM/dd");

    const { austin: austinTarget, charlotte: charlotteTarget } =
      getTargetForDate(date, targetSettings);

    return {
      date: formattedDate,
      fullDate: entry.date, // Store the original date string for tooltip
      Austin: entry.austin || 0,
      Charlotte: entry.charlotte || 0,
      AustinTarget: austinTarget,
      CharlotteTarget: charlotteTarget,
    };
  });

  // Chart data for debugging (commented out)
  // console.log("Chart data:", chartData);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Use the full date in the tooltip for clarity
      const fullDate = payload[0]?.payload?.fullDate;
      const formattedFullDate = fullDate
        ? format(new Date(fullDate), "MMM d, yyyy")
        : label;

      return (
        <Paper sx={{ p: 2, boxShadow: 2 }}>
          <Typography variant="subtitle2">{formattedFullDate}</Typography>
          <Divider sx={{ my: 1 }} />
          {payload.map((entry: any) => (
            <Box
              key={entry.name}
              sx={{ display: "flex", alignItems: "center", mb: 0.5 }}
            >
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  backgroundColor: entry.color,
                  mr: 1,
                }}
              />
              <Typography variant="body2">
                {entry.name}: {formatCurrency(entry.value)}
              </Typography>
            </Box>
          ))}
        </Paper>
      );
    }
    return null;
  };

  // Format currency
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Revenue Comparison
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{ height: 400, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              angle={-45}
              textAnchor="end"
              height={70}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              tickFormatter={(value) =>
                new Intl.NumberFormat("en-US", {
                  notation: "compact",
                  compactDisplay: "short",
                }).format(value)
              }
            />
            <RechartsTooltip
              formatter={(value, name) => [
                `$${Number(value).toLocaleString()}`,
                name,
              ]}
            />
            <Legend />
            <Bar
              dataKey="Austin"
              fill={theme.palette.primary.main}
              name="Austin Revenue"
            >
              <LabelList
                dataKey="Austin"
                position="top"
                formatter={(value) =>
                  value > 0
                    ? new Intl.NumberFormat("en-US", {
                        notation: "compact",
                        compactDisplay: "short",
                      }).format(value)
                    : ""
                }
              />
            </Bar>
            <Bar
              dataKey="Charlotte"
              fill={theme.palette.secondary.main}
              name="Charlotte Revenue"
            >
              <LabelList
                dataKey="Charlotte"
                position="top"
                formatter={(value) =>
                  value > 0
                    ? new Intl.NumberFormat("en-US", {
                        notation: "compact",
                        compactDisplay: "short",
                      }).format(value)
                    : ""
                }
              />
            </Bar>
            <Line
              type="monotone"
              dataKey="AustinTarget"
              stroke={theme.palette.primary.dark}
              strokeWidth={2}
              dot={false}
              name="Austin Target"
            />
            <Line
              type="monotone"
              dataKey="CharlotteTarget"
              stroke={theme.palette.secondary.dark}
              strokeWidth={2}
              dot={false}
              name="Charlotte Target"
            />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};
