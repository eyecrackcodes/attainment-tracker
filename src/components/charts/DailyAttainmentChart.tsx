import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Typography, useTheme, Box, Paper, Divider } from "@mui/material";
import { RevenueData, TimeFrame, TargetSettings } from "../../types/revenue";
import {
  filterDataByTimeFrame,
  getTargetForDate,
} from "../../utils/calculations";
import { format, parseISO } from "date-fns";

interface DailyAttainmentChartProps {
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

export const DailyAttainmentChart: React.FC<DailyAttainmentChartProps> = ({
  data,
  filters,
  targets,
}) => {
  const theme = useTheme();
  const brandColors = {
    austin: theme.palette.primary.main,
    charlotte: theme.palette.secondary.main,
    combined: theme.palette.success.main,
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

  // Transform data for the chart
  const chartData = filteredData.map((item) => {
    const date = parseISO(item.date);
    const dailyTarget = getTargetForDate(date, targets);

    // Skip days with zero targets (non-working days)
    if (dailyTarget.austin === 0 && dailyTarget.charlotte === 0) {
      return {
        date: format(date, "MM/dd"),
        fullDate: item.date,
        Austin: null,
        Charlotte: null,
        Combined: null,
      };
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

    return {
      date: format(date, "MM/dd"),
      fullDate: item.date,
      Austin: parseFloat(austinAttainment.toFixed(1)),
      Charlotte: parseFloat(charlotteAttainment.toFixed(1)),
      Combined: parseFloat(combinedAttainment.toFixed(1)),
    };
  });

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const fullDate = payload[0]?.payload?.fullDate;
      const formattedFullDate = fullDate
        ? format(parseISO(fullDate), "MMM d, yyyy")
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
                {entry.name}: {entry.value}%
              </Typography>
            </Box>
          ))}
        </Paper>
      );
    }
    return null;
  };

  return (
    <Box sx={{ height: 400, width: "100%" }}>
      <Typography variant="h6" gutterBottom>
        Daily Attainment
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Daily attainment percentage for each location and combined
      </Typography>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis domain={[0, 200]} tickFormatter={(value) => `${value}%`} />
          <RechartsTooltip content={<CustomTooltip />} />
          <Legend />
          <ReferenceLine y={100} stroke="#666" strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="Austin"
            stroke={brandColors.austin}
            activeDot={{ r: 8 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="Charlotte"
            stroke={brandColors.charlotte}
            activeDot={{ r: 8 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="Combined"
            stroke={brandColors.combined}
            activeDot={{ r: 8 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};
