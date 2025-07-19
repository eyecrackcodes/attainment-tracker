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
  return target > 0 ? (actual / target) * 100 : 0;
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

// Helper function to get all business days in a month
export const getBusinessDaysInMonth = (
  year: number,
  month: number
): number[] => {
  const date = new Date(year, month, 1);
  const days = [];
  while (date.getMonth() === month) {
    if (isBusinessDay(date)) {
      days.push(date.getDate());
    }
    date.setDate(date.getDate() + 1);
  }
  return days;
};

// Shared business days calculation
const calculateBusinessDaysInfo = (
  timeFrame: TimeFrame,
  monthlyAdjustment: MonthlyTargetAdjustment | undefined,
  currentDay: number
): {
  totalBusinessDays: number;
  elapsedBusinessDays: number;
  remainingBusinessDays: number;
} => {
  let totalBusinessDays = 0;
  let elapsedBusinessDays = 0;
  let remainingBusinessDays = 0;

  if (timeFrame === "MTD") {
    if (monthlyAdjustment && monthlyAdjustment.workingDays.length > 0) {
      // Use monthly adjustment working days
      totalBusinessDays = monthlyAdjustment.workingDays.length;

      // Count elapsed days (days up to but not including today)
      elapsedBusinessDays = monthlyAdjustment.workingDays.filter(
        (day) => day < currentDay
      ).length;

      // Count remaining days (including today)
      remainingBusinessDays = monthlyAdjustment.workingDays.filter(
        (day) => day >= currentDay
      ).length;
    } else {
      // Calculate standard business days
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      totalBusinessDays = countBusinessDays(firstDay, lastDay);
      elapsedBusinessDays = countBusinessDays(
        firstDay,
        new Date(now.getFullYear(), now.getMonth(), currentDay - 1)
      );
      remainingBusinessDays = countBusinessDays(
        new Date(now.getFullYear(), now.getMonth(), currentDay),
        lastDay
      );
    }
  }

  return {
    totalBusinessDays,
    elapsedBusinessDays,
    remainingBusinessDays,
  };
};

// Update calculateLocationMetrics to use the shared function
export const calculateLocationMetrics = (
  data: RevenueData[],
  targetSettings?: TargetSettings,
  location?: string,
  timeFrame: TimeFrame = "MTD"
) => {
  if (!data || data.length === 0) {
    const emptyPeriodInfo = {
      startDate: "",
      endDate: "",
      periodType: timeFrame,
      workingDaysInPeriod: 0,
      actualDataDays: 0,
      relevantMonth: 0,
      relevantYear: 0,
      hasMonthlyAdjustment: false,
      dailyTargets: {
        austin: 0,
        charlotte: 0,
      },
    };

    return {
      austin: {
        revenue: 0,
        target: 0,
        monthlyTarget: 0,
        attainment: 0,
        elapsedDays: 0,
        remainingDays: 0,
        totalDays: 0,
        dailyPaceNeeded: 0,
        periodInfo: emptyPeriodInfo,
      },
      charlotte: {
        revenue: 0,
        target: 0,
        monthlyTarget: 0,
        attainment: 0,
        elapsedDays: 0,
        remainingDays: 0,
        totalDays: 0,
        dailyPaceNeeded: 0,
        periodInfo: emptyPeriodInfo,
      },
      total: {
        revenue: 0,
        target: 0,
        monthlyTarget: 0,
        attainment: 0,
        elapsedDays: 0,
        remainingDays: 0,
        totalDays: 0,
        dailyPaceNeeded: 0,
        periodInfo: emptyPeriodInfo,
      },
    };
  }

  // Get current date information
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentDay = now.getDate();

  // Get monthly adjustment if available
  const monthlyAdjustment = targetSettings?.monthlyAdjustments?.find(
    (adj) => adj.month === currentMonth && adj.year === currentYear
  );

  // Calculate business days using shared function
  const businessDaysInfo = calculateBusinessDaysInfo(
    timeFrame,
    monthlyAdjustment,
    currentDay
  );
  const { totalBusinessDays, elapsedBusinessDays, remainingBusinessDays } =
    businessDaysInfo;

  // Calculate daily targets
  let dailyAustinTarget =
    targetSettings?.dailyTargets?.austin ?? TARGETS.austin;
  let dailyCharlotteTarget =
    targetSettings?.dailyTargets?.charlotte ?? TARGETS.charlotte;

  // Apply monthly adjustments if available
  if (monthlyAdjustment) {
    if (monthlyAdjustment.austin !== undefined) {
      dailyAustinTarget = monthlyAdjustment.austin;
    }
    if (monthlyAdjustment.charlotte !== undefined) {
      dailyCharlotteTarget = monthlyAdjustment.charlotte;
    }
  }

  // Calculate monthly targets
  const monthlyAustinTarget = dailyAustinTarget * totalBusinessDays;
  const monthlyCharlotteTarget = dailyCharlotteTarget * totalBusinessDays;

  // Calculate total revenue
  const totalAustin = data.reduce((sum, entry) => sum + (entry.austin || 0), 0);
  const totalCharlotte = data.reduce(
    (sum, entry) => sum + (entry.charlotte || 0),
    0
  );
  const totalRevenue = totalAustin + totalCharlotte;

  // Calculate on-pace targets based on elapsed days (excluding today)
  const onPaceAustinTarget = dailyAustinTarget * elapsedBusinessDays;
  const onPaceCharlotteTarget = dailyCharlotteTarget * elapsedBusinessDays;

  // Calculate daily pace needed based on remaining revenue and days
  const austinDailyPaceNeeded =
    remainingBusinessDays > 0
      ? (monthlyAustinTarget - totalAustin) / remainingBusinessDays
      : 0;
  const charlotteDailyPaceNeeded =
    remainingBusinessDays > 0
      ? (monthlyCharlotteTarget - totalCharlotte) / remainingBusinessDays
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
  const filteredDailyPaceNeeded = getLocationFilteredTarget(
    austinDailyPaceNeeded,
    charlotteDailyPaceNeeded
  );

  // Get date range from data
  const dates = data
    .map((item) => new Date(item.date))
    .sort((a, b) => a.getTime() - b.getTime());
  const startDate = dates[0]?.toISOString().split("T")[0] || "";
  const endDate = dates[dates.length - 1]?.toISOString().split("T")[0] || "";

  // Create period info
  const periodInfo = {
    startDate,
    endDate,
    periodType: timeFrame,
    workingDaysInPeriod: totalBusinessDays,
    actualDataDays: data.length,
    relevantMonth: currentMonth,
    relevantYear: currentYear,
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
  const weekBoundaries: Array<{
    start: Date;
    end: Date;
    label: string;
  }> = [];

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
      (week: { start: Date; end: Date }) =>
        entryDate >= week.start && entryDate <= week.end
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

export const calculateMonthlyTrends = (
  data: RevenueData[],
  targetSettings: TargetSettings
) => {
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
        austinTarget: 0,
        charlotteTarget: 0,
        count: 0,
        date: date.toISOString().split("T")[0],
        agentCount: 0,
      };
    }

    const dailyTarget = getTargetForDate(date, targetSettings);
    const monthlyAdjustment = targetSettings.monthlyAdjustments.find(
      (adj) => adj.month === month && adj.year === year
    );

    // Sum up daily values
    acc[key].austin += entry.austin || 0;
    acc[key].charlotte += entry.charlotte || 0;
    acc[key].austinTarget += dailyTarget.austin;
    acc[key].charlotteTarget += dailyTarget.charlotte;
    if (monthlyAdjustment?.agentCount) {
      acc[key].agentCount = monthlyAdjustment.agentCount;
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
    const monthlyAustinTarget = month.austinTarget;
    const monthlyCharlotteTarget = month.charlotteTarget;

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
      // Increase threshold to 1500% to accommodate transition period
      if (attainment > 1500) {
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
        riskLevel: "high",
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
        quarterProjection: {
          revenue: 0,
          attainment: 0,
          confidence: 0,
        },
        trendAnalysis: {
          direction: "stable",
          velocity: 0,
          sustainability: "low",
        },
      },
      riskAnalysis: {
        revenueAtRisk: 0,
        daysToRecovery: 0,
        criticalFactors: ["No data available"],
        mitigation: ["Begin data collection"],
      },
      competitivePositioning: {
        marketShare: {
          austin: 0,
          charlotte: 0,
        },
        growthRate: 0,
        benchmarkComparison: "below",
      },
      operationalEfficiency: {
        revenuePerDay: 0,
        consistency: 0,
        peakPerformanceDays: [],
        underperformingDays: [],
      },
      strategicRecommendations: {
        immediate: ["Establish data collection process"],
        shortTerm: ["Analyze initial trends"],
        longTerm: ["Develop comprehensive strategy"],
        resourceAllocation: {
          austin: "maintain",
          charlotte: "maintain",
          reasoning: "Insufficient data for allocation decisions",
        },
      },
    };
  }

  // Get current date information
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentDay = now.getDate();

  // Filter data for MTD (current month only)
  const mtdData = data.filter((entry) => {
    const entryDate = new Date(entry.date);
    return (
      entryDate.getMonth() === currentMonth &&
      entryDate.getFullYear() === currentYear &&
      entryDate.getDate() <= currentDay
    );
  });

  // If no data for current month, return early
  if (mtdData.length === 0) {
    return {
      executiveSummary: {
        currentPerformance: 0,
        monthlyProjection: 0,
        riskLevel: "high",
        keyInsight: "No data available for current month",
        actionRequired: true,
      },
      performanceForecasting: {
        monthEndProjection: {
          austin: 0,
          charlotte: 0,
          combined: 0,
          confidence: 0,
        },
        quarterProjection: {
          revenue: 0,
          attainment: 0,
          confidence: 0,
        },
        trendAnalysis: {
          direction: "stable",
          velocity: 0,
          sustainability: "low",
        },
      },
      riskAnalysis: {
        revenueAtRisk: 0,
        daysToRecovery: 0,
        criticalFactors: ["No current month data available"],
        mitigation: ["Begin data collection for current month"],
      },
      competitivePositioning: {
        marketShare: {
          austin: 0,
          charlotte: 0,
        },
        growthRate: 0,
        benchmarkComparison: "below",
      },
      operationalEfficiency: {
        revenuePerDay: 0,
        consistency: 0,
        peakPerformanceDays: [],
        underperformingDays: [],
      },
      strategicRecommendations: {
        immediate: ["Begin data collection for current month"],
        shortTerm: ["Monitor daily performance"],
        longTerm: ["Establish consistent tracking"],
        resourceAllocation: {
          austin: "maintain",
          charlotte: "maintain",
          reasoning: "No current month data for allocation decisions",
        },
      },
    };
  }

  // Get monthly adjustment if available
  const monthlyAdjustment = targetSettings?.monthlyAdjustments?.find(
    (adj) => adj.month === currentMonth && adj.year === currentYear
  );

  // Calculate business days using shared function
  const businessDaysInfo = calculateBusinessDaysInfo(
    "MTD",
    monthlyAdjustment,
    currentDay
  );
  const { totalBusinessDays, elapsedBusinessDays, remainingBusinessDays } =
    businessDaysInfo;

  // Get location metrics using MTD data
  const locationMetrics = calculateLocationMetrics(
    mtdData,
    targetSettings,
    undefined,
    "MTD"
  );

  // Calculate current performance (attainment)
  const currentPerformance = locationMetrics.total.attainment;

  // Sort MTD data chronologically
  const sortedData = [...mtdData].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Calculate recent performance (last 5 business days from MTD data)
  const recentData = sortedData.slice(-5);
  const recentPerformance =
    recentData.length > 0
      ? recentData.reduce(
          (sum, entry) => sum + (entry.austin || 0) + (entry.charlotte || 0),
          0
        ) / recentData.length
      : 0;

  // Calculate trend velocity (performance change rate)
  const last10Days = sortedData.slice(-10);
  const firstHalf = last10Days.slice(0, 5);
  const secondHalf = last10Days.slice(5);

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

  // Calculate daily averages with more weight on recent performance
  const recentWeight = 0.7; // 70% weight on recent performance
  const historicalWeight = 0.3; // 30% weight on historical performance

  const historicalAustinAvg =
    sortedData.length > 0
      ? sortedData.reduce((sum, entry) => sum + (entry.austin || 0), 0) /
        sortedData.length
      : 0;
  const historicalCharlotteAvg =
    sortedData.length > 0
      ? sortedData.reduce((sum, entry) => sum + (entry.charlotte || 0), 0) /
        sortedData.length
      : 0;

  const recentAustinAvg =
    recentData.length > 0
      ? recentData.reduce((sum, entry) => sum + (entry.austin || 0), 0) /
        recentData.length
      : 0;
  const recentCharlotteAvg =
    recentData.length > 0
      ? recentData.reduce((sum, entry) => sum + (entry.charlotte || 0), 0) /
        recentData.length
      : 0;

  const weightedAustinAvg =
    recentAustinAvg * recentWeight + historicalAustinAvg * historicalWeight;
  const weightedCharlotteAvg =
    recentCharlotteAvg * recentWeight +
    historicalCharlotteAvg * historicalWeight;

  // Apply trend adjustment (capped at ±10%)
  const cappedTrendVelocity = Math.max(Math.min(trendVelocity, 10), -10);
  const trendMultiplier = 1 + cappedTrendVelocity / 100;

  // Project end of month revenue
  const projectedAustin =
    locationMetrics.austin.revenue +
    weightedAustinAvg * trendMultiplier * remainingBusinessDays;
  const projectedCharlotte =
    locationMetrics.charlotte.revenue +
    weightedCharlotteAvg * trendMultiplier * remainingBusinessDays;
  const projectedCombined = projectedAustin + projectedCharlotte;

  // Calculate month-end projection attainment
  const monthEndProjectionAttainment =
    locationMetrics.total.monthlyTarget > 0
      ? (projectedCombined / locationMetrics.total.monthlyTarget) * 100
      : 0;

  // Calculate confidence based on multiple factors
  const performanceStability = calculatePerformanceStability(sortedData);
  const historicalAccuracy = calculateHistoricalAccuracy(
    mtdData,
    targetSettings
  );
  const daysRemaining = remainingBusinessDays / totalBusinessDays;

  // Confidence decreases as more days remain and if performance is unstable
  const baseConfidence = 100 - daysRemaining * 30; // Max 30% reduction based on days remaining
  const stabilityImpact = performanceStability * 0.3; // Max 30% impact from stability
  const accuracyImpact = historicalAccuracy * 0.4; // Max 40% impact from historical accuracy

  const confidence = Math.min(
    Math.max(Math.round(baseConfidence + stabilityImpact + accuracyImpact), 30),
    95
  );

  // Determine risk level based on multiple factors
  const riskLevel = determineRiskLevel(
    currentPerformance,
    monthEndProjectionAttainment,
    performanceStability,
    confidence
  );

  // Generate key insight
  const keyInsight = generateKeyInsight(
    currentPerformance,
    monthEndProjectionAttainment,
    trendVelocity,
    riskLevel
  );

  // Calculate risk analysis metrics
  const targetGap = 100 - currentPerformance;
  const revenueAtRisk =
    targetGap > 0 ? locationMetrics.total.monthlyTarget * (targetGap / 100) : 0;
  const dailyAverage =
    sortedData.length > 0
      ? sortedData.reduce(
          (sum, entry) => sum + (entry.austin || 0) + (entry.charlotte || 0),
          0
        ) / sortedData.length
      : 0;
  const daysToRecovery =
    revenueAtRisk > 0 && dailyAverage > 0
      ? Math.ceil(revenueAtRisk / dailyAverage)
      : 0;

  // Identify critical factors
  const criticalFactors: string[] = [];
  if (currentPerformance < 85)
    criticalFactors.push("Performance significantly below target");
  if (trendVelocity < -5) criticalFactors.push("Declining performance trend");
  if (confidence < 60) criticalFactors.push("High performance variability");
  if (locationMetrics.austin.attainment < 80)
    criticalFactors.push("Austin location underperforming");
  if (locationMetrics.charlotte.attainment < 80)
    criticalFactors.push("Charlotte location underperforming");

  // Generate recommendations based on performance
  const immediate: string[] = [];
  const shortTerm: string[] = [];
  const longTerm: string[] = [];

  if (currentPerformance < 90) {
    immediate.push("Implement daily performance reviews");
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

  longTerm.push("Establish predictive analytics for proactive management");
  longTerm.push("Develop location-specific optimization strategies");

  return {
    executiveSummary: {
      currentPerformance,
      monthlyProjection: monthEndProjectionAttainment,
      riskLevel,
      keyInsight,
      actionRequired: riskLevel === "high",
    },
    performanceForecasting: {
      monthEndProjection: {
        austin: projectedAustin,
        charlotte: projectedCharlotte,
        combined: projectedCombined,
        confidence,
      },
      quarterProjection: calculateQuarterProjection(mtdData, targetSettings),
      trendAnalysis: {
        direction:
          trendVelocity > 2
            ? "improving"
            : trendVelocity < -2
            ? "declining"
            : "stable",
        velocity: trendVelocity,
        sustainability: determineTrendSustainability(
          performanceStability,
          confidence
        ),
      },
    },
    riskAnalysis: {
      revenueAtRisk,
      daysToRecovery,
      criticalFactors:
        criticalFactors.length > 0 ? criticalFactors : ["Performance on track"],
      mitigation: [
        "Increase daily performance monitoring",
        "Implement targeted improvement initiatives",
        "Optimize resource allocation",
      ],
    },
    competitivePositioning: {
      marketShare: {
        austin:
          locationMetrics.total.revenue > 0
            ? (locationMetrics.austin.revenue / locationMetrics.total.revenue) *
              100
            : 0,
        charlotte:
          locationMetrics.total.revenue > 0
            ? (locationMetrics.charlotte.revenue /
                locationMetrics.total.revenue) *
              100
            : 0,
      },
      growthRate: trendVelocity,
      benchmarkComparison:
        currentPerformance > 105
          ? "above"
          : currentPerformance > 95
          ? "at"
          : "below",
    },
    operationalEfficiency: {
      revenuePerDay: dailyAverage,
      consistency: performanceStability,
      peakPerformanceDays: [],
      underperformingDays: [],
    },
    strategicRecommendations: {
      immediate:
        immediate.length > 0
          ? immediate
          : ["Maintain current performance levels"],
      shortTerm:
        shortTerm.length > 0 ? shortTerm : ["Continue monitoring trends"],
      longTerm:
        longTerm.length > 0 ? longTerm : ["Develop long-term growth strategy"],
      resourceAllocation: {
        austin:
          locationMetrics.austin.attainment <
          locationMetrics.charlotte.attainment - 15
            ? "increase"
            : "maintain",
        charlotte:
          locationMetrics.charlotte.attainment <
          locationMetrics.austin.attainment - 15
            ? "increase"
            : "maintain",
        reasoning:
          currentPerformance > 100
            ? "Strong performance across both locations"
            : "Focus resources on underperforming areas",
      },
    },
  };
};

// Helper function to calculate performance stability (0-100)
const calculatePerformanceStability = (data: RevenueData[]): number => {
  if (data.length < 2) return 0;

  const dailyRevenues = data.map(
    (entry) => (entry.austin || 0) + (entry.charlotte || 0)
  );
  const mean =
    dailyRevenues.reduce((sum, val) => sum + val, 0) / dailyRevenues.length;

  if (mean === 0) return 0;

  const variance =
    dailyRevenues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    dailyRevenues.length;
  const standardDeviation = Math.sqrt(variance);
  const coefficientOfVariation = standardDeviation / mean;

  // Convert to stability score (lower CV = higher stability)
  const stability = Math.max(
    0,
    Math.min(100, (1 - coefficientOfVariation) * 100)
  );

  console.log("Performance Stability Calculation:", {
    dataPoints: data.length,
    mean: mean.toFixed(2),
    standardDeviation: standardDeviation.toFixed(2),
    coefficientOfVariation: coefficientOfVariation.toFixed(4),
    stabilityScore: stability.toFixed(1),
  });

  return stability;
};

// Helper function to calculate historical projection accuracy (0-100)
const calculateHistoricalAccuracy = (
  data: RevenueData[],
  targetSettings: TargetSettings
): number => {
  // Start with a base accuracy of 80% if we don't have enough historical data
  if (data.length < 10) return 80;

  // Calculate the average accuracy of our daily projections vs actuals
  const accuracyScores = data.slice(1).map((entry, index) => {
    const projected = (data[index].austin || 0) + (data[index].charlotte || 0);
    const actual = (entry.austin || 0) + (entry.charlotte || 0);
    const accuracy = Math.min(Math.abs(projected - actual) / projected, 1);
    return (1 - accuracy) * 100;
  });

  return Math.max(
    0,
    Math.min(
      100,
      accuracyScores.reduce((sum, score) => sum + score, 0) /
        accuracyScores.length
    )
  );
};

// Helper function to determine risk level
const determineRiskLevel = (
  currentPerformance: number,
  projectedPerformance: number,
  stability: number,
  confidence: number
): "low" | "medium" | "high" => {
  if (
    currentPerformance >= 95 &&
    projectedPerformance >= 100 &&
    stability >= 70 &&
    confidence >= 80
  ) {
    return "low";
  } else if (
    currentPerformance >= 85 &&
    projectedPerformance >= 90 &&
    stability >= 50 &&
    confidence >= 60
  ) {
    return "medium";
  }
  return "high";
};

// Helper function to determine trend sustainability
const determineTrendSustainability = (
  stability: number,
  confidence: number
): "high" | "medium" | "low" => {
  const sustainabilityScore = (stability + confidence) / 2;
  if (sustainabilityScore >= 75) return "high";
  if (sustainabilityScore >= 50) return "medium";
  return "low";
};

// Helper function to generate key insight
const generateKeyInsight = (
  currentPerformance: number,
  projectedPerformance: number,
  trendVelocity: number,
  riskLevel: "low" | "medium" | "high"
): string => {
  if (riskLevel === "low") {
    return `Strong performance trending ${
      trendVelocity > 0 ? "upward" : "stable"
    } with high confidence in projections.`;
  } else if (riskLevel === "medium") {
    return `Moderate performance with ${
      trendVelocity > 0 ? "positive" : "concerning"
    } trends requiring attention.`;
  }
  return `Performance below target with significant risks requiring immediate action.`;
};

// Helper function to calculate quarter projection
const calculateQuarterProjection = (
  data: RevenueData[],
  targetSettings: TargetSettings
): {
  revenue: number;
  attainment: number;
  confidence: number;
} => {
  // Implement quarterly projection logic here
  // This is a placeholder implementation
  return {
    revenue: 0,
    attainment: 0,
    confidence: 0,
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
        austin: {
          contribution: 0,
          growth: 0,
          consistency: 0,
          efficiency: 0,
        },
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
        riskFactors: [],
        opportunities: [],
      },
    };
  }

  // Sort data chronologically
  const sortedData = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Performance Metrics
  const dailyRevenues = sortedData.map(
    (entry) => (entry.austin || 0) + (entry.charlotte || 0)
  );
  const averageDailyRevenue =
    dailyRevenues.reduce((sum, val) => sum + val, 0) / dailyRevenues.length;
  const peakDayRevenue = Math.max(...dailyRevenues);

  // Calculate consistency score using coefficient of variation
  const mean = averageDailyRevenue;
  const variance =
    dailyRevenues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    dailyRevenues.length;
  const standardDeviation = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? standardDeviation / mean : 1;
  const consistencyScore = Math.max(
    0,
    Math.min(100, (1 - coefficientOfVariation) * 100)
  );

  console.log("Business Intelligence - Consistency Calculation:", {
    averageDailyRevenue: averageDailyRevenue.toFixed(2),
    standardDeviation: standardDeviation.toFixed(2),
    coefficientOfVariation: coefficientOfVariation.toFixed(4),
    consistencyScore: consistencyScore.toFixed(1),
  });

  // Growth rate calculation
  const firstWeekAvg =
    sortedData.slice(0, 7).reduce((sum, entry) => {
      return sum + (entry.austin || 0) + (entry.charlotte || 0);
    }, 0) / Math.min(7, sortedData.length);

  const lastWeekAvg =
    sortedData.slice(-7).reduce((sum, entry) => {
      return sum + (entry.austin || 0) + (entry.charlotte || 0);
    }, 0) / Math.min(7, sortedData.length);

  const growthRate =
    firstWeekAvg > 0 ? ((lastWeekAvg - firstWeekAvg) / firstWeekAvg) * 100 : 0;

  // Efficiency calculation (revenue per target ratio)
  const totalRevenue = dailyRevenues.reduce((sum, val) => sum + val, 0);
  const totalTarget =
    sortedData.length *
    ((targetSettings?.dailyTargets?.austin || TARGETS.austin) +
      (targetSettings?.dailyTargets?.charlotte || TARGETS.charlotte));
  const efficiency = totalTarget > 0 ? (totalRevenue / totalTarget) * 100 : 0;

  // Location Analysis
  const austinRevenues = sortedData.map((entry) => entry.austin || 0);
  const charlotteRevenues = sortedData.map((entry) => entry.charlotte || 0);

  const austinTotal = austinRevenues.reduce((sum, val) => sum + val, 0);
  const charlotteTotal = charlotteRevenues.reduce((sum, val) => sum + val, 0);

  const locationAnalysis = {
    austin: {
      contribution: totalRevenue > 0 ? (austinTotal / totalRevenue) * 100 : 0,
      growth: calculateLocationGrowth(austinRevenues),
      consistency: calculateLocationConsistency(austinRevenues),
      efficiency: calculateLocationEfficiency(
        austinTotal,
        sortedData.length *
          (targetSettings?.dailyTargets?.austin || TARGETS.austin)
      ),
    },
    charlotte: {
      contribution:
        totalRevenue > 0 ? (charlotteTotal / totalRevenue) * 100 : 0,
      growth: calculateLocationGrowth(charlotteRevenues),
      consistency: calculateLocationConsistency(charlotteRevenues),
      efficiency: calculateLocationEfficiency(
        charlotteTotal,
        sortedData.length *
          (targetSettings?.dailyTargets?.charlotte || TARGETS.charlotte)
      ),
    },
  };

  // Time Series Analysis
  const weeklyTrends = calculateWeeklyTrends(sortedData, targetSettings);
  const monthlyPatterns = calculateMonthlyPatterns(sortedData, targetSettings);

  // Predictive Indicators
  const predictiveIndicators = calculatePredictiveIndicators(
    sortedData,
    targetSettings,
    consistencyScore,
    growthRate
  );

  return {
    performanceMetrics: {
      averageDailyRevenue,
      peakDayRevenue,
      consistencyScore,
      growthRate,
      efficiency,
    },
    locationAnalysis,
    timeSeriesAnalysis: {
      weeklyTrends,
      monthlyPatterns,
    },
    predictiveIndicators,
  };
};

// Helper functions for location analysis
const calculateLocationGrowth = (revenues: number[]): number => {
  if (revenues.length < 2) return 0;
  const firstWeek = revenues.slice(0, 7);
  const lastWeek = revenues.slice(-7);
  const firstAvg =
    firstWeek.reduce((sum, val) => sum + val, 0) / firstWeek.length;
  const lastAvg = lastWeek.reduce((sum, val) => sum + val, 0) / lastWeek.length;
  return firstAvg > 0 ? ((lastAvg - firstAvg) / firstAvg) * 100 : 0;
};

const calculateLocationConsistency = (revenues: number[]): number => {
  if (revenues.length < 2) return 0;
  const mean = revenues.reduce((sum, val) => sum + val, 0) / revenues.length;
  if (mean === 0) return 0;
  const variance =
    revenues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    revenues.length;
  const cv = Math.sqrt(variance) / mean;
  return Math.max(0, Math.min(100, (1 - cv) * 100));
};

const calculateLocationEfficiency = (
  actualRevenue: number,
  targetRevenue: number
): number => {
  return targetRevenue > 0 ? (actualRevenue / targetRevenue) * 100 : 0;
};

// Helper function to calculate weekly trends
const calculateWeeklyTrends = (
  data: RevenueData[],
  targetSettings: TargetSettings
): Array<{
  week: string;
  revenue: number;
  attainment: number;
  growth: number;
}> => {
  const trends = [];
  const dailyTarget =
    (targetSettings?.dailyTargets?.austin || TARGETS.austin) +
    (targetSettings?.dailyTargets?.charlotte || TARGETS.charlotte);

  for (let i = 0; i < data.length; i += 7) {
    const weekData = data.slice(i, i + 7);
    if (weekData.length > 0) {
      const weekRevenue = weekData.reduce(
        (sum, entry) => sum + (entry.austin || 0) + (entry.charlotte || 0),
        0
      );
      const weekAttainment =
        (weekRevenue / (dailyTarget * weekData.length)) * 100;

      const prevWeekRevenue =
        i > 0
          ? data
              .slice(Math.max(0, i - 7), i)
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

      trends.push({
        week: `Week ${Math.floor(i / 7) + 1}`,
        revenue: weekRevenue,
        attainment: weekAttainment,
        growth: weekGrowth,
      });
    }
  }

  return trends;
};

// Helper function to calculate monthly patterns
const calculateMonthlyPatterns = (
  data: RevenueData[],
  targetSettings: TargetSettings
): Array<{
  dayOfMonth: number;
  averageRevenue: number;
  attainmentRate: number;
}> => {
  const patterns: Array<{
    dayOfMonth: number;
    averageRevenue: number;
    attainmentRate: number;
  }> = [];
  const dayGroups: { [key: number]: number[] } = {};
  const dailyTarget =
    (targetSettings?.dailyTargets?.austin || TARGETS.austin) +
    (targetSettings?.dailyTargets?.charlotte || TARGETS.charlotte);

  data.forEach((entry) => {
    const day = new Date(entry.date).getDate();
    if (!dayGroups[day]) dayGroups[day] = [];
    dayGroups[day].push((entry.austin || 0) + (entry.charlotte || 0));
  });

  Object.entries(dayGroups).forEach(([day, revenues]) => {
    const avgRevenue =
      revenues.reduce((sum, val) => sum + val, 0) / revenues.length;
    const attainmentRate = (avgRevenue / dailyTarget) * 100;

    patterns.push({
      dayOfMonth: parseInt(day),
      averageRevenue: avgRevenue,
      attainmentRate: attainmentRate,
    });
  });

  return patterns.sort((a, b) => a.dayOfMonth - b.dayOfMonth);
};

// Helper function to calculate predictive indicators
const calculatePredictiveIndicators = (
  data: RevenueData[],
  targetSettings: TargetSettings,
  consistencyScore: number,
  growthRate: number
): {
  probabilityOfTarget: number;
  expectedVariance: number;
  riskFactors: string[];
  opportunities: string[];
} => {
  const dailyTarget =
    (targetSettings?.dailyTargets?.austin || TARGETS.austin) +
    (targetSettings?.dailyTargets?.charlotte || TARGETS.charlotte);

  const dailyRevenues = data.map(
    (entry) => (entry.austin || 0) + (entry.charlotte || 0)
  );
  const avgRevenue =
    dailyRevenues.reduce((sum, val) => sum + val, 0) / dailyRevenues.length;
  const efficiency = (avgRevenue / dailyTarget) * 100;

  const probabilityOfTarget = Math.min(100, Math.max(0, efficiency));
  const variance =
    dailyRevenues.reduce((sum, val) => sum + Math.pow(val - avgRevenue, 2), 0) /
    dailyRevenues.length;
  const expectedVariance = Math.sqrt(variance);

  const riskFactors = [];
  const opportunities = [];

  if (consistencyScore < 70) riskFactors.push("High performance variability");
  if (growthRate < 0) riskFactors.push("Declining performance trend");
  if (efficiency < 90) riskFactors.push("Below-target efficiency");

  const peakRevenue = Math.max(...dailyRevenues);
  if (peakRevenue > dailyTarget * 1.2) {
    opportunities.push("Replicate peak performance strategies");
  }

  // Check location-specific opportunities
  const austinRevenues = data.map((entry) => entry.austin || 0);
  const charlotteRevenues = data.map((entry) => entry.charlotte || 0);
  const austinGrowth = calculateLocationGrowth(austinRevenues);
  const charlotteGrowth = calculateLocationGrowth(charlotteRevenues);

  if (austinGrowth > charlotteGrowth + 5) {
    opportunities.push("Apply Austin growth strategies to Charlotte");
  }
  if (charlotteGrowth > austinGrowth + 5) {
    opportunities.push("Apply Charlotte growth strategies to Austin");
  }

  return {
    probabilityOfTarget,
    expectedVariance,
    riskFactors,
    opportunities,
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

  // Filter data using our function
  const filteredData = filterDataByTimeFrame(
    data,
    filters.timeFrame,
    undefined,
    targetSettings,
    filters.startDate,
    filters.endDate,
    filters.location
  );

  // Calculate metrics
  const metrics = calculateLocationMetrics(
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

  // Check for data gaps
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

  // Validate monthly goal consistency
  let monthlyGoalConsistency = true;
  const periodInfo = metrics.total.periodInfo;

  if (periodInfo) {
    const monthlyAdjustment = targetSettings.monthlyAdjustments?.find(
      (adj) =>
        adj.month === periodInfo.relevantMonth &&
        adj.year === periodInfo.relevantYear
    );

    if (monthlyAdjustment && periodInfo.hasMonthlyAdjustment) {
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
          `Austin monthly target mismatch: calculated ${metrics.austin.monthlyTarget}, expected ${expectedAustinMonthly}`
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

export const forecastWithLinearRegression = (
  monthlyTrends: any[],
  futureAgentCounts: { [key: string]: number }
) => {
  const historicalData = monthlyTrends.filter(
    (entry) => entry.currentYear && entry.agentCount
  );

  if (historicalData.length < 2) {
    return []; // Not enough data for regression
  }

  // Calculate revenue per agent
  const dataForRegression = historicalData.map((entry) => ({
    agents: entry.agentCount,
    revenue: entry.currentYear,
    revenuePerAgent: entry.currentYear / entry.agentCount,
  }));

  // Perform linear regression: y = mx + b
  // where y = revenuePerAgent, x = index (time)
  const n = dataForRegression.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = dataForRegression.reduce(
    (sum, entry) => sum + entry.revenuePerAgent,
    0
  );
  const sumXY = dataForRegression.reduce(
    (sum, entry, index) => sum + index * entry.revenuePerAgent,
    0
  );
  const sumX2 = dataForRegression.reduce(
    (sum, _, index) => sum + index * index,
    0
  );

  const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX); // slope
  const b = (sumY - m * sumX) / n; // intercept

  const forecast = Object.keys(futureAgentCounts).map((key, index) => {
    const [year, monthStr] = key.split("-");
    const month = parseInt(monthStr, 10);
    const futureIndex = n + index;
    const predictedRevenuePerAgent = m * futureIndex + b;
    const agentCount = futureAgentCounts[key];
    const predictedRevenue = predictedRevenuePerAgent * agentCount;

    return {
      year: parseInt(year, 10),
      month,
      agentCount,
      predictedRevenue,
    };
  });

  return forecast;
};
