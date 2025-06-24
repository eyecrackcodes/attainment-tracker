import {
  RevenueData,
  DailyTarget,
  LocationMetrics,
  TimeFrame,
  WeeklyMetrics,
  MonthlyMetrics,
  TargetSettings,
  MonthlyTargetAdjustment,
} from "../types/revenue";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  isWithinInterval,
  parseISO,
  getWeekOfMonth,
  isWeekend,
  format,
} from "date-fns";

export const TARGETS: DailyTarget = {
  austin: 53000,
  charlotte: 62500,
};

export const calculateAttainment = (actual: number, target: number): number => {
  return (actual / target) * 100;
};

// Helper function to check if a date is a business day (not a weekend)
export const isBusinessDay = (date: Date): boolean => {
  return !isWeekend(date);
};

// Helper function to count business days in a date range
export const countBusinessDays = (startDate: Date, endDate: Date): number => {
  let count = 0;
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    if (isBusinessDay(currentDate)) {
      count++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return count;
};

export const calculateLocationMetrics = (
  data: RevenueData[],
  targetSettings?: TargetSettings,
  location?: string,
  timeFrame?: TimeFrame
) => {
  const totalAustin = data.reduce((sum, entry) => sum + (entry.austin || 0), 0);
  const totalCharlotte = data.reduce(
    (sum, entry) => sum + (entry.charlotte || 0),
    0
  );
  const totalRevenue = totalAustin + totalCharlotte;

  // Get the date range from the data
  const dates = data.map((entry) => new Date(entry.date));
  const now = new Date();

  // Calculate business days based on timeFrame
  let totalBusinessDays = 0;
  let elapsedBusinessDays = 0;

  // Default monthly calculation
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

  // Check if there's a monthly adjustment for the current month/year
  const monthlyAdjustment = targetSettings?.monthlyAdjustments?.find(
    (adj) => adj.month === currentMonth && adj.year === currentYear
  );

  if (monthlyAdjustment && monthlyAdjustment.workingDays.length > 0) {
    // Use the working days from the monthly adjustment
    totalBusinessDays = monthlyAdjustment.workingDays.length;
    
    // Calculate elapsed working days based on the adjustment
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentDay = today.getDate();
    
    elapsedBusinessDays = monthlyAdjustment.workingDays.filter(day => day < currentDay).length;
  } else {
    // Calculate total business days in the month (standard weekdays)
    let currentDay = new Date(firstDayOfMonth);
    while (currentDay <= lastDayOfMonth) {
      if (currentDay.getDay() !== 0 && currentDay.getDay() !== 6) {
        totalBusinessDays++;
      }
      currentDay.setDate(currentDay.getDate() + 1);
    }

    // Calculate elapsed business days (excluding today)
    currentDay = new Date(firstDayOfMonth);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    while (currentDay <= yesterday) {
      if (currentDay.getDay() !== 0 && currentDay.getDay() !== 6) {
        elapsedBusinessDays++;
      }
      currentDay.setDate(currentDay.getDate() + 1);
    }
  }

  // Calculate daily targets (use monthly adjustment overrides if available)
  const dailyAustinTarget = monthlyAdjustment?.austin ?? targetSettings?.dailyTargets?.austin ?? TARGETS.austin;
  const dailyCharlotteTarget = monthlyAdjustment?.charlotte ?? targetSettings?.dailyTargets?.charlotte ?? TARGETS.charlotte;

  // Calculate full month targets
  const monthlyAustinTarget = dailyAustinTarget * totalBusinessDays;
  const monthlyCharlotteTarget = dailyCharlotteTarget * totalBusinessDays;

  // Calculate on-pace targets based on elapsed business days
  const onPaceAustinTarget = dailyAustinTarget * elapsedBusinessDays;
  const onPaceCharlotteTarget = dailyCharlotteTarget * elapsedBusinessDays;

  // Calculate attainment percentages against on-pace targets
  const austinAttainment =
    onPaceAustinTarget > 0 ? (totalAustin / onPaceAustinTarget) * 100 : 0;
  const charlotteAttainment =
    onPaceCharlotteTarget > 0
      ? (totalCharlotte / onPaceCharlotteTarget) * 100
      : 0;

  const totalOnPaceTarget = onPaceAustinTarget + onPaceCharlotteTarget;
  const totalAttainment =
    totalOnPaceTarget > 0 ? (totalRevenue / totalOnPaceTarget) * 100 : 0;

  // Filter targets based on location
  const filteredAustinTarget =
    !location || location === "Combined" || location === "Austin"
      ? monthlyAustinTarget
      : 0;
  const filteredCharlotteTarget =
    !location || location === "Combined" || location === "Charlotte"
      ? monthlyCharlotteTarget
      : 0;
  const filteredTotalTarget = filteredAustinTarget + filteredCharlotteTarget;

  return {
    austin: {
      revenue: totalAustin,
      target: onPaceAustinTarget,
      monthlyTarget: monthlyAustinTarget,
      attainment: austinAttainment,
      elapsedDays: elapsedBusinessDays,
      totalDays: totalBusinessDays,
    },
    charlotte: {
      revenue: totalCharlotte,
      target: onPaceCharlotteTarget,
      monthlyTarget: monthlyCharlotteTarget,
      attainment: charlotteAttainment,
      elapsedDays: elapsedBusinessDays,
      totalDays: totalBusinessDays,
    },
    total: {
      revenue: totalRevenue,
      target: totalOnPaceTarget,
      monthlyTarget: filteredTotalTarget,
      attainment: totalAttainment,
      elapsedDays: elapsedBusinessDays,
      totalDays: totalBusinessDays,
    },
  };
};

// Get the appropriate target for a specific date
export const getTargetForDate = (
  date: Date,
  targetSettings?: TargetSettings
): { austin: number; charlotte: number } => {
  // If no target settings provided, return default targets
  if (!targetSettings) {
    return { austin: TARGETS.austin, charlotte: TARGETS.charlotte };
  }

  const month = date.getMonth();
  const year = date.getFullYear();
  const day = date.getDate();

  // Check if there's a monthly adjustment for this date
  const monthlyAdjustment = targetSettings.monthlyAdjustments?.find(
    (adj) => adj.month === month && adj.year === year
  );

  // If there's a monthly adjustment and this day is not in the working days, return zero targets
  if (monthlyAdjustment && !monthlyAdjustment.workingDays.includes(day)) {
    return { austin: 0, charlotte: 0 };
  }

  // If there's a monthly adjustment with custom targets, use those
  if (monthlyAdjustment) {
    return {
      austin:
        monthlyAdjustment.austin !== undefined
          ? monthlyAdjustment.austin
          : targetSettings.dailyTargets.austin,
      charlotte:
        monthlyAdjustment.charlotte !== undefined
          ? monthlyAdjustment.charlotte
          : targetSettings.dailyTargets.charlotte,
    };
  }

  // Otherwise, use the default daily targets
  return { ...targetSettings.dailyTargets };
};

// Filter data by time frame and attainment threshold
export const filterDataByTimeFrame = (
  data: RevenueData[],
  timeFrame: TimeFrame,
  attainmentThreshold?: { min: number; max: number },
  targetSettings?: TargetSettings,
  startDate?: string | null,
  endDate?: string | null,
  location?: string
): RevenueData[] => {
  if (!data || data.length === 0) return [];

  // Log raw data dates
  // console.log(
  //   "🔥 Raw Firebase Dates:",
  //   data.map((d) => d.date)
  // );

  // Default target settings if not provided
  const targets = targetSettings || {
    dailyTargets: TARGETS,
    monthlyAdjustments: [],
  };

  // First filter by date
  let filteredData = [...data];

  // Create dates in local time
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const createDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split("-").map((num) => parseInt(num));
    return new Date(year, month - 1, day);
  };

  switch (timeFrame) {
    case "This Week":
      // console.log("Filtering by This Week");
      // Use date-fns to get the correct week range starting from Monday
      const startOfWeekDate = startOfWeek(now, { weekStartsOn: 1 });
      const endOfWeekDate = endOfWeek(now, { weekStartsOn: 1 });

      // console.log("Week range:", {
      //   start: format(startOfWeekDate, "yyyy-MM-dd"),
      //   end: format(endOfWeekDate, "yyyy-MM-dd"),
      //   now: format(now, "yyyy-MM-dd"),
      // });

      // First filter by location if specified
      if (location && location !== "Combined") {
        filteredData = filteredData.map((item) => ({
          date: item.date,
          austin: location === "Austin" ? item.austin : 0,
          charlotte: location === "Charlotte" ? item.charlotte : 0,
        }));
      }

      // Then filter by date range and sort
      filteredData = filteredData
        .filter((item) => {
          const itemDate = createDate(item.date);
          const isInRange =
            itemDate >= startOfWeekDate && itemDate <= endOfWeekDate;

          // console.log(
          //   `[FILTER DEBUG] ${item.date} → included: ${isInRange} (${format(
          //     itemDate,
          //     "yyyy-MM-dd"
          //   )})`
          // );

          return isInRange;
        })
        .sort((a, b) => {
          const aDate = createDate(a.date);
          const bDate = createDate(b.date);
          return aDate.getTime() - bDate.getTime();
        });

      // console.log(`${timeFrame} Filter:`, {
      //   location,
      //   dateRange: {
      //     start: format(startOfWeekDate, "yyyy-MM-dd"),
      //     end: format(endOfWeekDate, "yyyy-MM-dd"),
      //   },
      //   filteredDates: filteredData.map((item) => item.date).sort(),
      //   dataPoints: filteredData.length,
      // });
      break;
    case "MTD":
      // Get the current date in local timezone
      const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Get the start of the current month
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

      // First filter by location if specified
      if (location && location !== "Combined") {
        filteredData = filteredData.map((item) => ({
          date: item.date,
          austin: location.toLowerCase() === "austin" ? item.austin : 0,
          charlotte: location.toLowerCase() === "charlotte" ? item.charlotte : 0,
        }));
      }

      // Then filter by date range and sort
      filteredData = filteredData
        .filter((item) => {
          const itemDate = createDate(item.date);
          
          // Include all dates from start of month up to current date
          const isInRange = itemDate >= startOfMonth && itemDate <= currentDate;

          // console.log(
          //   `Filtering MTD ${item.date}: ${isInRange ? "INCLUDED" : "excluded"} (${itemDate.toISOString()}) - Revenue: ${JSON.stringify({
          //     austin: item.austin,
          //     charlotte: item.charlotte,
          //     dayOfWeek: itemDate.getDay(),
          //   })}`
          // );
          return isInRange;
        })
        .sort((a, b) => {
          const aDate = createDate(a.date);
          const bDate = createDate(b.date);
          return aDate.getTime() - bDate.getTime();
        });

      // console.log(`${timeFrame} Filter:`, {
      //   location,
      //   dateRange: {
      //     start: startOfMonth.toISOString().split("T")[0],
      //     end: currentDate.toISOString().split("T")[0],
      //   },
      //   filteredDates: filteredData.map((item) => item.date).sort(),
      //   dataPoints: filteredData.length,
      //   allData: filteredData.map((item) => ({
      //     date: item.date,
      //     dayOfWeek: createDate(item.date).getDay(),
      //     revenue: {
      //       austin: item.austin,
      //       charlotte: item.charlotte,
      //     },
      //   })),
      // });
      break;
    case "last30":
      // console.log("Filtering by last30");
      const thirtyDaysAgo = new Date(yesterday);
      thirtyDaysAgo.setDate(yesterday.getDate() - 30);
      filteredData = filteredData.filter((item) => {
        const itemDate = createDate(item.date);
        return itemDate >= thirtyDaysAgo && itemDate <= yesterday;
      });
      break;
    case "last90":
      // console.log("Filtering by last90");
      const ninetyDaysAgo = new Date(yesterday);
      ninetyDaysAgo.setDate(yesterday.getDate() - 90);
      filteredData = filteredData.filter((item) => {
        const itemDate = createDate(item.date);
        return itemDate >= ninetyDaysAgo && itemDate <= yesterday;
      });
      break;
    case "YTD":
      // console.log("Filtering by YTD");
      const startOfYear = new Date(Date.UTC(now.getFullYear(), 0, 1));
      filteredData = filteredData.filter((item) => {
        const itemDate = createDate(item.date);
        return itemDate >= startOfYear && itemDate <= yesterday;
      });
      break;
    case "custom":
      // console.log("\n=== Custom Date Range Filtering ===");
      // console.log(`Start Date: ${startDate}, End Date: ${endDate}`);

      if (startDate && endDate) {
        // Validate dates
        const start = createDate(startDate);
        const end = createDate(endDate);

        // console.log(`Parsed dates:
        // Start: ${start.toISOString()}
        // End: ${end.toISOString()}`);

        // Check if dates are valid
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          // console.error("Invalid date format detected");
          return [];
        }

        filteredData = data.filter((item) => {
          const itemDate = createDate(item.date);
          const isIncluded = itemDate >= start && itemDate <= end;
          // console.log(
          //   `Filtering ${item.date}: ${isIncluded ? "INCLUDED" : "excluded"}`
          // );
          return isIncluded;
        });

        // console.log(`\nFiltered data summary:
        // Original count: ${data.length}
        // Filtered count: ${filteredData.length}
        // Date range: ${filteredData[0]?.date} to ${
        //   filteredData[filteredData.length - 1]?.date
        // }`);
      }
      break;
    case "all":
      // console.log("Using all data");
      filteredData = filteredData.filter((item) => {
        const itemDate = createDate(item.date);
        return itemDate <= yesterday; // Exclude today's data
      });
      break;
  }

  // Finally filter by attainment threshold if specified
  if (attainmentThreshold) {
    filteredData = filteredData.filter((item) => {
      const dailyTarget = getTargetForDate(createDate(item.date), targets);
      const austinAttainment =
        dailyTarget.austin > 0 ? (item.austin / dailyTarget.austin) * 100 : 0;
      const charlotteAttainment =
        dailyTarget.charlotte > 0
          ? (item.charlotte / dailyTarget.charlotte) * 100
          : 0;
      const combinedAttainment =
        dailyTarget.austin + dailyTarget.charlotte > 0
          ? ((item.austin + item.charlotte) /
              (dailyTarget.austin + dailyTarget.charlotte)) *
            100
          : 0;

      return (
        (austinAttainment >= attainmentThreshold.min &&
          austinAttainment <= attainmentThreshold.max) ||
        (charlotteAttainment >= attainmentThreshold.min &&
          charlotteAttainment <= attainmentThreshold.max) ||
        (combinedAttainment >= attainmentThreshold.min &&
          combinedAttainment <= attainmentThreshold.max)
      );
    });
  }

  // Sort the filtered data by date
  filteredData.sort((a, b) => {
    const aDate = createDate(a.date);
    const bDate = createDate(b.date);
    return aDate.getTime() - bDate.getTime();
  });

  // console.log("Final filtered data:", filteredData);
  return filteredData;
};

// Calculate metrics for a given dataset
export const calculateMetrics = (
  data: RevenueData[],
  targetSettings: TargetSettings
) => {
  if (!data || data.length === 0) {
    return {
      totalRevenue: 0,
      austinRevenue: 0,
      charlotteRevenue: 0,
      austinAttainment: 0,
      charlotteAttainment: 0,
      combinedAttainment: 0,
      daysAboveTarget: 0,
      totalDays: 0,
    };
  }

  let austinTotal = 0;
  let charlotteTotal = 0;
  let austinTargetTotal = 0;
  let charlotteTargetTotal = 0;
  let daysAboveTarget = 0;

  data.forEach((item) => {
    const itemDate = new Date(item.date);
    const dailyTarget = getTargetForDate(itemDate, targetSettings);

    austinTotal += item.austin;
    charlotteTotal += item.charlotte;

    // Only add to target totals if it's a working day
    if (dailyTarget.austin > 0 || dailyTarget.charlotte > 0) {
      austinTargetTotal += dailyTarget.austin;
      charlotteTargetTotal += dailyTarget.charlotte;

      // Check if combined attainment is above 100%
      const combinedRevenue = item.austin + item.charlotte;
      const combinedTarget = dailyTarget.austin + dailyTarget.charlotte;
      if (combinedTarget > 0 && combinedRevenue / combinedTarget >= 1) {
        daysAboveTarget++;
      }
    }
  });

  const totalRevenue = austinTotal + charlotteTotal;
  const totalTarget = austinTargetTotal + charlotteTargetTotal;

  // Calculate attainment percentages
  const austinAttainment =
    austinTargetTotal > 0 ? (austinTotal / austinTargetTotal) * 100 : 0;
  const charlotteAttainment =
    charlotteTargetTotal > 0
      ? (charlotteTotal / charlotteTargetTotal) * 100
      : 0;
  const combinedAttainment =
    totalTarget > 0 ? (totalRevenue / totalTarget) * 100 : 0;

  // Count working days (days with non-zero targets)
  const workingDays = data.filter((item) => {
    const itemDate = new Date(item.date);
    const dailyTarget = getTargetForDate(itemDate, targetSettings);
    return dailyTarget.austin > 0 || dailyTarget.charlotte > 0;
  }).length;

  return {
    totalRevenue,
    austinRevenue: austinTotal,
    charlotteRevenue: charlotteTotal,
    austinAttainment,
    charlotteAttainment,
    combinedAttainment,
    daysAboveTarget,
    totalDays: workingDays,
  };
};

// Calculate metrics for weekly and monthly periods
export const calculateTimePeriodsMetrics = (
  data: RevenueData[],
  targetSettings: TargetSettings
): {
  weeklyMetrics: WeeklyMetrics[];
  monthlyMetrics: MonthlyMetrics | null;
} => {
  if (!data || data.length === 0) {
    return { weeklyMetrics: [], monthlyMetrics: null };
  }

  // Sort data by date
  const sortedData = [...data].sort((a, b) => {
    // Parse the date strings correctly
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

  // Group data by week
  const weeklyData: { [key: string]: RevenueData[] } = {};

  // Get the first and last dates from the actual data
  const firstEntry = sortedData[0];
  const lastEntry = sortedData[sortedData.length - 1];

  // Parse the date strings correctly
  const firstDateParts = firstEntry.date.split("-");
  const firstYear = parseInt(firstDateParts[0]);
  const firstMonth = parseInt(firstDateParts[1]) - 1;
  const firstDay = parseInt(firstDateParts[2]);

  const lastDateParts = lastEntry.date.split("-");
  const lastYear = parseInt(lastDateParts[0]);
  const lastMonth = parseInt(lastDateParts[1]) - 1;
  const lastDay = parseInt(lastDateParts[2]);

  const firstEntryDate = new Date(firstYear, firstMonth, firstDay);
  const lastEntryDate = new Date(lastYear, lastMonth, lastDay);

  // Define week boundaries based on actual data range
  const weekBoundaries = [];

  // Start with the first day that has data
  let weekStart = new Date(firstEntryDate);

  // Create week boundaries until we reach the last day with data
  while (weekStart <= lastEntryDate) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // 7 days per week

    // If week end is past the last data point, adjust to last data point
    if (weekEnd > lastEntryDate) {
      weekEnd.setTime(lastEntryDate.getTime());
    }

    weekBoundaries.push({
      start: new Date(weekStart),
      end: new Date(weekEnd),
      label: `Week ${weekBoundaries.length + 1} (${format(
        weekStart,
        "MM/dd"
      )}-${format(weekEnd, "MM/dd")})`,
    });

    // Move to next week
    weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() + 1);
  }

  // Group data into weeks
  sortedData.forEach((entry) => {
    // Parse the date string correctly
    const dateParts = entry.date.split("-");
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1;
    const day = parseInt(dateParts[2]);

    const entryDate = new Date(year, month, day);

    // Find which week this entry belongs to
    const weekIndex = weekBoundaries.findIndex(
      (week) => entryDate >= week.start && entryDate <= week.end
    );

    if (weekIndex >= 0) {
      const weekKey = `week${weekIndex + 1}`;
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = [];
      }
      weeklyData[weekKey].push(entry);
    }
  });

  // Calculate metrics for each week
  const weeklyMetrics: WeeklyMetrics[] = [];

  weekBoundaries.forEach((week, index) => {
    const weekKey = `week${index + 1}`;
    const weekData = weeklyData[weekKey] || [];

    if (weekData.length > 0) {
      let austinRevenue = 0;
      let charlotteRevenue = 0;
      let austinTarget = 0;
      let charlotteTarget = 0;

      weekData.forEach((entry) => {
        const entryDate = new Date(entry.date);
        const dailyTarget = getTargetForDate(entryDate, targetSettings);

        austinRevenue += entry.austin;
        charlotteRevenue += entry.charlotte;
        austinTarget += dailyTarget.austin;
        charlotteTarget += dailyTarget.charlotte;
      });

      const combinedRevenue = austinRevenue + charlotteRevenue;
      const combinedTarget = austinTarget + charlotteTarget;

      const austinAttainment =
        austinTarget > 0 ? (austinRevenue / austinTarget) * 100 : 0;
      const charlotteAttainment =
        charlotteTarget > 0 ? (charlotteRevenue / charlotteTarget) * 100 : 0;
      const combinedAttainment =
        combinedTarget > 0 ? (combinedRevenue / combinedTarget) * 100 : 0;

      // Format date range for the label
      const startDateStr = format(week.start, "MMM d");
      const endDateStr = format(week.end, "MMM d");

      weeklyMetrics.push({
        label: `${startDateStr}-${endDateStr}`,
        austinRevenue,
        charlotteRevenue,
        combinedRevenue,
        austinTarget,
        charlotteTarget,
        combinedTarget,
        austinAttainment,
        charlotteAttainment,
        combinedAttainment,
      });
    }
  });

  // Calculate monthly metrics
  if (weeklyMetrics.length > 0) {
    let monthlyAustinRevenue = 0;
    let monthlyCharlotteRevenue = 0;
    let monthlyAustinTarget = 0;
    let monthlyCharlotteTarget = 0;

    sortedData.forEach((entry) => {
      const entryDate = new Date(entry.date);
      const dailyTarget = getTargetForDate(entryDate, targetSettings);

      monthlyAustinRevenue += entry.austin;
      monthlyCharlotteRevenue += entry.charlotte;
      monthlyAustinTarget += dailyTarget.austin;
      monthlyCharlotteTarget += dailyTarget.charlotte;
    });

    const monthlyCombinedRevenue =
      monthlyAustinRevenue + monthlyCharlotteRevenue;
    const monthlyCombinedTarget = monthlyAustinTarget + monthlyCharlotteTarget;

    const monthlyAustinAttainment =
      monthlyAustinTarget > 0
        ? (monthlyAustinRevenue / monthlyAustinTarget) * 100
        : 0;
    const monthlyCharlotteAttainment =
      monthlyCharlotteTarget > 0
        ? (monthlyCharlotteRevenue / monthlyCharlotteTarget) * 100
        : 0;
    const monthlyCombinedAttainment =
      monthlyCombinedTarget > 0
        ? (monthlyCombinedRevenue / monthlyCombinedTarget) * 100
        : 0;

    const monthlyMetrics: MonthlyMetrics = {
      label: format(firstEntryDate, "MMMM yyyy"),
      austinRevenue: monthlyAustinRevenue,
      charlotteRevenue: monthlyCharlotteRevenue,
      combinedRevenue: monthlyCombinedRevenue,
      austinTarget: monthlyAustinTarget,
      charlotteTarget: monthlyCharlotteTarget,
      combinedTarget: monthlyCombinedTarget,
      austinAttainment: monthlyAustinAttainment,
      charlotteAttainment: monthlyCharlotteAttainment,
      combinedAttainment: monthlyCombinedAttainment,
    };

    return { weeklyMetrics, monthlyMetrics };
  }

  return { weeklyMetrics, monthlyMetrics: null };
};

export const calculateTrend = (
  data: RevenueData[],
  targets: DailyTarget
): "improving" | "declining" | "stable" => {
  if (data.length < 2) return "stable";

  const recentDays = data.slice(-5);
  const firstHalf = recentDays.slice(0, Math.floor(recentDays.length / 2));
  const secondHalf = recentDays.slice(Math.floor(recentDays.length / 2));

  const avgFirst = calculateLocationMetrics(firstHalf, targets).combined
    .percentage;
  const avgSecond = calculateLocationMetrics(secondHalf, targets).combined
    .percentage;

  if (avgSecond - avgFirst > 5) return "improving";
  if (avgFirst - avgSecond > 5) return "declining";
  return "stable";
};

export const calculateMonthlyTrends = (data: RevenueData[]) => {
  // console.log("\n=== Monthly Trends Calculation ===");
  // console.log(`Input data points: ${data.length}`);

  // Group data by month and year
  const monthlyData = data.reduce((acc: any, entry) => {
    const date = new Date(entry.date);
    const year = date.getFullYear();
    const month = date.toLocaleString("default", { month: "short" });
    const key = `${month}-${year}`;

    if (!acc[key]) {
      acc[key] = {
        month,
        year,
        austin: 0,
        charlotte: 0,
        austinTarget: TARGETS.austin, // Use default target
        charlotteTarget: TARGETS.charlotte, // Use default target
        count: 0,
        date: date.toISOString().split("T")[0],
      };
    }

    // Sum up daily values
    acc[key].austin += entry.austin || 0;
    acc[key].charlotte += entry.charlotte || 0;
    // Only update targets if they are provided and non-zero
    if (entry.austinTarget && entry.austinTarget > 0) {
      acc[key].austinTarget = entry.austinTarget;
    }
    if (entry.charlotteTarget && entry.charlotteTarget > 0) {
      acc[key].charlotteTarget = entry.charlotteTarget;
    }
    acc[key].count++;

    return acc;
  }, {});

  // console.log("\nMonthly Aggregates:");
  // Object.entries(monthlyData).forEach(([key, data]: [string, any]) => {
  //   console.log(`${key}:
  //   Revenue: Austin=$${data.austin.toLocaleString()}, Charlotte=$${data.charlotte.toLocaleString()}
  //   Targets: Austin=$${data.austinTarget.toLocaleString()}/day, Charlotte=$${data.charlotteTarget.toLocaleString()}/day
  //   Days: ${data.count}
  //   Monthly Target: Austin=$${(
  //     data.austinTarget * data.count
  //   ).toLocaleString()}, Charlotte=$${(
  //     data.charlotteTarget * data.count
  //   ).toLocaleString()}`);
  // });

  // Convert to array and sort by date
  const sortedData = Object.values(monthlyData).sort(
    (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Calculate year-over-year comparison
  const currentYear = new Date().getFullYear();
  const processedData = sortedData.map((month: any) => {
    // Calculate monthly totals
    const monthlyAustin = month.austin;
    const monthlyCharlotte = month.charlotte;
    const monthlyTotal = monthlyAustin + monthlyCharlotte;

    // Calculate monthly targets using daily targets * number of days
    const monthlyAustinTarget = month.austinTarget * month.count;
    const monthlyCharlotteTarget = month.charlotteTarget * month.count;

    // Calculate attainment percentages
    const austinAttainment = (monthlyAustin / monthlyAustinTarget) * 100;
    const charlotteAttainment =
      (monthlyCharlotte / monthlyCharlotteTarget) * 100;
    const combinedTarget = monthlyAustinTarget + monthlyCharlotteTarget;
    const combinedAttainment = (monthlyTotal / combinedTarget) * 100;

    const result = {
      month: month.month,
      date: month.date,
      currentYear: month.year === currentYear ? monthlyTotal : null,
      previousYear: month.year === currentYear - 1 ? monthlyTotal : null,
      austinAttainment,
      charlotteAttainment,
      combinedAttainment,
    };

    // console.log(`\nProcessed ${month.month}-${month.year}:
    // Monthly Revenue: Austin=$${monthlyAustin.toLocaleString()}, Charlotte=$${monthlyCharlotte.toLocaleString()}
    // Monthly Targets: Austin=$${monthlyAustinTarget.toLocaleString()}, Charlotte=$${monthlyCharlotteTarget.toLocaleString()}
    // Attainment: Austin=${austinAttainment.toFixed(
    //   1
    // )}%, Charlotte=${charlotteAttainment.toFixed(
    //   1
    // )}%, Combined=${combinedAttainment.toFixed(1)}%
    // YoY Data: Current=${
    //   result.currentYear?.toLocaleString() || "N/A"
    // }, Previous=${result.previousYear?.toLocaleString() || "N/A"}`);

    return result;
  });

  return processedData;
};

export const calculateMovingAverage = (data: any[], periods: number) => {
  // console.log("\n=== Moving Average Calculation ===");
  // console.log(`Periods: ${periods}, Data points: ${data.length}`);

  if (!data || data.length === 0) {
    // console.log("No data provided for moving average calculation");
    return [];
  }

  const result = data.map((item, index) => {
    // Calculate the window size based on available data
    const windowSize = Math.min(periods, index + 1);
    const startIndex = Math.max(0, index - windowSize + 1);
    const window = data.slice(startIndex, index + 1);

    if (window.length === 0) {
      // console.log(`${item.month}: No data in window`);
      return {
        month: item.month,
        austin: 0,
        charlotte: 0,
      };
    }

    // Log the window data
    // console.log(`\nCalculating MA for ${item.month}:
    // Window Size: ${window.length}
    // Window Data: ${window
    //   .map(
    //     (entry) =>
    //       `${entry.month}[A=${entry.austinAttainment?.toFixed(
    //         1
    //       )}%, C=${entry.charlotteAttainment?.toFixed(1)}%]`
    //   )
    //   .join(", ")}`);

    // Calculate moving averages for attainment percentages
    const austinMA =
      window.reduce((sum, entry) => {
        const value = entry.austinAttainment || 0;
        return sum + value;
      }, 0) / window.length;

    const charlotteMA =
      window.reduce((sum, entry) => {
        const value = entry.charlotteAttainment || 0;
        return sum + value;
      }, 0) / window.length;

    const resultItem = {
      month: item.month,
      austin: austinMA,
      charlotte: charlotteMA,
    };

    // console.log(
    //   `Result for ${item.month}: Austin MA=${austinMA.toFixed(
    //     1
    //   )}%, Charlotte MA=${charlotteMA.toFixed(1)}%`
    // );
    return resultItem;
  });

  return result;
};

// Data validation function
export const validateDataIntegrity = (
  data: RevenueData[],
  targetSettings: TargetSettings
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data || data.length === 0) {
    errors.push("No data provided for validation");
    return { isValid: false, errors, warnings };
  }

  // Validate date format and consistency
  data.forEach((entry, index) => {
    // Check date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(entry.date)) {
      errors.push(`Invalid date format at index ${index}: ${entry.date}`);
      return;
    }

    // Check if date is valid
    const date = new Date(entry.date);
    if (isNaN(date.getTime())) {
      errors.push(`Invalid date at index ${index}: ${entry.date}`);
      return;
    }

    // Check revenue values
    if (typeof entry.austin !== 'number' || entry.austin < 0) {
      errors.push(`Invalid Austin revenue at index ${index}: ${entry.austin}`);
    }
    if (typeof entry.charlotte !== 'number' || entry.charlotte < 0) {
      errors.push(`Invalid Charlotte revenue at index ${index}: ${entry.charlotte}`);
    }

    // Check for future dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date > today) {
      warnings.push(`Future date found at index ${index}: ${entry.date}`);
    }

    // Validate against targets
    const dailyTarget = getTargetForDate(date, targetSettings);
    const totalRevenue = entry.austin + entry.charlotte;
    const totalTarget = dailyTarget.austin + dailyTarget.charlotte;

    if (totalTarget > 0) {
      const attainment = (totalRevenue / totalTarget) * 100;
      if (attainment > 200) {
        warnings.push(`Unusually high attainment (${attainment.toFixed(1)}%) on ${entry.date}`);
      }
      if (attainment < 10 && totalRevenue > 0) {
        warnings.push(`Unusually low attainment (${attainment.toFixed(1)}%) on ${entry.date}`);
      }
    }
  });

  // Check for duplicate dates
  const dateSet = new Set();
  data.forEach((entry, index) => {
    if (dateSet.has(entry.date)) {
      errors.push(`Duplicate date found: ${entry.date}`);
    }
    dateSet.add(entry.date);
  });

  // Validate target settings
  if (!targetSettings.dailyTargets) {
    errors.push("Daily targets not configured");
  } else {
    if (targetSettings.dailyTargets.austin <= 0) {
      errors.push("Austin daily target must be greater than 0");
    }
    if (targetSettings.dailyTargets.charlotte <= 0) {
      errors.push("Charlotte daily target must be greater than 0");
    }
  }

  // Validate monthly adjustments
  if (targetSettings.monthlyAdjustments) {
    targetSettings.monthlyAdjustments.forEach((adj, index) => {
      if (adj.month < 0 || adj.month > 11) {
        errors.push(`Invalid month in adjustment ${index}: ${adj.month}`);
      }
      if (adj.year < 2020 || adj.year > 2030) {
        warnings.push(`Unusual year in adjustment ${index}: ${adj.year}`);
      }
      if (!adj.workingDays || adj.workingDays.length === 0) {
        errors.push(`No working days specified in adjustment ${index}`);
      } else {
        adj.workingDays.forEach(day => {
          if (day < 1 || day > 31) {
            errors.push(`Invalid working day in adjustment ${index}: ${day}`);
          }
        });
      }
      if (adj.austin !== undefined && adj.austin <= 0) {
        errors.push(`Invalid Austin target in adjustment ${index}: ${adj.austin}`);
      }
      if (adj.charlotte !== undefined && adj.charlotte <= 0) {
        errors.push(`Invalid Charlotte target in adjustment ${index}: ${adj.charlotte}`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

// Calculate missing data days
export const calculateMissingDataDays = (
  data: RevenueData[],
  targetSettings: TargetSettings
): {
  missingDays: number;
  totalExpectedDays: number;
  missingDates: string[];
  lastDataDate: string | null;
} => {
  if (!data || data.length === 0) {
    return {
      missingDays: 0,
      totalExpectedDays: 0,
      missingDates: [],
      lastDataDate: null
    };
  }

  // Get the last data date with proper date parsing for sorting
  const sortedData = [...data].sort((a, b) => {
    const [aYear, aMonth, aDay] = a.date.split('-').map(num => parseInt(num));
    const [bYear, bMonth, bDay] = b.date.split('-').map(num => parseInt(num));
    const aDate = new Date(aYear, aMonth - 1, aDay);
    const bDate = new Date(bYear, bMonth - 1, bDay);
    // console.log(`Comparing dates: ${a.date} (${aDate.getTime()}) vs ${b.date} (${bDate.getTime()})`);
    return bDate.getTime() - aDate.getTime();
  });
  const lastDataDate = sortedData[0].date;
  // console.log(`Identified last data date: ${lastDataDate}`);
  
  // Parse last data date (ensure consistent date parsing)
  const [lastYear, lastMonth, lastDay] = lastDataDate.split('-').map(num => parseInt(num));
  const lastDate = new Date(lastYear, lastMonth - 1, lastDay);
  
  // Get yesterday (don't count today since the day isn't over)
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  
  // If last data is from yesterday or today, we're up to date
  if (lastDate >= yesterday) {
    return {
      missingDays: 0,
      totalExpectedDays: 0,
      missingDates: [],
      lastDataDate
    };
  }

  // Get all existing data dates for faster lookup
  const existingDates = new Set(data.map(entry => entry.date));
  
  // Calculate missing business days between last data date and yesterday
  const missingDates: string[] = [];
  let currentDate = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate() + 1); // Start from day after last data
  
  while (currentDate <= yesterday) {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const day = currentDate.getDate();
    
    // Check if there's a monthly adjustment for this date
    const monthlyAdjustment = targetSettings.monthlyAdjustments?.find(
      (adj) => adj.month === month && adj.year === year
    );
    
    let isWorkingDay = false;
    
    if (monthlyAdjustment && monthlyAdjustment.workingDays.length > 0) {
      // Use working days from monthly adjustment
      isWorkingDay = monthlyAdjustment.workingDays.includes(day);
    } else {
      // Use standard business days (weekdays only - no weekends)
      // getDay(): 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
      const dayOfWeek = currentDate.getDay();
      isWorkingDay = dayOfWeek >= 1 && dayOfWeek <= 5; // Only Monday(1) through Friday(5)
    }
    
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayOfWeek = currentDate.getDay();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // console.log(`Checking ${dateStr} (${dayNames[dayOfWeek]}): Working day? ${isWorkingDay}, Has data? ${existingDates.has(dateStr)}`);
    
    if (isWorkingDay) {
      // Only add if we don't already have data for this date
      if (!existingDates.has(dateStr)) {
        missingDates.push(dateStr);
        // console.log(`  → Added to missing dates: ${dateStr}`);
      } else {
        // console.log(`  → Skipped (has data): ${dateStr}`);
      }
    } else {
      // console.log(`  → Skipped (not working day): ${dateStr}`);
    }
    
    // Move to next day using a more reliable method
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1);
  }

     // console.log('=== Missing Data Days Calculation ===');
   // console.log('Total data entries received:', data.length);
   // console.log('All data dates (unsorted):', data.map(d => d.date));
   // console.log('Sorted data (latest first):', sortedData.slice(0, 5).map(d => d.date));
   // console.log('Last data date:', lastDataDate);
   // console.log('Yesterday:', yesterday.toISOString().split('T')[0]);
   // console.log('Today:', now.toISOString().split('T')[0]);
   // console.log('All existing dates:', Array.from(existingDates).sort());
   // console.log('Missing business days:', missingDates.length);
   // console.log('Missing dates:', missingDates);
   // console.log('Date comparison - Last date >= Yesterday:', lastDate >= yesterday);
   // console.log('Last date time:', lastDate.getTime());
   // console.log('Yesterday time:', yesterday.getTime());

  return {
    missingDays: missingDates.length,
    totalExpectedDays: missingDates.length, // For this context, total expected = missing
    missingDates,
    lastDataDate
  };
};
