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
import { Typography, useTheme, Box, Paper, Divider } from "@mui/material";
import { RevenueData, TimeFrame, TargetSettings } from "../../types/revenue";
import {
  calculateTimePeriodsMetrics,
  filterDataByTimeFrame,
} from "../../utils/calculations";
import { format } from "date-fns";

interface TimePeriodsChartProps {
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

export const TimePeriodsChart: React.FC<TimePeriodsChartProps> = ({
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

  // Calculate weekly and monthly metrics
  const { weeklyMetrics, monthlyMetrics } = calculateTimePeriodsMetrics(
    sortedData,
    targets
  );

  // Transform data for the chart
  const chartData = weeklyMetrics.map((week) => ({
    name: week.label,
    Austin: parseFloat(week.austinAttainment.toFixed(1)),
    Charlotte: parseFloat(week.charlotteAttainment.toFixed(1)),
    Combined: parseFloat(week.combinedAttainment.toFixed(1)),
  }));

  // Add monthly total if available
  if (monthlyMetrics) {
    chartData.push({
      name: "Month Total",
      Austin: parseFloat(monthlyMetrics.austinAttainment.toFixed(1)),
      Charlotte: parseFloat(monthlyMetrics.charlotteAttainment.toFixed(1)),
      Combined: parseFloat(monthlyMetrics.combinedAttainment.toFixed(1)),
    });
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Paper sx={{ p: 2, boxShadow: 2 }}>
          <Typography variant="subtitle2">{label}</Typography>
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
        Weekly Attainment
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Weekly and monthly attainment percentages
      </Typography>
      {chartData.length === 0 ? (
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
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis domain={[0, 200]} tickFormatter={(value) => `${value}%`} />
            <RechartsTooltip content={<CustomTooltip />} />
            <Legend />
            <ReferenceLine y={100} stroke="#666" strokeDasharray="3 3" />
            <Bar dataKey="Austin" fill={brandColors.austin}>
              <LabelList
                dataKey="Austin"
                position="top"
                formatter={(value: number) => `${value.toFixed(0)}%`}
              />
            </Bar>
            <Bar dataKey="Charlotte" fill={brandColors.charlotte}>
              <LabelList
                dataKey="Charlotte"
                position="top"
                formatter={(value: number) => `${value.toFixed(0)}%`}
              />
            </Bar>
            <Bar dataKey="Combined" fill={brandColors.combined}>
              <LabelList
                dataKey="Combined"
                position="top"
                formatter={(value: number) => `${value.toFixed(0)}%`}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Box>
  );
};
