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
} from "recharts";
import { Typography, useTheme, Box, Paper, Divider } from "@mui/material";
import { RevenueData, TargetSettings, TimeFrame } from "../../types/revenue";
import {
  getTargetForDate,
  filterDataByTimeFrame,
} from "../../utils/calculations";
import { format, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";

interface LocationMTDChartProps {
  data: RevenueData[];
  location: string;
  targetSettings: TargetSettings;
  timeFrame?: TimeFrame;
}

export const LocationMTDChart: React.FC<LocationMTDChartProps> = ({
  data,
  location,
  targetSettings,
  timeFrame = "MTD",
}) => {
  const theme = useTheme();
  const normalizedLocation = location.trim().toLowerCase();

  // Early validation of input data
  if (!data || data.length === 0) {
    return (
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Typography>No data available.</Typography>
      </Paper>
    );
  }

  // Log raw unfiltered data with detailed date information
  console.log("MTD Chart - Raw data analysis:", {
    allDates: data.map((d) => d.date),
    hasMarch24: data.some((d) => d.date === "2025-03-24"),
    march24Data: data.find((d) => d.date === "2025-03-24"),
    dateRange: {
      first: data[0]?.date,
      last: data[data.length - 1]?.date,
      totalDays: data.length,
    },
  });

  // Use filterDataByTimeFrame for consistent filtering
  const filteredData = filterDataByTimeFrame(
    data,
    timeFrame,
    undefined,
    targetSettings,
    null,
    null,
    normalizedLocation
  );

  // Log filtered data details
  console.log("MTD Chart - Filtered data details:", {
    timeFrame,
    location: normalizedLocation,
    dataPoints: filteredData.length,
    dates: filteredData.map((d) => d.date),
    dateRange: `${filteredData[0]?.date} to ${
      filteredData[filteredData.length - 1]?.date
    }`,
  });

  // Guard clause for empty filtered data
  if (filteredData.length === 0) {
    return (
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Typography>No data available for selected filters.</Typography>
      </Paper>
    );
  }

  console.log("MTD Chart - Filtered data:", {
    timeFrame,
    location: normalizedLocation,
    dataPoints: filteredData.length,
    dateRange: `${filteredData[0].date} to ${
      filteredData[filteredData.length - 1].date
    }`,
  });

  // Transform filtered data for chart
  let chartData = [];

  // If we're in "This Week" mode, ensure we have all weekdays
  if (timeFrame === "This Week") {
    // Create an array of all weekdays we need
    const weekDays = [
      "2025-03-24", // Monday
      "2025-03-25", // Tuesday
      "2025-03-26", // Wednesday
      "2025-03-27", // Thursday
      "2025-03-28", // Friday
    ];

    // Log weekdays we're looking for
    console.log("MTD Chart - Looking for weekdays:", weekDays);

    chartData = weekDays.map((dateStr) => {
      const date = toZonedTime(parseISO(dateStr), "UTC");
      const existingData = filteredData.find((d) => d.date === dateStr);

      // Log each weekday's data lookup
      console.log(`MTD Chart - Data lookup for ${dateStr}:`, {
        found: !!existingData,
        existingData,
        dayOfWeek: date.getUTCDay(),
        formattedDate: format(date, "M/d"),
      });

      const targets = getTargetForDate(date, targetSettings);

      let locationTarget = 0;
      let locationRevenue = 0;

      if (normalizedLocation === "combined") {
        locationTarget = (targets.austin ?? 0) + (targets.charlotte ?? 0);
        locationRevenue = existingData
          ? (existingData.austin ?? 0) + (existingData.charlotte ?? 0)
          : 0;
      } else if (normalizedLocation === "austin") {
        locationTarget = targets.austin ?? 0;
        locationRevenue = existingData?.austin ?? 0;
      } else if (normalizedLocation === "charlotte") {
        locationTarget = targets.charlotte ?? 0;
        locationRevenue = existingData?.charlotte ?? 0;
      }

      console.log(`MTD Chart - Data point for ${dateStr}:`, {
        revenue: locationRevenue,
        target: locationTarget,
        location: normalizedLocation,
        rawData: existingData,
        rawTargets: targets,
        dayOfWeek: date.getUTCDay(),
        formattedDate: format(date, "M/d"),
      });

      return {
        date: dateStr, // Keep ISO format for data key
        fullDate: dateStr,
        formattedDate: format(date, "M/d"), // For tooltip use
        actual: locationRevenue,
        target: locationTarget,
        dayNumber: date.getUTCDay(),
      };
    });
  } else {
    // For other time frames, use the existing logic
    chartData = filteredData
      .filter((entry) => {
        const date = toZonedTime(parseISO(entry.date), "UTC");
        const dayOfWeek = date.getUTCDay();
        // Keep only Monday (1) through Friday (5)
        return dayOfWeek >= 1 && dayOfWeek <= 5;
      })
      .map((entry) => {
        const date = toZonedTime(parseISO(entry.date), "UTC");
        const dayOfWeek = date.getUTCDay();
        const targets = getTargetForDate(date, targetSettings);

        let locationTarget = 0;
        let locationRevenue = 0;

        if (normalizedLocation === "combined") {
          locationTarget = (targets.austin ?? 0) + (targets.charlotte ?? 0);
          locationRevenue = (entry.austin ?? 0) + (entry.charlotte ?? 0);
        } else if (normalizedLocation === "austin") {
          locationTarget = targets.austin ?? 0;
          locationRevenue = entry.austin ?? 0;
        } else if (normalizedLocation === "charlotte") {
          locationTarget = targets.charlotte ?? 0;
          locationRevenue = entry.charlotte ?? 0;
        }

        console.log(`MTD Chart - Data point for ${entry.date}:`, {
          revenue: locationRevenue,
          target: locationTarget,
          location: normalizedLocation,
          rawData: entry,
          rawTargets: targets,
          dayOfWeek,
          formattedDate: format(date, "M/d"),
        });

        return {
          date: entry.date, // Keep ISO format for data key
          fullDate: entry.date,
          formattedDate: format(date, "M/d"), // For tooltip use
          actual: locationRevenue,
          target: locationTarget,
          dayNumber: dayOfWeek,
        };
      });
  }

  // Sort the data by date
  chartData = chartData.sort((a, b) => {
    const dateA = toZonedTime(parseISO(a.fullDate), "UTC");
    const dateB = toZonedTime(parseISO(b.fullDate), "UTC");
    return dateA.getTime() - dateB.getTime();
  });

  // Verify we have exactly 5 working days
  console.log("MTD Chart - Chart data:", {
    points: chartData.length,
    expectedPoints: 5,
    dateRange: `${chartData[0]?.fullDate} to ${
      chartData[chartData.length - 1]?.fullDate
    }`,
    allPoints: chartData.map((d) => ({
      date: d.date,
      fullDate: d.fullDate,
      dayNumber: d.dayNumber,
    })),
  });

  if (chartData.length !== 5 && timeFrame === "This Week") {
    console.error("Expected exactly 5 working days but got:", chartData.length);
  }

  // Calculate cumulative values
  let cumulativeActual = 0;
  let cumulativeTarget = 0;
  const chartDataWithCumulative = chartData.map((point) => {
    cumulativeActual += point.actual;
    cumulativeTarget += point.target;
    return {
      ...point,
      cumulativeActual,
      cumulativeTarget,
    };
  });

  console.log("MTD Chart - Final chart data:", {
    points: chartDataWithCumulative.length,
    lastPoint: chartDataWithCumulative[chartDataWithCumulative.length - 1],
    allPoints: chartDataWithCumulative.map((d) => ({
      date: d.date,
      fullDate: d.fullDate,
    })),
  });

  // Get the appropriate title based on timeFrame
  const getChartTitle = () => {
    const displayLocation =
      normalizedLocation === "combined"
        ? "Combined"
        : normalizedLocation.charAt(0).toUpperCase() +
          normalizedLocation.slice(1);

    switch (timeFrame) {
      case "This Week":
        return `${displayLocation} Weekly Revenue Attainment`;
      default:
        return `${displayLocation} Month-to-Date Revenue Attainment`;
    }
  };

  // Get the appropriate subtitle based on timeFrame
  const getChartSubtitle = () => {
    const firstDate = new Date(chartData[0].fullDate);
    const lastDate = new Date(chartData[chartData.length - 1].fullDate);

    switch (timeFrame) {
      case "This Week":
        return `Showing cumulative daily revenue vs target for week of ${format(
          firstDate,
          "MMM d"
        )} - ${format(lastDate, "MMM d, yyyy")}`;
      default:
        return `Showing cumulative daily revenue vs target for ${format(
          firstDate,
          "MMMM yyyy"
        )}`;
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      const date = toZonedTime(parseISO(data.fullDate), "UTC");
      const formattedFullDate = format(date, "MMM d, yyyy");

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

  // Custom label component to prevent overlapping
  const CustomizedLabel = (props: any) => {
    const { x, y, value, index, dataKey } = props;
    const isTarget = dataKey === "cumulativeTarget";
    const formattedValue = formatCurrency(value);

    // Dramatically increase vertical spacing and alternate based on index
    const yOffset = isTarget
      ? index % 2 === 0
        ? -85
        : -45
      : index % 2 === 0
      ? 85
      : 45;

    // Increase horizontal offset even more
    const xOffset = isTarget ? -45 : 45;

    const position = {
      x: x + xOffset,
      y: y + yOffset,
    };

    return (
      <text
        x={position.x}
        y={position.y}
        fill={theme.palette.text.primary}
        fontSize={11}
        textAnchor={isTarget ? "end" : "start"}
        dominantBaseline="middle"
        style={{ backgroundColor: "white" }}
      >
        {formattedValue}
      </text>
    );
  };

  return (
    <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        {getChartTitle()}
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {getChartSubtitle()}
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{ height: 400, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%" key={`${location}-${timeFrame}`}>
          <LineChart
            data={chartDataWithCumulative}
            margin={{ top: 90, right: 90, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              interval={0}
              padding={{ left: 10, right: 30 }}
              label={{
                value: "Date",
                position: "insideBottom",
                offset: -5,
              }}
              tick={{ fontSize: 12 }}
              tickFormatter={(value) =>
                format(toZonedTime(parseISO(value), "UTC"), "M/d")
              }
            />
            <YAxis
              tickFormatter={(value) =>
                new Intl.NumberFormat("en-US", {
                  notation: "compact",
                  compactDisplay: "short",
                }).format(value)
              }
              label={{
                value: "Cumulative Revenue ($)",
                angle: -90,
                position: "insideLeft",
                offset: 10,
              }}
            />
            <RechartsTooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              height={36}
              formatter={(value) => {
                if (value.toLowerCase().includes("actual"))
                  return "Actual Revenue";
                if (value.toLowerCase().includes("target"))
                  return "Target Revenue";
                return value;
              }}
            />
            <Line
              type="monotone"
              dataKey="cumulativeActual"
              stroke={theme.palette.primary.main}
              name={`${normalizedLocation} MTD Actual`}
              dot={(props: any) => {
                const { cx, cy, r, fill, stroke, index, payload } = props;
                const difference =
                  payload.cumulativeActual - payload.cumulativeTarget;
                const isAboveTarget = difference >= 0;
                const color = isAboveTarget
                  ? theme.palette.success.main
                  : theme.palette.error.main;
                const yOffset = -20;

                return (
                  <g key={`actual-dot-${index}`}>
                    <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} />
                    <text
                      x={cx}
                      y={cy + yOffset}
                      dy={-10}
                      fill={color}
                      fontSize={11}
                      textAnchor="middle"
                    >
                      {formatCurrency(Math.abs(difference))}
                      {isAboveTarget ? " ↑" : " ↓"}
                    </text>
                  </g>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="cumulativeTarget"
              stroke={theme.palette.warning.main}
              name={`${normalizedLocation} MTD Target`}
              dot={(props: any) => {
                const { cx, cy, r, fill, stroke, index } = props;
                return (
                  <circle
                    key={`target-dot-${index}`}
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={fill}
                    stroke={stroke}
                  />
                );
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
      <Box sx={{ mt: 2, display: "flex", justifyContent: "space-between" }}>
        <Typography variant="body2" color="text.secondary">
          Latest Actual:{" "}
          {formatCurrency(
            chartDataWithCumulative[chartDataWithCumulative.length - 1]
              ?.cumulativeActual || 0
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Latest Target:{" "}
          {formatCurrency(
            chartDataWithCumulative[chartDataWithCumulative.length - 1]
              ?.cumulativeTarget || 0
          )}
        </Typography>
      </Box>
    </Paper>
  );
};
