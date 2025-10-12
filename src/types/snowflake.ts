// Snowflake data types matching PL_DIC_CALL_SIM table schema
export interface SnowflakeCallRecord {
  CALL_UID: string;
  AGENT_TYPE: string | null;
  START_DATE: string | null;
  CALL_TIMESTAMP_LOCAL: string;
  CALL_TIMESTAMP_DEPT_LOCAL: string;
  LEAD_ID: number;
  LEAD_UID: string;
  LEAD_SOURCE: string;
  STATE: string;
  DATE_OF_BIRTH: string;
  AGE_YEARS: number;
  GENDER: string;
  SMOKER_CLASSIFICATION: string;
  ANSWERED_FLAG: string;
  BILLABLE_FLAG: string | null;
  SALE_MADE_FLAG: string;
  PLACED_FLAG: string;
  ANNUAL_PREMIUM: number | null;
  USER_ID: number;
  AGENT_NAME: string;
  MANAGER: string;
  DEPARTMENT: string;
  LICENSED_STATES: string;
  CALL_DURATION: number;
}

// Aggregated data for daily metrics
export interface DailyLeadMetrics {
  date: string;
  site: "ATX" | "CLT";
  totalCalls: number;
  billableLeads: number;
  sales: number;
  revenue: number;
  avgCallDuration: number;
  conversionRate: number;
  demographics: {
    avgAge: number;
    genderDistribution: Record<string, number>;
    smokerDistribution: Record<string, number>;
  };
  leadSources: Record<
    string,
    {
      count: number;
      sales: number;
      revenue: number;
      conversionRate: number;
    }
  >;
}

// Lead quality scoring data
export interface LeadQualityData {
  leadSource: string;
  ageGroup: string;
  smokerStatus: string;
  gender: string;
  totalLeads: number;
  conversions: number;
  conversionRate: number;
  avgPremium: number;
  qualityScore: number; // 0-100
}

// AI vs Human performance metrics
export interface AgentPerformanceComparison {
  date: string;
  ai: {
    totalCalls: number;
    billableLeads: number;
    avgCallDuration: number;
    conversionRate: number;
  };
  human: {
    totalCalls: number;
    billableLeads: number;
    avgCallDuration: number;
    conversionRate: number;
  };
}

// Cache structure
export interface CachedQueryResult<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  query: string;
}

// Connection status
export interface SnowflakeConnectionStatus {
  connected: boolean;
  lastSuccessfulQuery: number | null;
  lastError: string | null;
  retryCount: number;
}
