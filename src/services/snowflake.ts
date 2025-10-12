// Remove direct Snowflake SDK import - it doesn't work in browsers
import { RevenueData } from "../types/revenue";
import {
  SnowflakeCallRecord,
  DailyLeadMetrics,
  LeadQualityData,
  AgentPerformanceComparison,
  CachedQueryResult,
  SnowflakeConnectionStatus,
} from "../types/snowflake";
import { format, parseISO } from "date-fns";
import { zonedTimeToUtc } from "date-fns-tz";

// API configuration for backend service
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api";

// For direct Snowflake access from browser, we need to use Snowflake's REST API
// or a backend proxy service
const snowflakeConfig = {
  apiUrl: API_BASE_URL,
  // These would be handled by your backend service
  account: import.meta.env.VITE_SNOWFLAKE_ACCOUNT,
  database: import.meta.env.VITE_SNOWFLAKE_DATABASE,
  schema: import.meta.env.VITE_SNOWFLAKE_SCHEMA,
  warehouse: import.meta.env.VITE_SNOWFLAKE_WAREHOUSE,
};

// Validate environment variables
const validateConfig = () => {
  const required = [
    "account",
    "username",
    "password",
    "database",
    "schema",
    "warehouse",
  ];
  const missing = required.filter(
    (key) => !snowflakeConfig[key as keyof typeof snowflakeConfig]
  );
  if (missing.length > 0) {
    throw new Error(`Missing Snowflake configuration: ${missing.join(", ")}`);
  }
};

// Connection status management
let connectionStatus: SnowflakeConnectionStatus = {
  connected: false,
  lastSuccessfulQuery: null,
  lastError: null,
  retryCount: 0,
};

// Cache management
const queryCache = new Map<string, CachedQueryResult<any>>();
const CACHE_TTL = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

// Exponential backoff configuration
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 60000; // 60 seconds
const MAX_RETRIES = 5;

// Initialize connection (check API availability)
const initializeConnection = async (): Promise<void> => {
  if (connectionStatus.connected) {
    return;
  }

  let retryDelay = INITIAL_RETRY_DELAY;

  while (connectionStatus.retryCount < MAX_RETRIES) {
    try {
      // Test API connection
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        console.log("Successfully connected to Snowflake API!");
        connectionStatus.connected = true;
        connectionStatus.lastError = null;
        connectionStatus.retryCount = 0;
        break;
      } else {
        throw new Error(`API returned status ${response.status}`);
      }
    } catch (error) {
      connectionStatus.retryCount++;
      connectionStatus.lastError = (error as Error).message;

      if (connectionStatus.retryCount >= MAX_RETRIES) {
        console.error(
          "Max retries reached. Unable to connect to Snowflake API."
        );
        throw error;
      }

      console.log(`Retrying connection in ${retryDelay / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY);
    }
  }
};

// Execute query via API
const executeQuery = async <T>(
  endpoint: string,
  params: Record<string, any> = {}
): Promise<T[]> => {
  if (!connectionStatus.connected) {
    await initializeConnection();
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, QUERY_SETTINGS.queryTimeout);

  try {
    const queryParams = new URLSearchParams(params).toString();
    const url = `${API_BASE_URL}${endpoint}${
      queryParams ? `?${queryParams}` : ""
    }`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    connectionStatus.lastSuccessfulQuery = Date.now();

    // Limit result size for memory efficiency
    return (data as T[]).slice(0, QUERY_SETTINGS.maxRowsPerQuery);
  } catch (error) {
    clearTimeout(timeout);
    connectionStatus.lastError = (error as Error).message;
    console.error("API query error:", error);
    throw error;
  }
};

// Cache management functions
const getCachedResult = <T>(cacheKey: string): T | null => {
  const cached = queryCache.get(cacheKey);
  if (!cached) return null;

  // Check if cache is expired
  if (Date.now() > cached.expiresAt) {
    queryCache.delete(cacheKey);
    return null;
  }

  return cached.data as T;
};

const setCachedResult = <T>(cacheKey: string, data: T): void => {
  queryCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
    expiresAt: Date.now() + CACHE_TTL,
  });
};

// Clear expired cache entries
const clearExpiredCache = (): void => {
  const now = Date.now();
  for (const [key, value] of queryCache.entries()) {
    if (now > value.expiresAt) {
      queryCache.delete(key);
    }
  }
};

// Query optimization settings
const QUERY_SETTINGS = {
  maxRowsPerQuery: 10000,
  defaultPageSize: 1000,
  maxConcurrentQueries: 3,
  queryTimeout: 30000, // 30 seconds
};

// Query builders with performance optimizations
const buildDailyLeadQuery = (
  startDate: string,
  endDate: string,
  department?: "ATX" | "CLT",
  limit?: number,
  offset?: number
): string => {
  const deptFilter = department
    ? `AND DEPARTMENT = '${department}'`
    : "AND DEPARTMENT IN ('ATX', 'CLT')";
  const limitClause = limit ? `LIMIT ${limit}` : "";
  const offsetClause = offset ? `OFFSET ${offset}` : "";

  return `
    WITH daily_aggregates AS (
      SELECT 
        DATE(CALL_TIMESTAMP_LOCAL) as date,
        DEPARTMENT as site,
        COUNT(*) as total_calls,
        COUNT(CASE WHEN BILLABLE_FLAG = 'Y' THEN 1 END) as billable_leads,
        COUNT(CASE WHEN SALE_MADE_FLAG = 'Y' THEN 1 END) as sales,
        COALESCE(SUM(CASE WHEN SALE_MADE_FLAG = 'Y' THEN ANNUAL_PREMIUM END), 0) as revenue,
        AVG(CALL_DURATION) as avg_call_duration,
        AVG(AGE_YEARS) as avg_age,
        COUNT(CASE WHEN GENDER = 'Male' THEN 1 END) as male_count,
        COUNT(CASE WHEN GENDER = 'Female' THEN 1 END) as female_count,
        COUNT(CASE WHEN SMOKER_CLASSIFICATION = 'Never used' THEN 1 END) as non_smoker_count,
        COUNT(CASE WHEN SMOKER_CLASSIFICATION != 'Never used' THEN 1 END) as smoker_count
      FROM PL_DIC_CALL_SIM
      WHERE AGENT_TYPE != 'AI'
        ${deptFilter}
        AND CALL_TIMESTAMP_LOCAL >= '${startDate}'
        AND CALL_TIMESTAMP_LOCAL < '${endDate}'
      GROUP BY DATE(CALL_TIMESTAMP_LOCAL), DEPARTMENT
    )
    SELECT * FROM daily_aggregates
    ORDER BY date DESC, site
    ${limitClause}
    ${offsetClause}
  `;
};

const buildLeadSourceQuery = (
  startDate: string,
  endDate: string,
  topN: number = 50
): string => {
  return `
    WITH source_aggregates AS (
      SELECT 
        LEAD_SOURCE,
        DEPARTMENT,
        COUNT(*) as total_leads,
        COUNT(CASE WHEN BILLABLE_FLAG = 'Y' THEN 1 END) as billable_leads,
        COUNT(CASE WHEN SALE_MADE_FLAG = 'Y' THEN 1 END) as sales,
        COALESCE(SUM(CASE WHEN SALE_MADE_FLAG = 'Y' THEN ANNUAL_PREMIUM END), 0) as revenue
      FROM PL_DIC_CALL_SIM
      WHERE AGENT_TYPE != 'AI'
        AND DEPARTMENT IN ('ATX', 'CLT')
        AND CALL_TIMESTAMP_LOCAL >= '${startDate}'
        AND CALL_TIMESTAMP_LOCAL < '${endDate}'
        AND LEAD_SOURCE IS NOT NULL
      GROUP BY LEAD_SOURCE, DEPARTMENT
    )
    SELECT * FROM source_aggregates
    ORDER BY revenue DESC
    LIMIT ${topN}
  `;
};

const buildAIComparisonQuery = (startDate: string, endDate: string): string => {
  return `
    SELECT 
      DATE(CALL_TIMESTAMP_LOCAL) as date,
      CASE WHEN AGENT_TYPE = 'AI' THEN 'AI' ELSE 'Human' END as agent_type,
      COUNT(*) as total_calls,
      COUNT(CASE WHEN BILLABLE_FLAG = 'Y' THEN 1 END) as billable_leads,
      AVG(CALL_DURATION) as avg_call_duration,
      COUNT(CASE WHEN SALE_MADE_FLAG = 'Y' THEN 1 END) as sales
    FROM PL_DIC_CALL_SIM
    WHERE CALL_TIMESTAMP_LOCAL >= '${startDate}'
      AND CALL_TIMESTAMP_LOCAL < '${endDate}'
    GROUP BY DATE(CALL_TIMESTAMP_LOCAL), agent_type
    ORDER BY date DESC
  `;
};

export const snowflakeService = {
  // Get connection status
  getConnectionStatus: (): SnowflakeConnectionStatus => ({
    ...connectionStatus,
  }),

  // Initialize the connection
  initialize: async (): Promise<void> => {
    await initializeConnection();
  },

  // Get daily lead metrics with caching and pagination
  getDailyLeadMetrics: async (
    startDate: string,
    endDate: string,
    department?: "ATX" | "CLT",
    options?: { limit?: number; offset?: number }
  ): Promise<DailyLeadMetrics[]> => {
    const cacheKey = `daily_lead_${startDate}_${endDate}_${
      department || "all"
    }_${options?.limit || "all"}_${options?.offset || 0}`;

    // Check cache first
    const cached = getCachedResult<DailyLeadMetrics[]>(cacheKey);
    if (cached) {
      console.log("Returning cached daily lead metrics");
      return cached;
    }

    try {
      clearExpiredCache();

      // Use API endpoint instead of direct query
      const params = {
        startDate,
        endDate,
        ...(department && { department }),
        ...(options?.limit && { limit: options.limit }),
        ...(options?.offset && { offset: options.offset }),
      };

      const rows = await executeQuery<any>("/daily-lead-metrics", params);

      // Transform results
      const metrics: DailyLeadMetrics[] = rows.map((row) => ({
        date: format(new Date(row.DATE), "yyyy-MM-dd"),
        site: row.SITE as "ATX" | "CLT",
        totalCalls: parseInt(row.TOTAL_CALLS),
        billableLeads: parseInt(row.BILLABLE_LEADS),
        sales: parseInt(row.SALES),
        revenue: parseFloat(row.REVENUE) || 0,
        avgCallDuration: parseFloat(row.AVG_CALL_DURATION) || 0,
        conversionRate:
          row.BILLABLE_LEADS > 0 ? (row.SALES / row.BILLABLE_LEADS) * 100 : 0,
        demographics: {
          avgAge: parseFloat(row.AVG_AGE) || 0,
          genderDistribution: {
            Male: parseInt(row.MALE_COUNT) || 0,
            Female: parseInt(row.FEMALE_COUNT) || 0,
          },
          smokerDistribution: {
            "Non-Smoker": parseInt(row.NON_SMOKER_COUNT) || 0,
            Smoker: parseInt(row.SMOKER_COUNT) || 0,
          },
        },
        leadSources: {}, // Will be populated separately if needed
      }));

      // Cache the results
      setCachedResult(cacheKey, metrics);

      return metrics;
    } catch (error) {
      console.error("Error fetching daily lead metrics:", error);
      throw error;
    }
  },

  // Get lead source performance
  getLeadSourceMetrics: async (
    startDate: string,
    endDate: string
  ): Promise<Record<string, any>> => {
    const cacheKey = `lead_source_${startDate}_${endDate}`;

    const cached = getCachedResult<Record<string, any>>(cacheKey);
    if (cached) {
      console.log("Returning cached lead source metrics");
      return cached;
    }

    try {
      const params = { startDate, endDate };
      const rows = await executeQuery<any>("/lead-source-metrics", params);

      // Group by lead source and department
      const metrics: Record<string, any> = {};

      rows.forEach((row) => {
        const key = `${row.LEAD_SOURCE}_${row.DEPARTMENT}`;
        metrics[key] = {
          leadSource: row.LEAD_SOURCE,
          department: row.DEPARTMENT,
          totalLeads: parseInt(row.TOTAL_LEADS),
          billableLeads: parseInt(row.BILLABLE_LEADS),
          sales: parseInt(row.SALES),
          revenue: parseFloat(row.REVENUE) || 0,
          conversionRate:
            row.BILLABLE_LEADS > 0 ? (row.SALES / row.BILLABLE_LEADS) * 100 : 0,
        };
      });

      setCachedResult(cacheKey, metrics);
      return metrics;
    } catch (error) {
      console.error("Error fetching lead source metrics:", error);
      throw error;
    }
  },

  // Get AI vs Human performance comparison
  getAgentPerformanceComparison: async (
    startDate: string,
    endDate: string
  ): Promise<AgentPerformanceComparison[]> => {
    const cacheKey = `agent_comparison_${startDate}_${endDate}`;

    const cached = getCachedResult<AgentPerformanceComparison[]>(cacheKey);
    if (cached) {
      console.log("Returning cached agent performance comparison");
      return cached;
    }

    try {
      const params = { startDate, endDate };
      const rows = await executeQuery<any>("/agent-comparison", params);

      // Group by date
      const comparisonMap = new Map<string, AgentPerformanceComparison>();

      rows.forEach((row) => {
        const date = format(new Date(row.DATE), "yyyy-MM-dd");
        let comparison = comparisonMap.get(date);

        if (!comparison) {
          comparison = {
            date,
            ai: {
              totalCalls: 0,
              billableLeads: 0,
              avgCallDuration: 0,
              conversionRate: 0,
            },
            human: {
              totalCalls: 0,
              billableLeads: 0,
              avgCallDuration: 0,
              conversionRate: 0,
            },
          };
          comparisonMap.set(date, comparison);
        }

        const agentData =
          row.AGENT_TYPE === "AI" ? comparison.ai : comparison.human;
        agentData.totalCalls = parseInt(row.TOTAL_CALLS);
        agentData.billableLeads = parseInt(row.BILLABLE_LEADS);
        agentData.avgCallDuration = parseFloat(row.AVG_CALL_DURATION) || 0;
        agentData.conversionRate =
          row.BILLABLE_LEADS > 0 ? (row.SALES / row.BILLABLE_LEADS) * 100 : 0;
      });

      const comparisons = Array.from(comparisonMap.values());
      setCachedResult(cacheKey, comparisons);

      return comparisons;
    } catch (error) {
      console.error("Error fetching agent performance comparison:", error);
      throw error;
    }
  },

  // Transform to revenue data format for backward compatibility
  transformToRevenueData: (metrics: DailyLeadMetrics[]): RevenueData[] => {
    const revenueMap = new Map<string, RevenueData>();

    metrics.forEach((metric) => {
      let revenue = revenueMap.get(metric.date);
      if (!revenue) {
        revenue = {
          date: metric.date,
          austin: 0,
          charlotte: 0,
        };
        revenueMap.set(metric.date, revenue);
      }

      if (metric.site === "ATX") {
        revenue.austin = metric.revenue;
      } else if (metric.site === "CLT") {
        revenue.charlotte = metric.revenue;
      }
    });

    return Array.from(revenueMap.values()).sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  },

  // Clear cache (useful for manual refresh)
  clearCache: (): void => {
    queryCache.clear();
    console.log("Snowflake query cache cleared");
  },

  // Disconnect from API
  disconnect: async (): Promise<void> => {
    connectionStatus.connected = false;
    console.log("Disconnected from Snowflake API");
  },
};
