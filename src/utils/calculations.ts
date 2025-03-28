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
  location?: string
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
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Calculate total business days in the month
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
  let totalBusinessDays = 0;
  let currentDay = new Date(firstDayOfMonth);

  while (currentDay <= lastDayOfMonth) {
    if (currentDay.getDay() !== 0 && currentDay.getDay() !== 6) {
      // Not Sunday (0) or Saturday (6)
      totalBusinessDays++;
    }
    currentDay.setDate(currentDay.getDate() + 1);
  }

  // Calculate elapsed business days (excluding today)
  let elapsedBusinessDays = 0;
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

  // Calculate daily and monthly targets
  const dailyAustinTarget =
    targetSettings?.dailyTargets.austin || TARGETS.austin;
  const dailyCharlotteTarget =
    targetSettings?.dailyTargets.charlotte || TARGETS.charlotte;

  const monthlyAustinTarget = dailyAustinTarget * totalBusinessDays;
  const monthlyCharlotteTarget = dailyCharlotteTarget * totalBusinessDays;

  // Calculate on-pace targets based on elapsed business days
  const onPaceAustinTarget =
    (monthlyAustinTarget / totalBusinessDays) * elapsedBusinessDays;
  const onPaceCharlotteTarget =
    (monthlyCharlotteTarget / totalBusinessDays) * elapsedBusinessDays;

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
      ? onPaceAustinTarget
      : 0;
  const filteredCharlotteTarget =
    !location || location === "Combined" || location === "Charlotte"
      ? onPaceCharlotteTarget
      : 0;
  const filteredTotalTarget = filteredAustinTarget + filteredCharlotteTarget;

  return {
    austin: {
      revenue: totalAustin,
      target: filteredAustinTarget,
      attainment: austinAttainment,
      weeklyTarget: monthlyAustinTarget,
      elapsedDays: elapsedBusinessDays,
      totalDays: totalBusinessDays,
    },
    charlotte: {
      revenue: totalCharlotte,
      target: filteredCharlotteTarget,
      attainment: charlotteAttainment,
      weeklyTarget: monthlyCharlotteTarget,
      elapsedDays: elapsedBusinessDays,
      totalDays: totalBusinessDays,
    },
    total: {
      revenue: totalRevenue,
      target: filteredTotalTarget,
      attainment: totalAttainment,
      weeklyTarget: monthlyAustinTarget + monthlyCharlotteTarget,
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

  console.log("filterDataByTimeFrame called with:", {
    timeFrame,
    attainmentThreshold,
    startDate,
    endDate,
    location,
  });

  // Log the original data dates
  console.log(
    "Original data dates:",
    data.map((item) => item.date)
  );

  // Default target settings if not provided
  const targets = targetSettings || {
    dailyTargets: TARGETS,
    monthlyAdjustments: [],
  };

  // First filter by date
  let filteredData = [...data];

  // Create now date in UTC at start of day
  const now = new Date();
  const nowUTC = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  );
  const yesterdayUTC = new Date(nowUTC);
  yesterdayUTC.setUTCDate(yesterdayUTC.getUTCDate() - 1);

  const createUTCDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split("-").map((num) => parseInt(num));
    return new Date(Date.UTC(year, month - 1, day));
  };

  switch (timeFrame) {
    case "MTD":
      console.log("Filtering by MTD");
      console.log("Current UTC date:", nowUTC);
      filteredData = filteredData.filter((item) => {
        const itemDate = createUTCDate(item.date);
        const isIncluded =
          itemDate.getUTCMonth() === nowUTC.getUTCMonth() &&
          itemDate.getUTCFullYear() === nowUTC.getUTCFullYear() &&
          itemDate <= yesterdayUTC; // Exclude today's data
        console.log(
          `Date ${
            item.date
          } -> UTC: ${itemDate.toISOString()} -> Included: ${isIncluded}`
        );
        return isIncluded;
      });
      console.log("Filtered MTD data:", filteredData);
      break;
    case "last30":
      console.log("Filtering by last30");
      const thirtyDaysAgoUTC = new Date(yesterdayUTC);
      thirtyDaysAgoUTC.setUTCDate(thirtyDaysAgoUTC.getUTCDate() - 30);
      filteredData = filteredData.filter((item) => {
        const itemDate = createUTCDate(item.date);
        return itemDate >= thirtyDaysAgoUTC && itemDate <= yesterdayUTC;
      });
      break;
    case "last90":
      console.log("Filtering by last90");
      const ninetyDaysAgoUTC = new Date(yesterdayUTC);
      ninetyDaysAgoUTC.setUTCDate(ninetyDaysAgoUTC.getUTCDate() - 90);
      filteredData = filteredData.filter((item) => {
        const itemDate = createUTCDate(item.date);
        return itemDate >= ninetyDaysAgoUTC && itemDate <= yesterdayUTC;
      });
      break;
    case "YTD":
      console.log("Filtering by YTD");
      const startOfYearUTC = new Date(Date.UTC(nowUTC.getUTCFullYear(), 0, 1));
      filteredData = filteredData.filter((item) => {
        const itemDate = createUTCDate(item.date);
        return itemDate >= startOfYearUTC && itemDate <= yesterdayUTC;
      });
      break;
    case "custom":
      console.log("Filtering by custom date range");
      if (startDate && endDate) {
        const startUTC = createUTCDate(startDate);
        const endUTC = createUTCDate(endDate);
        filteredData = filteredData.filter((item) => {
          const itemDate = createUTCDate(item.date);
          return itemDate >= startUTC && itemDate <= endUTC;
        });
      }
      break;
    case "all":
      console.log("Using all data");
      filteredData = filteredData.filter((item) => {
        const itemDate = createUTCDate(item.date);
        return itemDate <= yesterdayUTC; // Exclude today's data
      });
      break;
  }

  // Then filter by location if specified
  if (location && location !== "Combined") {
    filteredData = filteredData.map((item) => ({
      ...item,
      austin: location === "Austin" ? item.austin : 0,
      charlotte: location === "Charlotte" ? item.charlotte : 0,
    }));
  }

  // Finally filter by attainment threshold if specified
  if (attainmentThreshold) {
    filteredData = filteredData.filter((item) => {
      const dailyTarget = getTargetForDate(createUTCDate(item.date), targets);
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
    const aDate = createUTCDate(a.date);
    const bDate = createUTCDate(b.date);
    return aDate.getTime() - bDate.getTime();
  });

  console.log("Final filtered data:", filteredData);
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
