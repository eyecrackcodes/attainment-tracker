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
  // Early return if no data
  if (!data || data.length === 0) {
    return {
      austin: {
        revenue: 0,
        target: 0,
        monthlyTarget: 0,
        attainment: 0,
        elapsedDays: 0,
        totalDays: 0,
      },
      charlotte: {
        revenue: 0,
        target: 0,
        monthlyTarget: 0,
        attainment: 0,
        elapsedDays: 0,
        totalDays: 0,
      },
      total: {
        revenue: 0,
        target: 0,
        monthlyTarget: 0,
        attainment: 0,
        elapsedDays: 0,
        totalDays: 0,
      },
    };
  }

  // Calculate totals efficiently using reduce
  const { totalAustin, totalCharlotte } = data.reduce(
    (acc, entry) => ({
      totalAustin: acc.totalAustin + (entry.austin || 0),
      totalCharlotte: acc.totalCharlotte + (entry.charlotte || 0),
    }),
    { totalAustin: 0, totalCharlotte: 0 }
  );

  const totalRevenue = totalAustin + totalCharlotte;

  // Get current date info for consistent calculations
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentDay = now.getDate();

  // Check for monthly adjustment - this is the "etched in stone" part
  const monthlyAdjustment = targetSettings?.monthlyAdjustments?.find(
    (adj) => adj.month === currentMonth && adj.year === currentYear
  );

  let totalBusinessDays = 0;
  let elapsedBusinessDays = 0;
  let dailyAustinTarget = 0;
  let dailyCharlotteTarget = 0;

  if (monthlyAdjustment && monthlyAdjustment.workingDays.length > 0) {
    // Use monthly adjustment - "etched in stone" values
    totalBusinessDays = monthlyAdjustment.workingDays.length;

    // Calculate elapsed working days based on the adjustment
    elapsedBusinessDays = monthlyAdjustment.workingDays.filter(
      (day) => day < currentDay
    ).length;

    // Get targets from monthly adjustment or fall back to settings
    dailyAustinTarget =
      monthlyAdjustment.austin ??
      targetSettings?.dailyTargets?.austin ??
      TARGETS.austin;
    dailyCharlotteTarget =
      monthlyAdjustment.charlotte ??
      targetSettings?.dailyTargets?.charlotte ??
      TARGETS.charlotte;
  } else {
    // Calculate standard business days for the month
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    // Count total business days in month
    let currentCalendarDay = new Date(firstDayOfMonth);
    while (currentCalendarDay <= lastDayOfMonth) {
      if (
        currentCalendarDay.getDay() !== 0 &&
        currentCalendarDay.getDay() !== 6
      ) {
        totalBusinessDays++;
      }
      currentCalendarDay.setDate(currentCalendarDay.getDate() + 1);
    }

    // Count elapsed business days (up to yesterday)
    currentCalendarDay = new Date(firstDayOfMonth);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    while (
      currentCalendarDay <= yesterday &&
      currentCalendarDay.getMonth() === currentMonth
    ) {
      if (
        currentCalendarDay.getDay() !== 0 &&
        currentCalendarDay.getDay() !== 6
      ) {
        elapsedBusinessDays++;
      }
      currentCalendarDay.setDate(currentCalendarDay.getDate() + 1);
    }

    // Use standard daily targets
    dailyAustinTarget = targetSettings?.dailyTargets?.austin ?? TARGETS.austin;
    dailyCharlotteTarget =
      targetSettings?.dailyTargets?.charlotte ?? TARGETS.charlotte;
  }

  // Calculate monthly targets (full month)
  const monthlyAustinTarget = dailyAustinTarget * totalBusinessDays;
  const monthlyCharlotteTarget = dailyCharlotteTarget * totalBusinessDays;

  // Calculate on-pace targets (elapsed days only)
  // For MTD in current month, exclude current day from elapsed days calculation
  let onPaceAustinTarget: number;
  let onPaceCharlotteTarget: number;

  if (
    timeFrame === "MTD" &&
    relevantMonth === currentMonth &&
    relevantYear === currentYear
  ) {
    // Current month MTD - use elapsed days minus current day
    const adjustedElapsedDays = Math.max(0, elapsedBusinessDays - 1);
    onPaceAustinTarget = dailyAustinTarget * adjustedElapsedDays;
    onPaceCharlotteTarget = dailyCharlotteTarget * adjustedElapsedDays;
  } else {
    // Historical or other time frames - use full elapsed days
    onPaceAustinTarget = dailyAustinTarget * elapsedBusinessDays;
    onPaceCharlotteTarget = dailyCharlotteTarget * elapsedBusinessDays;
  }

  // Efficient attainment calculations with safe division
  const austinAttainment = calculateOptimizedAttainment(
    totalAustin,
    onPaceAustinTarget
  );
  const charlotteAttainment = calculateOptimizedAttainment(
    totalCharlotte,
    onPaceCharlotteTarget
  );
  const totalOnPaceTarget = onPaceAustinTarget + onPaceCharlotteTarget;
  const totalAttainment = calculateOptimizedAttainment(
    totalRevenue,
    totalOnPaceTarget
  );

  // Apply location filtering to monthly targets for display consistency
  const getLocationFilteredTarget = (
    austinTarget: number,
    charlotteTarget: number
  ) => {
    if (!location || location === "Combined") {
      return austinTarget + charlotteTarget;
    }
    if (location === "Austin") {
      return austinTarget;
    }
    if (location === "Charlotte") {
      return charlotteTarget;
    }
    return 0;
  };

  const filteredMonthlyTarget = getLocationFilteredTarget(
    monthlyAustinTarget,
    monthlyCharlotteTarget
  );

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
      monthlyTarget: filteredMonthlyTarget,
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

  // Default target settings if not provided
  const targets = targetSettings || {
    dailyTargets: TARGETS,
    monthlyAdjustments: [],
  };

  // Optimized date creation function
  const createDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  // Get current date info for consistent filtering
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Apply location filtering first if specified
  let locationFilteredData = data;
  if (location && location !== "Combined") {
    locationFilteredData = data.map((item) => ({
      date: item.date,
      austin: location.toLowerCase() === "austin" ? item.austin : 0,
      charlotte: location.toLowerCase() === "charlotte" ? item.charlotte : 0,
    }));
  }

  // Apply time frame filtering
  let filteredData: RevenueData[] = [];

  switch (timeFrame) {
    case "This Week": {
      const startOfWeekDate = startOfWeek(now, { weekStartsOn: 1 });
      const endOfWeekDate = endOfWeek(now, { weekStartsOn: 1 });

      filteredData = locationFilteredData.filter((item) => {
        const itemDate = createDate(item.date);
        return itemDate >= startOfWeekDate && itemDate <= endOfWeekDate;
      });
      break;
    }

    case "MTD": {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      filteredData = locationFilteredData.filter((item) => {
        const itemDate = createDate(item.date);
        // Include all dates from start of month up to current date (inclusive)
        return itemDate >= startOfMonth && itemDate <= today;
      });
      break;
    }

    case "last30": {
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);

      filteredData = locationFilteredData.filter((item) => {
        const itemDate = createDate(item.date);
        return itemDate >= thirtyDaysAgo && itemDate <= today;
      });
      break;
    }

    case "last90": {
      const ninetyDaysAgo = new Date(today);
      ninetyDaysAgo.setDate(today.getDate() - 90);

      filteredData = locationFilteredData.filter((item) => {
        const itemDate = createDate(item.date);
        return itemDate >= ninetyDaysAgo && itemDate <= today;
      });
      break;
    }

    case "YTD": {
      const startOfYear = new Date(today.getFullYear(), 0, 1);

      filteredData = locationFilteredData.filter((item) => {
        const itemDate = createDate(item.date);
        return itemDate >= startOfYear && itemDate <= today;
      });
      break;
    }

    case "custom": {
      if (startDate && endDate) {
        const start = createDate(startDate);
        const end = createDate(endDate);

        // Validate dates
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          console.error("Invalid date format detected in custom range");
          return [];
        }

        filteredData = locationFilteredData.filter((item) => {
          const itemDate = createDate(item.date);
          return itemDate >= start && itemDate <= end;
        });
      } else {
        console.warn("Custom time frame selected but no date range provided");
        filteredData = locationFilteredData;
      }
      break;
    }

    default:
      filteredData = locationFilteredData;
      break;
  }

  // Sort by date for consistent ordering
  filteredData.sort((a, b) => {
    const aDate = createDate(a.date);
    const bDate = createDate(b.date);
    return aDate.getTime() - bDate.getTime();
  });

  // Apply attainment threshold filtering if specified
  if (
    attainmentThreshold &&
    (attainmentThreshold.min > 0 || attainmentThreshold.max < 200)
  ) {
    filteredData = filteredData.filter((item) => {
      const dailyTargets = getTargetForDate(
        createDate(item.date),
        targetSettings
      );
      const totalRevenue = (item.austin || 0) + (item.charlotte || 0);
      const totalTarget = dailyTargets.austin + dailyTargets.charlotte;

      if (totalTarget === 0) return true; // Include days with no target

      const attainment = (totalRevenue / totalTarget) * 100;
      return (
        attainment >= attainmentThreshold.min &&
        attainment <= attainmentThreshold.max
      );
    });
  }

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
        // Parse the date string correctly - same as used elsewhere in the code
        const dateParts = entry.date.split("-");
        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1;
        const day = parseInt(dateParts[2]);
        const entryDate = new Date(year, month, day);

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
      // Parse the date string correctly - same as used elsewhere in the code
      const dateParts = entry.date.split("-");
      const year = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]) - 1;
      const day = parseInt(dateParts[2]);
      const entryDate = new Date(year, month, day);

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

  // Convert DailyTarget to TargetSettings format
  const targetSettings: TargetSettings = {
    dailyTargets: targets,
    monthlyAdjustments: [],
  };

  const avgFirst = calculateLocationMetrics(firstHalf, targetSettings).total
    .attainment;
  const avgSecond = calculateLocationMetrics(secondHalf, targetSettings).total
    .attainment;

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
    // Note: RevenueData doesn't have target properties, so we use default targets
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
    if (typeof entry.austin !== "number" || entry.austin < 0) {
      errors.push(`Invalid Austin revenue at index ${index}: ${entry.austin}`);
    }
    if (typeof entry.charlotte !== "number" || entry.charlotte < 0) {
      errors.push(
        `Invalid Charlotte revenue at index ${index}: ${entry.charlotte}`
      );
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
        warnings.push(
          `Unusually high attainment (${attainment.toFixed(1)}%) on ${
            entry.date
          }`
        );
      }
      if (attainment < 10 && totalRevenue > 0) {
        warnings.push(
          `Unusually low attainment (${attainment.toFixed(1)}%) on ${
            entry.date
          }`
        );
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
        adj.workingDays.forEach((day) => {
          if (day < 1 || day > 31) {
            errors.push(`Invalid working day in adjustment ${index}: ${day}`);
          }
        });
      }
      if (adj.austin !== undefined && adj.austin <= 0) {
        errors.push(
          `Invalid Austin target in adjustment ${index}: ${adj.austin}`
        );
      }
      if (adj.charlotte !== undefined && adj.charlotte <= 0) {
        errors.push(
          `Invalid Charlotte target in adjustment ${index}: ${adj.charlotte}`
        );
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
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
      lastDataDate: null,
    };
  }

  // Get the last data date with proper date parsing for sorting
  const sortedData = [...data].sort((a, b) => {
    const [aYear, aMonth, aDay] = a.date.split("-").map((num) => parseInt(num));
    const [bYear, bMonth, bDay] = b.date.split("-").map((num) => parseInt(num));
    const aDate = new Date(aYear, aMonth - 1, aDay);
    const bDate = new Date(bYear, bMonth - 1, bDay);
    // console.log(`Comparing dates: ${a.date} (${aDate.getTime()}) vs ${b.date} (${bDate.getTime()})`);
    return bDate.getTime() - aDate.getTime();
  });
  const lastDataDate = sortedData[0].date;
  // console.log(`Identified last data date: ${lastDataDate}`);

  // Parse last data date (ensure consistent date parsing)
  const [lastYear, lastMonth, lastDay] = lastDataDate
    .split("-")
    .map((num) => parseInt(num));
  const lastDate = new Date(lastYear, lastMonth - 1, lastDay);

  // Get yesterday (don't count today since the day isn't over)
  const now = new Date();
  const yesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1
  );

  // If last data is from yesterday or today, we're up to date
  if (lastDate >= yesterday) {
    return {
      missingDays: 0,
      totalExpectedDays: 0,
      missingDates: [],
      lastDataDate,
    };
  }

  // Get all existing data dates for faster lookup
  const existingDates = new Set(data.map((entry) => entry.date));

  // Calculate missing business days between last data date and yesterday
  const missingDates: string[] = [];
  let currentDate = new Date(
    lastDate.getFullYear(),
    lastDate.getMonth(),
    lastDate.getDate() + 1
  ); // Start from day after last data

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

    const dateStr = currentDate.toISOString().split("T")[0];
    const dayOfWeek = currentDate.getDay();
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
    currentDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate() + 1
    );
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
    lastDataDate,
  };
};

// Advanced Stakeholder Analytics for Executive Decision Making
export const calculateStakeholderInsights = (
  data: RevenueData[],
  targetSettings: TargetSettings
): {
  executiveSummary: {
    currentPerformance: number;
    monthlyProjection: number;
    riskLevel: "low" | "medium" | "high";
    keyInsight: string;
    actionRequired: boolean;
  };
  performanceForecasting: {
    monthEndProjection: {
      austin: number;
      charlotte: number;
      combined: number;
      confidence: number;
    };
    quarterProjection: {
      revenue: number;
      attainment: number;
      confidence: number;
    };
    trendAnalysis: {
      direction: "improving" | "declining" | "stable";
      velocity: number;
      sustainability: "high" | "medium" | "low";
    };
  };
  riskAnalysis: {
    revenueAtRisk: number;
    daysToRecovery: number;
    criticalFactors: string[];
    mitigation: string[];
  };
  competitivePositioning: {
    marketShare: {
      austin: number;
      charlotte: number;
    };
    growthRate: number;
    benchmarkComparison: "above" | "at" | "below";
  };
  operationalEfficiency: {
    revenuePerDay: number;
    consistency: number;
    peakPerformanceDays: string[];
    underperformingDays: string[];
  };
  strategicRecommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
    resourceAllocation: {
      austin: "increase" | "maintain" | "decrease";
      charlotte: "increase" | "maintain" | "decrease";
      reasoning: string;
    };
  };
} => {
  if (!data || data.length === 0) {
    return {
      executiveSummary: {
        currentPerformance: 0,
        monthlyProjection: 0,
        riskLevel: "high" as const,
        keyInsight: "No data available for analysis",
        actionRequired: true,
      },
      performanceForecasting: {
        monthEndProjection: {
          austin: 0,
          charlotte: 0,
          combined: 0,
          confidence: 0,
        },
        quarterProjection: { revenue: 0, attainment: 0, confidence: 0 },
        trendAnalysis: {
          direction: "stable" as const,
          velocity: 0,
          sustainability: "low" as const,
        },
      },
      riskAnalysis: {
        revenueAtRisk: 0,
        daysToRecovery: 0,
        criticalFactors: ["No data available"],
        mitigation: ["Implement data collection process"],
      },
      competitivePositioning: {
        marketShare: { austin: 0, charlotte: 0 },
        growthRate: 0,
        benchmarkComparison: "below" as const,
      },
      operationalEfficiency: {
        revenuePerDay: 0,
        consistency: 0,
        peakPerformanceDays: [],
        underperformingDays: [],
      },
      strategicRecommendations: {
        immediate: ["Establish data collection and tracking systems"],
        shortTerm: ["Set performance baselines and targets"],
        longTerm: ["Develop comprehensive performance management strategy"],
        resourceAllocation: {
          austin: "maintain" as const,
          charlotte: "maintain" as const,
          reasoning:
            "Insufficient data for strategic resource allocation decisions",
        },
      },
    };
  }

  // Current month analysis
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const locationMetrics = calculateLocationMetrics(data, targetSettings);

  // Sort data chronologically
  const sortedData = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Calculate recent performance (last 7 days)
  const recentData = sortedData.slice(-7);
  const recentPerformance =
    recentData.length > 0
      ? recentData.reduce(
          (sum, entry) => sum + (entry.austin || 0) + (entry.charlotte || 0),
          0
        ) / recentData.length
      : 0;

  // Calculate trend velocity (performance change rate)
  const last14Days = sortedData.slice(-14);
  const firstHalf = last14Days.slice(0, 7);
  const secondHalf = last14Days.slice(7);

  const firstHalfAvg =
    firstHalf.length > 0
      ? firstHalf.reduce(
          (sum, entry) => sum + (entry.austin || 0) + (entry.charlotte || 0),
          0
        ) / firstHalf.length
      : 0;
  const secondHalfAvg =
    secondHalf.length > 0
      ? secondHalf.reduce(
          (sum, entry) => sum + (entry.austin || 0) + (entry.charlotte || 0),
          0
        ) / secondHalf.length
      : 0;

  const trendVelocity =
    firstHalfAvg > 0
      ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100
      : 0;

  // Performance forecasting
  const dailyAverage =
    sortedData.reduce(
      (sum, entry) => sum + (entry.austin || 0) + (entry.charlotte || 0),
      0
    ) / sortedData.length;
  const remainingBusinessDays =
    locationMetrics.total.totalDays - locationMetrics.total.elapsedDays;

  const austinDailyAvg =
    sortedData.reduce((sum, entry) => sum + (entry.austin || 0), 0) /
    sortedData.length;
  const charlotteDailyAvg =
    sortedData.reduce((sum, entry) => sum + (entry.charlotte || 0), 0) /
    sortedData.length;

  // Month-end projection with trend adjustment
  const trendMultiplier = 1 + trendVelocity / 100;
  const projectedAustin =
    locationMetrics.austin.revenue +
    austinDailyAvg * trendMultiplier * remainingBusinessDays;
  const projectedCharlotte =
    locationMetrics.charlotte.revenue +
    charlotteDailyAvg * trendMultiplier * remainingBusinessDays;
  const projectedCombined = projectedAustin + projectedCharlotte;

  // Calculate confidence based on data consistency
  const dailyTotals = sortedData.map(
    (entry) => (entry.austin || 0) + (entry.charlotte || 0)
  );
  const variance =
    dailyTotals.reduce((sum, val) => sum + Math.pow(val - dailyAverage, 2), 0) /
    dailyTotals.length;
  const standardDeviation = Math.sqrt(variance);
  const coefficientOfVariation =
    dailyAverage > 0 ? standardDeviation / dailyAverage : 1;
  const confidence = Math.max(
    0,
    Math.min(100, (1 - coefficientOfVariation) * 100)
  );

  // Risk analysis
  const currentAttainment = locationMetrics.total.attainment;
  const targetGap = 100 - currentAttainment;
  const revenueAtRisk =
    targetGap > 0 ? locationMetrics.total.monthlyTarget * (targetGap / 100) : 0;
  const daysToRecovery =
    revenueAtRisk > 0 && dailyAverage > 0
      ? Math.ceil(revenueAtRisk / dailyAverage)
      : 0;

  // Identify critical factors
  const criticalFactors: string[] = [];
  if (currentAttainment < 85)
    criticalFactors.push("Performance significantly below target");
  if (trendVelocity < -5) criticalFactors.push("Declining performance trend");
  if (confidence < 60) criticalFactors.push("High performance variability");
  if (locationMetrics.austin.attainment < 80)
    criticalFactors.push("Austin location underperforming");
  if (locationMetrics.charlotte.attainment < 80)
    criticalFactors.push("Charlotte location underperforming");

  // Operational efficiency analysis
  const peakDays = sortedData
    .filter((entry) => {
      const total = (entry.austin || 0) + (entry.charlotte || 0);
      const dailyTarget =
        (targetSettings?.dailyTargets?.austin || TARGETS.austin) +
        (targetSettings?.dailyTargets?.charlotte || TARGETS.charlotte);
      return total >= dailyTarget * 1.1; // 110% of target
    })
    .map((entry) => entry.date);

  const underperformingDays = sortedData
    .filter((entry) => {
      const total = (entry.austin || 0) + (entry.charlotte || 0);
      const dailyTarget =
        (targetSettings?.dailyTargets?.austin || TARGETS.austin) +
        (targetSettings?.dailyTargets?.charlotte || TARGETS.charlotte);
      return total < dailyTarget * 0.85; // Below 85% of target
    })
    .map((entry) => entry.date);

  // Strategic recommendations
  const immediate: string[] = [];
  const shortTerm: string[] = [];
  const longTerm: string[] = [];

  if (currentAttainment < 90) {
    immediate.push("Implement daily performance reviews and action plans");
    immediate.push("Focus on high-impact revenue opportunities");
  }
  if (trendVelocity < -3) {
    immediate.push("Investigate root causes of declining performance");
    shortTerm.push("Develop performance recovery strategy");
  }
  if (
    locationMetrics.austin.attainment <
    locationMetrics.charlotte.attainment - 10
  ) {
    shortTerm.push("Analyze and address Austin location performance gaps");
  }
  if (
    locationMetrics.charlotte.attainment <
    locationMetrics.austin.attainment - 10
  ) {
    shortTerm.push("Analyze and address Charlotte location performance gaps");
  }

  longTerm.push(
    "Establish predictive analytics for proactive performance management"
  );
  longTerm.push("Develop location-specific optimization strategies");
  longTerm.push(
    "Implement advanced performance tracking and reporting systems"
  );

  // Resource allocation recommendations
  const austinPerformance = locationMetrics.austin.attainment;
  const charlottePerformance = locationMetrics.charlotte.attainment;

  let austinAllocation: "increase" | "maintain" | "decrease" = "maintain";
  let charlotteAllocation: "increase" | "maintain" | "decrease" = "maintain";
  let allocationReasoning = "";

  if (austinPerformance < charlottePerformance - 15) {
    austinAllocation = "increase";
    allocationReasoning =
      "Austin requires additional resources due to performance gap";
  } else if (charlottePerformance < austinPerformance - 15) {
    charlotteAllocation = "increase";
    allocationReasoning =
      "Charlotte requires additional resources due to performance gap";
  } else if (currentAttainment > 110) {
    allocationReasoning =
      "Strong performance across both locations - maintain current allocation";
  } else {
    allocationReasoning =
      "Balanced resource allocation recommended based on current performance levels";
  }

  // Determine risk level
  let riskLevel: "low" | "medium" | "high" = "low";
  if (
    currentAttainment < 85 ||
    trendVelocity < -5 ||
    criticalFactors.length > 2
  ) {
    riskLevel = "high";
  } else if (
    currentAttainment < 95 ||
    trendVelocity < 0 ||
    criticalFactors.length > 0
  ) {
    riskLevel = "medium";
  }

  // Generate key insight
  let keyInsight = "";
  if (currentAttainment > 110) {
    keyInsight =
      "Exceptional performance - focus on sustaining momentum and scaling success factors";
  } else if (currentAttainment > 100) {
    keyInsight =
      "On track to meet targets - monitor consistency and optimize for growth";
  } else if (currentAttainment > 90) {
    keyInsight =
      "Close to target - tactical adjustments needed to ensure month-end success";
  } else {
    keyInsight =
      "Performance below expectations - immediate intervention required";
  }

  return {
    executiveSummary: {
      currentPerformance: currentAttainment,
      monthlyProjection:
        (projectedCombined / locationMetrics.total.monthlyTarget) * 100,
      riskLevel,
      keyInsight,
      actionRequired: riskLevel !== "low" || currentAttainment < 95,
    },
    performanceForecasting: {
      monthEndProjection: {
        austin: projectedAustin,
        charlotte: projectedCharlotte,
        combined: projectedCombined,
        confidence,
      },
      quarterProjection: {
        revenue: projectedCombined * 3, // Simple quarterly projection
        attainment:
          ((projectedCombined * 3) /
            (locationMetrics.total.monthlyTarget * 3)) *
          100,
        confidence: Math.max(0, confidence - 20), // Lower confidence for longer projections
      },
      trendAnalysis: {
        direction:
          trendVelocity > 2
            ? "improving"
            : trendVelocity < -2
            ? "declining"
            : "stable",
        velocity: Math.abs(trendVelocity),
        sustainability:
          confidence > 80 ? "high" : confidence > 60 ? "medium" : "low",
      },
    },
    riskAnalysis: {
      revenueAtRisk,
      daysToRecovery,
      criticalFactors,
      mitigation: [
        "Increase daily performance monitoring",
        "Implement targeted improvement initiatives",
        "Optimize resource allocation based on performance data",
        "Establish early warning systems for performance deviations",
      ],
    },
    competitivePositioning: {
      marketShare: {
        austin:
          (locationMetrics.austin.revenue / locationMetrics.total.revenue) *
          100,
        charlotte:
          (locationMetrics.charlotte.revenue / locationMetrics.total.revenue) *
          100,
      },
      growthRate: trendVelocity,
      benchmarkComparison:
        currentAttainment > 105
          ? "above"
          : currentAttainment > 95
          ? "at"
          : "below",
    },
    operationalEfficiency: {
      revenuePerDay: dailyAverage,
      consistency: confidence,
      peakPerformanceDays: peakDays.slice(-5), // Last 5 peak days
      underperformingDays: underperformingDays.slice(-5), // Last 5 underperforming days
    },
    strategicRecommendations: {
      immediate,
      shortTerm,
      longTerm,
      resourceAllocation: {
        austin: austinAllocation,
        charlotte: charlotteAllocation,
        reasoning: allocationReasoning,
      },
    },
  };
};

// Calculate Business Intelligence Metrics for Advanced Reporting
export const calculateBusinessIntelligence = (
  data: RevenueData[],
  targetSettings: TargetSettings
): {
  performanceMetrics: {
    averageDailyRevenue: number;
    peakDayRevenue: number;
    consistencyScore: number;
    growthRate: number;
    efficiency: number;
  };
  locationAnalysis: {
    austin: {
      contribution: number;
      growth: number;
      consistency: number;
      efficiency: number;
    };
    charlotte: {
      contribution: number;
      growth: number;
      consistency: number;
      efficiency: number;
    };
  };
  timeSeriesAnalysis: {
    weeklyTrends: Array<{
      week: string;
      revenue: number;
      attainment: number;
      growth: number;
    }>;
    monthlyPatterns: Array<{
      dayOfMonth: number;
      averageRevenue: number;
      attainmentRate: number;
    }>;
  };
  predictiveIndicators: {
    probabilityOfTarget: number;
    expectedVariance: number;
    riskFactors: string[];
    opportunities: string[];
  };
} => {
  if (!data || data.length === 0) {
    return {
      performanceMetrics: {
        averageDailyRevenue: 0,
        peakDayRevenue: 0,
        consistencyScore: 0,
        growthRate: 0,
        efficiency: 0,
      },
      locationAnalysis: {
        austin: { contribution: 0, growth: 0, consistency: 0, efficiency: 0 },
        charlotte: {
          contribution: 0,
          growth: 0,
          consistency: 0,
          efficiency: 0,
        },
      },
      timeSeriesAnalysis: {
        weeklyTrends: [],
        monthlyPatterns: [],
      },
      predictiveIndicators: {
        probabilityOfTarget: 0,
        expectedVariance: 0,
        riskFactors: ["Insufficient data"],
        opportunities: ["Establish comprehensive data collection"],
      },
    };
  }

  const sortedData = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Performance metrics
  const dailyTotals = sortedData.map(
    (entry) => (entry.austin || 0) + (entry.charlotte || 0)
  );
  const averageDailyRevenue =
    dailyTotals.reduce((sum, val) => sum + val, 0) / dailyTotals.length;
  const peakDayRevenue = Math.max(...dailyTotals);

  const variance =
    dailyTotals.reduce(
      (sum, val) => sum + Math.pow(val - averageDailyRevenue, 2),
      0
    ) / dailyTotals.length;
  const standardDeviation = Math.sqrt(variance);
  const consistencyScore =
    averageDailyRevenue > 0
      ? Math.max(0, (1 - standardDeviation / averageDailyRevenue) * 100)
      : 0;

  // Calculate growth rate (comparing first and last weeks)
  const firstWeek = sortedData.slice(0, 5);
  const lastWeek = sortedData.slice(-5);
  const firstWeekAvg =
    firstWeek.reduce(
      (sum, entry) => sum + (entry.austin || 0) + (entry.charlotte || 0),
      0
    ) / firstWeek.length;
  const lastWeekAvg =
    lastWeek.reduce(
      (sum, entry) => sum + (entry.austin || 0) + (entry.charlotte || 0),
      0
    ) / lastWeek.length;
  const growthRate =
    firstWeekAvg > 0 ? ((lastWeekAvg - firstWeekAvg) / firstWeekAvg) * 100 : 0;

  // Efficiency calculation (revenue per target ratio)
  const dailyTarget =
    (targetSettings?.dailyTargets?.austin || TARGETS.austin) +
    (targetSettings?.dailyTargets?.charlotte || TARGETS.charlotte);
  const efficiency =
    dailyTarget > 0 ? (averageDailyRevenue / dailyTarget) * 100 : 0;

  // Location analysis
  const austinRevenues = sortedData.map((entry) => entry.austin || 0);
  const charlotteRevenues = sortedData.map((entry) => entry.charlotte || 0);

  const austinTotal = austinRevenues.reduce((sum, val) => sum + val, 0);
  const charlotteTotal = charlotteRevenues.reduce((sum, val) => sum + val, 0);
  const totalRevenue = austinTotal + charlotteTotal;

  const austinAvg = austinTotal / austinRevenues.length;
  const charlotteAvg = charlotteTotal / charlotteRevenues.length;

  // Calculate location consistency
  const austinVariance =
    austinRevenues.reduce((sum, val) => sum + Math.pow(val - austinAvg, 2), 0) /
    austinRevenues.length;
  const charlotteVariance =
    charlotteRevenues.reduce(
      (sum, val) => sum + Math.pow(val - charlotteAvg, 2),
      0
    ) / charlotteRevenues.length;

  const austinConsistency =
    austinAvg > 0
      ? Math.max(0, (1 - Math.sqrt(austinVariance) / austinAvg) * 100)
      : 0;
  const charlotteConsistency =
    charlotteAvg > 0
      ? Math.max(0, (1 - Math.sqrt(charlotteVariance) / charlotteAvg) * 100)
      : 0;

  // Calculate location growth
  const austinFirstWeek =
    firstWeek.reduce((sum, entry) => sum + (entry.austin || 0), 0) /
    firstWeek.length;
  const austinLastWeek =
    lastWeek.reduce((sum, entry) => sum + (entry.austin || 0), 0) /
    lastWeek.length;
  const austinGrowth =
    austinFirstWeek > 0
      ? ((austinLastWeek - austinFirstWeek) / austinFirstWeek) * 100
      : 0;

  const charlotteFirstWeek =
    firstWeek.reduce((sum, entry) => sum + (entry.charlotte || 0), 0) /
    firstWeek.length;
  const charlotteLastWeek =
    lastWeek.reduce((sum, entry) => sum + (entry.charlotte || 0), 0) /
    lastWeek.length;
  const charlotteGrowth =
    charlotteFirstWeek > 0
      ? ((charlotteLastWeek - charlotteFirstWeek) / charlotteFirstWeek) * 100
      : 0;

  // Time series analysis
  const weeklyTrends = [];
  for (let i = 0; i < sortedData.length; i += 5) {
    const weekData = sortedData.slice(i, i + 5);
    if (weekData.length > 0) {
      const weekRevenue = weekData.reduce(
        (sum, entry) => sum + (entry.austin || 0) + (entry.charlotte || 0),
        0
      );
      const weekAttainment =
        (weekRevenue / (dailyTarget * weekData.length)) * 100;
      const prevWeekRevenue =
        i > 0
          ? sortedData
              .slice(Math.max(0, i - 5), i)
              .reduce(
                (sum, entry) =>
                  sum + (entry.austin || 0) + (entry.charlotte || 0),
                0
              )
          : 0;
      const weekGrowth =
        prevWeekRevenue > 0
          ? ((weekRevenue - prevWeekRevenue) / prevWeekRevenue) * 100
          : 0;

      weeklyTrends.push({
        week: `Week ${Math.floor(i / 5) + 1}`,
        revenue: weekRevenue,
        attainment: weekAttainment,
        growth: weekGrowth,
      });
    }
  }

  // Monthly patterns (day of month analysis)
  const monthlyPatterns = [];
  const dayGroups: { [key: number]: number[] } = {};

  sortedData.forEach((entry) => {
    const day = new Date(entry.date).getDate();
    if (!dayGroups[day]) dayGroups[day] = [];
    dayGroups[day].push((entry.austin || 0) + (entry.charlotte || 0));
  });

  Object.entries(dayGroups).forEach(([day, revenues]) => {
    const avgRevenue =
      revenues.reduce((sum, val) => sum + val, 0) / revenues.length;
    const attainmentRate = (avgRevenue / dailyTarget) * 100;
    monthlyPatterns.push({
      dayOfMonth: parseInt(day),
      averageRevenue: avgRevenue,
      attainmentRate,
    });
  });

  // Predictive indicators
  const currentPerformance = efficiency;
  const probabilityOfTarget = Math.min(100, Math.max(0, currentPerformance));
  const expectedVariance = standardDeviation;

  const riskFactors = [];
  const opportunities = [];

  if (consistencyScore < 70) riskFactors.push("High performance variability");
  if (growthRate < 0) riskFactors.push("Declining performance trend");
  if (efficiency < 90) riskFactors.push("Below-target efficiency");

  if (peakDayRevenue > dailyTarget * 1.2)
    opportunities.push("Replicate peak performance strategies");
  if (austinGrowth > charlotteGrowth + 5)
    opportunities.push("Apply Austin growth strategies to Charlotte");
  if (charlotteGrowth > austinGrowth + 5)
    opportunities.push("Apply Charlotte growth strategies to Austin");

  return {
    performanceMetrics: {
      averageDailyRevenue,
      peakDayRevenue,
      consistencyScore,
      growthRate,
      efficiency,
    },
    locationAnalysis: {
      austin: {
        contribution: totalRevenue > 0 ? (austinTotal / totalRevenue) * 100 : 0,
        growth: austinGrowth,
        consistency: austinConsistency,
        efficiency:
          (austinAvg /
            (targetSettings?.dailyTargets?.austin || TARGETS.austin)) *
          100,
      },
      charlotte: {
        contribution:
          totalRevenue > 0 ? (charlotteTotal / totalRevenue) * 100 : 0,
        growth: charlotteGrowth,
        consistency: charlotteConsistency,
        efficiency:
          (charlotteAvg /
            (targetSettings?.dailyTargets?.charlotte || TARGETS.charlotte)) *
          100,
      },
    },
    timeSeriesAnalysis: {
      weeklyTrends,
      monthlyPatterns: monthlyPatterns.sort(
        (a, b) => a.dayOfMonth - b.dayOfMonth
      ),
    },
    predictiveIndicators: {
      probabilityOfTarget,
      expectedVariance,
      riskFactors,
      opportunities,
    },
  };
};

// Comprehensive data validation and consistency checker
export const validateDataConsistency = (
  data: RevenueData[],
  targetSettings: TargetSettings,
  filters: {
    timeFrame: TimeFrame;
    location: string;
    startDate?: string | null;
    endDate?: string | null;
  }
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    totalRecords: number;
    filteredRecords: number;
    dateRange: { start: string; end: string };
    monthlyGoalConsistency: boolean;
    targetCalculationAccuracy: boolean;
  };
} => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic data validation
  if (!data || data.length === 0) {
    errors.push("No revenue data available");
    return {
      isValid: false,
      errors,
      warnings,
      summary: {
        totalRecords: 0,
        filteredRecords: 0,
        dateRange: { start: "", end: "" },
        monthlyGoalConsistency: false,
        targetCalculationAccuracy: false,
      },
    };
  }

  // Filter data using our optimized function
  const filteredData = filterDataByTimeFrame(
    data,
    filters.timeFrame,
    undefined,
    targetSettings,
    filters.startDate,
    filters.endDate,
    filters.location
  );

  // Calculate metrics using our period-aware function for accurate validation
  const metrics = calculateLocationMetricsForPeriod(
    filteredData,
    targetSettings,
    filters.location,
    filters.timeFrame
  );

  // Validate date consistency
  const dates = filteredData.map((item) => item.date).sort();
  const dateRange = {
    start: dates[0] || "",
    end: dates[dates.length - 1] || "",
  };

  // Check for data gaps in business days
  if (dates.length > 1) {
    const startDate = new Date(dates[0]);
    const endDate = new Date(dates[dates.length - 1]);
    const expectedBusinessDays = countBusinessDays(startDate, endDate);

    if (filteredData.length < expectedBusinessDays * 0.8) {
      warnings.push(
        `Potential data gaps detected: ${filteredData.length} records vs ${expectedBusinessDays} expected business days`
      );
    }
  }

  // Validate monthly goal consistency using period-aware logic
  let monthlyGoalConsistency = true;

  // Get the relevant period information from the metrics
  const periodInfo = metrics.austin.periodInfo;
  if (periodInfo) {
    const monthlyAdjustment = targetSettings.monthlyAdjustments?.find(
      (adj) =>
        adj.month === periodInfo.relevantMonth &&
        adj.year === periodInfo.relevantYear
    );

    // Check if monthly targets are calculated correctly for the relevant period
    if (monthlyAdjustment && periodInfo.hasMonthlyAdjustment) {
      // Use the actual working days from the calculation, not the theoretical monthly adjustment
      // This accounts for missing data days when location filtering is applied
      const expectedAustinMonthly =
        (monthlyAdjustment.austin ??
          targetSettings.dailyTargets?.austin ??
          TARGETS.austin) * periodInfo.workingDaysInPeriod;
      const expectedCharlotteMonthly =
        (monthlyAdjustment.charlotte ??
          targetSettings.dailyTargets?.charlotte ??
          TARGETS.charlotte) * periodInfo.workingDaysInPeriod;

      if (
        Math.abs(metrics.austin.monthlyTarget - expectedAustinMonthly) > 0.01
      ) {
        errors.push(
          `Austin monthly target mismatch: calculated ${metrics.austin.monthlyTarget}, expected ${expectedAustinMonthly} (daily: ${periodInfo.dailyTargets.austin} × ${periodInfo.workingDaysInPeriod} days)`
        );
        monthlyGoalConsistency = false;
      }

      if (
        Math.abs(metrics.charlotte.monthlyTarget - expectedCharlotteMonthly) >
        0.01
      ) {
        errors.push(
          `Charlotte monthly target mismatch: calculated ${metrics.charlotte.monthlyTarget}, expected ${expectedCharlotteMonthly}`
        );
        monthlyGoalConsistency = false;
      }
    }
  }

  // Validate target calculation accuracy
  let targetCalculationAccuracy = true;

  // Check if attainment percentages make sense
  if (
    metrics.austin.target > 0 &&
    (metrics.austin.attainment < 0 || metrics.austin.attainment > 1000)
  ) {
    warnings.push(
      `Austin attainment percentage seems unusual: ${metrics.austin.attainment.toFixed(
        1
      )}%`
    );
    targetCalculationAccuracy = false;
  }

  if (
    metrics.charlotte.target > 0 &&
    (metrics.charlotte.attainment < 0 || metrics.charlotte.attainment > 1000)
  ) {
    warnings.push(
      `Charlotte attainment percentage seems unusual: ${metrics.charlotte.attainment.toFixed(
        1
      )}%`
    );
    targetCalculationAccuracy = false;
  }

  // Validate business day calculations
  if (metrics.austin.totalDays > 31 || metrics.austin.totalDays < 1) {
    warnings.push(
      `Unusual total business days count: ${metrics.austin.totalDays}`
    );
  }

  if (metrics.austin.elapsedDays > metrics.austin.totalDays) {
    errors.push(
      `Elapsed days (${metrics.austin.elapsedDays}) cannot exceed total days (${metrics.austin.totalDays})`
    );
  }

  // Check for negative revenue values
  const negativeRevenue = filteredData.filter(
    (item) =>
      (item.austin && item.austin < 0) || (item.charlotte && item.charlotte < 0)
  );

  if (negativeRevenue.length > 0) {
    warnings.push(
      `Found ${negativeRevenue.length} records with negative revenue values`
    );
  }

  // Validate location filtering
  if (filters.location === "Austin") {
    const hasCharlotteRevenue = filteredData.some(
      (item) => item.charlotte && item.charlotte > 0
    );
    if (hasCharlotteRevenue) {
      errors.push(
        "Austin location filter not working correctly - Charlotte revenue found"
      );
    }
  } else if (filters.location === "Charlotte") {
    const hasAustinRevenue = filteredData.some(
      (item) => item.austin && item.austin > 0
    );
    if (hasAustinRevenue) {
      errors.push(
        "Charlotte location filter not working correctly - Austin revenue found"
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalRecords: data.length,
      filteredRecords: filteredData.length,
      dateRange,
      monthlyGoalConsistency,
      targetCalculationAccuracy,
    },
  };
};

// Optimized monthly goal recalculation function
export const recalculateMonthlyGoals = (
  targetSettings: TargetSettings,
  forceRecalculate: boolean = false
): TargetSettings => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Create a deep copy of target settings
  const updatedSettings = JSON.parse(
    JSON.stringify(targetSettings)
  ) as TargetSettings;

  // Find current month adjustment
  const currentAdjustmentIndex = updatedSettings.monthlyAdjustments.findIndex(
    (adj) => adj.month === currentMonth && adj.year === currentYear
  );

  if (currentAdjustmentIndex >= 0) {
    const adjustment =
      updatedSettings.monthlyAdjustments[currentAdjustmentIndex];

    if (
      forceRecalculate ||
      !adjustment.workingDays ||
      adjustment.workingDays.length === 0
    ) {
      // Recalculate working days for current month
      const firstDay = new Date(currentYear, currentMonth, 1);
      const lastDay = new Date(currentYear, currentMonth + 1, 0);
      const workingDays: number[] = [];

      let currentDay = new Date(firstDay);
      while (currentDay <= lastDay) {
        // Skip weekends
        if (currentDay.getDay() !== 0 && currentDay.getDay() !== 6) {
          workingDays.push(currentDay.getDate());
        }
        currentDay.setDate(currentDay.getDate() + 1);
      }

      // Update the adjustment
      updatedSettings.monthlyAdjustments[currentAdjustmentIndex] = {
        ...adjustment,
        workingDays,
      };
    }
  }

  return updatedSettings;
};

// Performance-optimized attainment calculation
export const calculateOptimizedAttainment = (
  revenue: number,
  target: number,
  precision: number = 2
): number => {
  if (target === 0) return 0;
  const attainment = (revenue / target) * 100;
  return (
    Math.round(attainment * Math.pow(10, precision)) / Math.pow(10, precision)
  );
};

// Enhanced location metrics calculation with time-period awareness
export const calculateLocationMetricsForPeriod = (
  data: RevenueData[],
  targetSettings?: TargetSettings,
  location?: string,
  timeFrame?: TimeFrame
) => {
  // Early return if no data
  if (!data || data.length === 0) {
    return {
      austin: {
        revenue: 0,
        target: 0,
        monthlyTarget: 0,
        attainment: 0,
        elapsedDays: 0,
        totalDays: 0,
        periodInfo: {
          startDate: "",
          endDate: "",
          periodType: timeFrame || "MTD",
          workingDaysInPeriod: 0,
          actualDataDays: 0,
          relevantMonth: 0,
          relevantYear: 0,
          hasMonthlyAdjustment: false,
          dailyTargets: {
            austin: 0,
            charlotte: 0,
          },
        },
      },
      charlotte: {
        revenue: 0,
        target: 0,
        monthlyTarget: 0,
        attainment: 0,
        elapsedDays: 0,
        totalDays: 0,
        periodInfo: {
          startDate: "",
          endDate: "",
          periodType: timeFrame || "MTD",
          workingDaysInPeriod: 0,
          actualDataDays: 0,
          relevantMonth: 0,
          relevantYear: 0,
          hasMonthlyAdjustment: false,
          dailyTargets: {
            austin: 0,
            charlotte: 0,
          },
        },
      },
      total: {
        revenue: 0,
        target: 0,
        monthlyTarget: 0,
        attainment: 0,
        elapsedDays: 0,
        totalDays: 0,
        periodInfo: {
          startDate: "",
          endDate: "",
          periodType: timeFrame || "MTD",
          workingDaysInPeriod: 0,
          actualDataDays: 0,
          relevantMonth: 0,
          relevantYear: 0,
          hasMonthlyAdjustment: false,
          dailyTargets: {
            austin: 0,
            charlotte: 0,
          },
        },
      },
    };
  }

  // Calculate totals efficiently using reduce
  const { totalAustin, totalCharlotte } = data.reduce(
    (acc, entry) => ({
      totalAustin: acc.totalAustin + (entry.austin || 0),
      totalCharlotte: acc.totalCharlotte + (entry.charlotte || 0),
    }),
    { totalAustin: 0, totalCharlotte: 0 }
  );

  const totalRevenue = totalAustin + totalCharlotte;

  // Get the actual date range from the filtered data with null checks
  const dates = data
    .map((item) => new Date(item.date))
    .sort((a, b) => a.getTime() - b.getTime());

  // Additional safety check for dates array
  if (dates.length === 0) {
    console.warn("No valid dates found in data");
    return {
      austin: {
        revenue: totalAustin,
        target: 0,
        monthlyTarget: 0,
        attainment: 0,
        elapsedDays: 0,
        totalDays: 0,
        periodInfo: {
          startDate: "",
          endDate: "",
          periodType: timeFrame || "MTD",
          workingDaysInPeriod: 0,
          actualDataDays: 0,
          relevantMonth: 0,
          relevantYear: 0,
          hasMonthlyAdjustment: false,
          dailyTargets: { austin: 0, charlotte: 0 },
        },
      },
      charlotte: {
        revenue: totalCharlotte,
        target: 0,
        monthlyTarget: 0,
        attainment: 0,
        elapsedDays: 0,
        totalDays: 0,
        periodInfo: {
          startDate: "",
          endDate: "",
          periodType: timeFrame || "MTD",
          workingDaysInPeriod: 0,
          actualDataDays: 0,
          relevantMonth: 0,
          relevantYear: 0,
          hasMonthlyAdjustment: false,
          dailyTargets: { austin: 0, charlotte: 0 },
        },
      },
      total: {
        revenue: totalRevenue,
        target: 0,
        monthlyTarget: 0,
        attainment: 0,
        elapsedDays: 0,
        totalDays: 0,
        periodInfo: {
          startDate: "",
          endDate: "",
          periodType: timeFrame || "MTD",
          workingDaysInPeriod: 0,
          actualDataDays: 0,
          relevantMonth: 0,
          relevantYear: 0,
          hasMonthlyAdjustment: false,
          dailyTargets: { austin: 0, charlotte: 0 },
        },
      },
    };
  }

  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  // Additional null checks for startDate and endDate
  if (!startDate || !endDate) {
    console.warn("Invalid start or end date");
    return {
      austin: {
        revenue: totalAustin,
        target: 0,
        monthlyTarget: 0,
        attainment: 0,
        elapsedDays: 0,
        totalDays: 0,
        periodInfo: {
          startDate: "",
          endDate: "",
          periodType: timeFrame || "MTD",
          workingDaysInPeriod: 0,
          actualDataDays: 0,
          relevantMonth: 0,
          relevantYear: 0,
          hasMonthlyAdjustment: false,
          dailyTargets: { austin: 0, charlotte: 0 },
        },
      },
      charlotte: {
        revenue: totalCharlotte,
        target: 0,
        monthlyTarget: 0,
        attainment: 0,
        elapsedDays: 0,
        totalDays: 0,
        periodInfo: {
          startDate: "",
          endDate: "",
          periodType: timeFrame || "MTD",
          workingDaysInPeriod: 0,
          actualDataDays: 0,
          relevantMonth: 0,
          relevantYear: 0,
          hasMonthlyAdjustment: false,
          dailyTargets: { austin: 0, charlotte: 0 },
        },
      },
      total: {
        revenue: totalRevenue,
        target: 0,
        monthlyTarget: 0,
        attainment: 0,
        elapsedDays: 0,
        totalDays: 0,
        periodInfo: {
          startDate: "",
          endDate: "",
          periodType: timeFrame || "MTD",
          workingDaysInPeriod: 0,
          actualDataDays: 0,
          relevantMonth: 0,
          relevantYear: 0,
          hasMonthlyAdjustment: false,
          dailyTargets: { austin: 0, charlotte: 0 },
        },
      },
    };
  }

  // Determine the relevant month/year for target calculations
  // For most time frames, we'll use the start date's month/year
  // For MTD, we'll use current month if filtering current month, otherwise the data's month
  let relevantMonth: number;
  let relevantYear: number;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  if (timeFrame === "MTD") {
    // For MTD, check if we're looking at current month or historical month
    const dataMonth = startDate.getMonth();
    const dataYear = startDate.getFullYear();

    if (dataMonth === currentMonth && dataYear === currentYear) {
      // Current month MTD
      relevantMonth = currentMonth;
      relevantYear = currentYear;
    } else {
      // Historical month MTD
      relevantMonth = dataMonth;
      relevantYear = dataYear;
    }
  } else {
    // For other time frames, use the start date's month/year
    relevantMonth = startDate.getMonth();
    relevantYear = startDate.getFullYear();
  }

  // Check for monthly adjustment for the relevant period
  const monthlyAdjustment = targetSettings?.monthlyAdjustments?.find(
    (adj) => adj.month === relevantMonth && adj.year === relevantYear
  );

  // Calculate business days more accurately
  let totalBusinessDays = 0;
  let elapsedBusinessDays = 0;
  let remainingBusinessDays = 0;

  // Use the existing date variables from above
  const currentDay = now.getDate();

  if (timeFrame === 'MTD') {
    if (monthlyAdjustment && monthlyAdjustment.workingDays.length > 0) {
      // Use monthly adjustment working days
      totalBusinessDays = monthlyAdjustment.workingDays.length;
      
      // Count elapsed days (days up to but not including today)
      elapsedBusinessDays = monthlyAdjustment.workingDays.filter(day => day < currentDay).length;
      
      // Count remaining days (including today)
      remainingBusinessDays = monthlyAdjustment.workingDays.filter(day => day >= currentDay).length;
    } else {
      // Calculate standard business days for the month
      const firstDay = new Date(currentYear, currentMonth, 1);
      const lastDay = new Date(currentYear, currentMonth + 1, 0);

      totalBusinessDays = countBusinessDays(firstDay, lastDay);

      // Calculate elapsed business days (up to but not including today)
      const yesterday = new Date(currentYear, currentMonth, currentDay - 1);
      elapsedBusinessDays = countBusinessDays(firstDay, yesterday);

      // Calculate remaining business days (including today)
      remainingBusinessDays = countBusinessDays(
        new Date(currentYear, currentMonth, currentDay),
        lastDay
      );
    }
  } else {
    // For historical data, calculate based on actual date range
    totalBusinessDays = countBusinessDays(startDate, endDate);
    elapsedBusinessDays = totalBusinessDays;
    remainingBusinessDays = 0;
  }

  // Calculate daily targets
  const dailyAustinTarget =
    targetSettings?.dailyTargets?.austin ?? TARGETS.austin;
  const dailyCharlotteTarget =
    targetSettings?.dailyTargets?.charlotte ?? TARGETS.charlotte;

  // Calculate monthly targets (full month)
  const monthlyAustinTarget = dailyAustinTarget * totalBusinessDays;
  const monthlyCharlotteTarget = dailyCharlotteTarget * totalBusinessDays;

  // Calculate on-pace targets based on elapsed days (excluding today)
  const onPaceAustinTarget = dailyAustinTarget * elapsedBusinessDays;
  const onPaceCharlotteTarget = dailyCharlotteTarget * elapsedBusinessDays;

  // Calculate daily pace needed based on remaining revenue and days
  const austinRemainingRevenue = monthlyAustinTarget - totalAustin;
  const charlotteRemainingRevenue = monthlyCharlotteTarget - totalCharlotte;

  const austinDailyPaceNeeded =
    remainingBusinessDays > 0
      ? austinRemainingRevenue / remainingBusinessDays
      : 0;
  const charlotteDailyPaceNeeded =
    remainingBusinessDays > 0
      ? charlotteRemainingRevenue / remainingBusinessDays
      : 0;

  // Calculate attainment percentages using optimized function
  const austinAttainment = calculateOptimizedAttainment(
    totalAustin,
    onPaceAustinTarget
  );
  const charlotteAttainment = calculateOptimizedAttainment(
    totalCharlotte,
    onPaceCharlotteTarget
  );
  const totalOnPaceTarget = onPaceAustinTarget + onPaceCharlotteTarget;
  const totalAttainment = calculateOptimizedAttainment(
    totalRevenue,
    totalOnPaceTarget
  );

  // Apply location filtering
  const getLocationFilteredTarget = (
    austinTarget: number,
    charlotteTarget: number
  ) => {
    if (!location || location === "Combined") {
      return austinTarget + charlotteTarget;
    }
    if (location === "Austin") {
      return austinTarget;
    }
    if (location === "Charlotte") {
      return charlotteTarget;
    }
    return 0;
  };

  const filteredMonthlyTarget = getLocationFilteredTarget(
    monthlyAustinTarget,
    monthlyCharlotteTarget
  );
  const filteredDailyPaceNeeded = getLocationFilteredTarget(
    austinDailyPaceNeeded,
    charlotteDailyPaceNeeded
  );

  // Create period info for detailed breakdown
  const periodInfo = {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
    periodType: timeFrame || "MTD",
    workingDaysInPeriod: totalBusinessDays,
    actualDataDays: data.length,
    elapsedDays: elapsedBusinessDays,
    remainingDays: remainingBusinessDays,
    relevantMonth: relevantMonth,
    relevantYear: relevantYear,
    hasMonthlyAdjustment: !!monthlyAdjustment,
    dailyTargets: {
      austin: dailyAustinTarget,
      charlotte: dailyCharlotteTarget,
    },
  };

  return {
    austin: {
      revenue: totalAustin,
      target: onPaceAustinTarget,
      monthlyTarget: monthlyAustinTarget,
      attainment: austinAttainment,
      elapsedDays: elapsedBusinessDays,
      remainingDays: remainingBusinessDays,
      totalDays: totalBusinessDays,
      dailyPaceNeeded: austinDailyPaceNeeded,
      periodInfo,
    },
    charlotte: {
      revenue: totalCharlotte,
      target: onPaceCharlotteTarget,
      monthlyTarget: monthlyCharlotteTarget,
      attainment: charlotteAttainment,
      elapsedDays: elapsedBusinessDays,
      remainingDays: remainingBusinessDays,
      totalDays: totalBusinessDays,
      dailyPaceNeeded: charlotteDailyPaceNeeded,
      periodInfo,
    },
    total: {
      revenue: totalRevenue,
      target: totalOnPaceTarget,
      monthlyTarget: filteredMonthlyTarget,
      attainment: totalAttainment,
      elapsedDays: elapsedBusinessDays,
      remainingDays: remainingBusinessDays,
      totalDays: totalBusinessDays,
      dailyPaceNeeded: filteredDailyPaceNeeded,
      periodInfo,
    },
  };
};

// Comprehensive validation function to verify summary metrics logic
export const validateSummaryMetricsLogic = (
  data: RevenueData[],
  targetSettings: TargetSettings,
  timeFrame: TimeFrame,
  location?: string,
  startDate?: string | null,
  endDate?: string | null
): {
  isValid: boolean;
  breakdown: {
    timeFrame: TimeFrame;
    filteredDataCount: number;
    dateRange: { start: string; end: string };
    relevantPeriod: { month: number; year: number };
    workingDaysCalculation: {
      method: "monthly_adjustment" | "standard_business_days";
      totalWorkingDays: number;
      elapsedWorkingDays: number;
      workingDaysList?: number[];
    };
    targetCalculation: {
      dailyTargets: { austin: number; charlotte: number };
      periodTargets: { austin: number; charlotte: number };
      onPaceTargets: { austin: number; charlotte: number };
    };
    revenueBreakdown: {
      austin: number;
      charlotte: number;
      total: number;
    };
    attainmentCalculation: {
      austin: { percentage: number; calculation: string };
      charlotte: { percentage: number; calculation: string };
      total: { percentage: number; calculation: string };
    };
  };
  recommendations: string[];
} => {
  const recommendations: string[] = [];

  // Filter data for the specified time frame
  const filteredData = filterDataByTimeFrame(
    data,
    timeFrame,
    undefined,
    targetSettings,
    startDate,
    endDate,
    location
  );

  // Calculate metrics using our enhanced function
  const metrics = calculateLocationMetricsForPeriod(
    filteredData,
    targetSettings,
    location,
    timeFrame
  );

  const periodInfo = metrics.total.periodInfo;

  // Validate the logic step by step
  let isValid = true;

  // 1. Validate filtered data count
  if (filteredData.length === 0) {
    recommendations.push(
      "No data found for the specified time frame and filters"
    );
    isValid = false;
  }

  // 2. Validate date range logic
  const dates = filteredData
    .map((item) => new Date(item.date))
    .sort((a, b) => a.getTime() - b.getTime());
  const actualStartDate = dates[0]?.toISOString().split("T")[0] || "";
  const actualEndDate =
    dates[dates.length - 1]?.toISOString().split("T")[0] || "";

  // 3. Validate working days calculation
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let workingDaysMethod: "monthly_adjustment" | "standard_business_days";
  let expectedWorkingDays = 0;
  let workingDaysList: number[] | undefined;

  const monthlyAdjustment = targetSettings.monthlyAdjustments?.find(
    (adj) =>
      adj.month === periodInfo.relevantMonth &&
      adj.year === periodInfo.relevantYear
  );

  if (monthlyAdjustment && monthlyAdjustment.workingDays.length > 0) {
    workingDaysMethod = "monthly_adjustment";
    workingDaysList = monthlyAdjustment.workingDays;

    if (timeFrame === "MTD") {
      expectedWorkingDays = monthlyAdjustment.workingDays.length;
    } else {
      // Count working days that fall within the filtered date range
      expectedWorkingDays = monthlyAdjustment.workingDays.filter((day) => {
        const dayDate = new Date(
          periodInfo.relevantYear,
          periodInfo.relevantMonth,
          day
        );
        return dayDate >= dates[0] && dayDate <= dates[dates.length - 1];
      }).length;
    }
  } else {
    workingDaysMethod = "standard_business_days";

    if (timeFrame === "MTD") {
      // Count standard business days in the month
      const firstDay = new Date(
        periodInfo.relevantYear,
        periodInfo.relevantMonth,
        1
      );
      const lastDay = new Date(
        periodInfo.relevantYear,
        periodInfo.relevantMonth + 1,
        0
      );
      expectedWorkingDays = countBusinessDays(firstDay, lastDay);
    } else {
      expectedWorkingDays = countBusinessDays(
        dates[0],
        dates[dates.length - 1]
      );
    }
  }

  // Validate working days calculation
  if (periodInfo.workingDaysInPeriod !== expectedWorkingDays) {
    recommendations.push(
      `Working days calculation mismatch: expected ${expectedWorkingDays}, got ${periodInfo.workingDaysInPeriod}`
    );
    isValid = false;
  }

  // 4. Validate target calculations
  const expectedDailyAustinTarget =
    monthlyAdjustment?.austin ??
    targetSettings.dailyTargets?.austin ??
    TARGETS.austin;
  const expectedDailyCharlotteTarget =
    monthlyAdjustment?.charlotte ??
    targetSettings.dailyTargets?.charlotte ??
    TARGETS.charlotte;

  if (periodInfo.dailyTargets.austin !== expectedDailyAustinTarget) {
    recommendations.push(
      `Austin daily target mismatch: expected ${expectedDailyAustinTarget}, got ${periodInfo.dailyTargets.austin}`
    );
    isValid = false;
  }

  if (periodInfo.dailyTargets.charlotte !== expectedDailyCharlotteTarget) {
    recommendations.push(
      `Charlotte daily target mismatch: expected ${expectedDailyCharlotteTarget}, got ${periodInfo.dailyTargets.charlotte}`
    );
    isValid = false;
  }

  // 5. Validate revenue calculations
  const expectedAustinRevenue = filteredData.reduce(
    (sum, entry) => sum + (entry.austin || 0),
    0
  );
  const expectedCharlotteRevenue = filteredData.reduce(
    (sum, entry) => sum + (entry.charlotte || 0),
    0
  );

  if (Math.abs(metrics.austin.revenue - expectedAustinRevenue) > 0.01) {
    recommendations.push(
      `Austin revenue calculation mismatch: expected ${expectedAustinRevenue}, got ${metrics.austin.revenue}`
    );
    isValid = false;
  }

  if (Math.abs(metrics.charlotte.revenue - expectedCharlotteRevenue) > 0.01) {
    recommendations.push(
      `Charlotte revenue calculation mismatch: expected ${expectedCharlotteRevenue}, got ${metrics.charlotte.revenue}`
    );
    isValid = false;
  }

  // 6. Validate attainment calculations
  const austinAttainmentCalc =
    metrics.austin.target > 0
      ? `${metrics.austin.revenue} / ${
          metrics.austin.target
        } * 100 = ${metrics.austin.attainment.toFixed(2)}%`
      : "No target set";
  const charlotteAttainmentCalc =
    metrics.charlotte.target > 0
      ? `${metrics.charlotte.revenue} / ${
          metrics.charlotte.target
        } * 100 = ${metrics.charlotte.attainment.toFixed(2)}%`
      : "No target set";
  const totalAttainmentCalc =
    metrics.total.target > 0
      ? `${metrics.total.revenue} / ${
          metrics.total.target
        } * 100 = ${metrics.total.attainment.toFixed(2)}%`
      : "No target set";

  // Add recommendations for optimization
  if (isValid) {
    recommendations.push("✅ All calculations are correct and consistent");

    if (
      timeFrame === "MTD" &&
      periodInfo.relevantMonth === currentMonth &&
      periodInfo.relevantYear === currentYear
    ) {
      recommendations.push(
        "📊 Current month MTD - showing on-pace targets based on elapsed working days"
      );
    } else {
      recommendations.push(
        "📚 Historical period - showing full period targets"
      );
    }

    if (monthlyAdjustment) {
      recommendations.push(
        "⚙️ Using custom monthly adjustment for working days and targets"
      );
    } else {
      recommendations.push("📅 Using standard business days (Monday-Friday)");
    }
  }

  return {
    isValid,
    breakdown: {
      timeFrame,
      filteredDataCount: filteredData.length,
      dateRange: {
        start: actualStartDate,
        end: actualEndDate,
      },
      relevantPeriod: {
        month: periodInfo.relevantMonth,
        year: periodInfo.relevantYear,
      },
      workingDaysCalculation: {
        method: workingDaysMethod,
        totalWorkingDays: periodInfo.workingDaysInPeriod,
        elapsedWorkingDays: metrics.total.elapsedDays,
        workingDaysList,
      },
      targetCalculation: {
        dailyTargets: {
          austin: periodInfo.dailyTargets.austin,
          charlotte: periodInfo.dailyTargets.charlotte,
        },
        periodTargets: {
          austin: metrics.austin.monthlyTarget,
          charlotte: metrics.charlotte.monthlyTarget,
        },
        onPaceTargets: {
          austin: metrics.austin.target,
          charlotte: metrics.charlotte.target,
        },
      },
      revenueBreakdown: {
        austin: metrics.austin.revenue,
        charlotte: metrics.charlotte.revenue,
        total: metrics.total.revenue,
      },
      attainmentCalculation: {
        austin: {
          percentage: metrics.austin.attainment,
          calculation: austinAttainmentCalc,
        },
        charlotte: {
          percentage: metrics.charlotte.attainment,
          calculation: charlotteAttainmentCalc,
        },
        total: {
          percentage: metrics.total.attainment,
          calculation: totalAttainmentCalc,
        },
      },
    },
    recommendations,
  };
};
