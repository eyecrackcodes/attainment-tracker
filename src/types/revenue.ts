export interface RevenueData {
  id?: string;
  date: string;
  austin: number;
  charlotte: number;
}

export interface LocationMetric {
  revenue: number;
  target: number;
  percentage: number;
}

export interface LocationMetrics {
  austin: LocationMetric;
  charlotte: LocationMetric;
  combined: LocationMetric;
}

export interface WeeklyMetrics {
  label: string;
  austinRevenue: number;
  charlotteRevenue: number;
  combinedRevenue: number;
  austinTarget: number;
  charlotteTarget: number;
  combinedTarget: number;
  austinAttainment: number;
  charlotteAttainment: number;
  combinedAttainment: number;
}

export interface MonthlyMetrics extends WeeklyMetrics {}

export interface DailyTarget {
  austin: number;
  charlotte: number;
}

export interface MonthlyTargetAdjustment {
  month: number; // 0-11 (January-December)
  year: number;
  workingDays: number[]; // Array of working days (1-31)
  austin?: number; // Optional override for Austin's daily target this month
  charlotte?: number; // Optional override for Charlotte's daily target this month
  agentCount?: number;
}

export interface TargetSettings {
  dailyTargets: DailyTarget;
  monthlyAdjustments: MonthlyTargetAdjustment[];
}

export type Location = "Austin" | "Charlotte" | "Combined";
export type TimeFrame =
  | "MTD"
  | "This Week"
  | "last30"
  | "last90"
  | "YTD"
  | "all"
  | "custom";

export interface FilterOptions {
  startDate: string | null;
  endDate: string | null;
  location: Location;
  timeFrame: TimeFrame;
  attainmentThreshold: {
    min: number;
    max: number;
  };
}

export interface AppState {
  revenueData: RevenueData[];
  filterOptions: FilterOptions;
  targets?: DailyTarget;
  targetSettings?: TargetSettings;
}
