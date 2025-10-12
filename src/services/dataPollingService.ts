import { snowflakeService } from "./snowflake";
import { leadService, LeadEntryInput } from "./leadService";
import { format, subDays } from "date-fns";
import { DailyLeadMetrics } from "../types/snowflake";

interface PollingConfig {
  intervalMs: number;
  enabled: boolean;
  lastPoll: number | null;
  retryCount: number;
  maxRetries: number;
}

export interface DataSyncStatus {
  snowflake: {
    available: boolean;
    lastSync: number | null;
    error: string | null;
  };
  firebase: {
    available: boolean;
    lastSync: number | null;
    error: string | null;
  };
  activeSource: "snowflake" | "firebase";
}

// Export a type alias for compatibility
export type SyncStatus = DataSyncStatus;

class DataPollingService {
  private pollingConfig: PollingConfig = {
    intervalMs: 3 * 60 * 60 * 1000, // 3 hours
    enabled: false,
    lastPoll: null,
    retryCount: 0,
    maxRetries: 3,
  };

  private syncStatus: DataSyncStatus = {
    snowflake: {
      available: false,
      lastSync: null,
      error: null,
    },
    firebase: {
      available: true,
      lastSync: null,
      error: null,
    },
    activeSource: "firebase",
  };

  private pollingInterval: NodeJS.Timeout | null = null;
  private subscribers = new Set<(status: DataSyncStatus) => void>();

  // Subscribe to sync status updates
  subscribeToStatus(callback: (status: DataSyncStatus) => void): () => void {
    this.subscribers.add(callback);
    // Immediately send current status
    callback(this.syncStatus);

    return () => {
      this.subscribers.delete(callback);
    };
  }

  // Notify all subscribers of status changes
  private notifySubscribers(): void {
    this.subscribers.forEach((callback) => callback(this.syncStatus));
  }

  // Initialize the polling service
  async initialize(autoStart = true): Promise<void> {
    try {
      // Try to connect to Snowflake
      await snowflakeService.initialize();
      this.syncStatus.snowflake.available = true;
      this.syncStatus.snowflake.error = null;
      this.syncStatus.activeSource = "snowflake";

      console.log("DataPollingService: Connected to Snowflake");
    } catch (error) {
      console.error(
        "DataPollingService: Failed to connect to Snowflake, falling back to Firebase",
        error
      );
      this.syncStatus.snowflake.available = false;
      this.syncStatus.snowflake.error = (error as Error).message;
      this.syncStatus.activeSource = "firebase";
    }

    this.notifySubscribers();

    if (autoStart) {
      this.startPolling();
    }
  }

  // Start polling
  startPolling(): void {
    if (this.pollingConfig.enabled) {
      console.log("DataPollingService: Polling already enabled");
      return;
    }

    this.pollingConfig.enabled = true;
    this.poll(); // Initial poll

    // Set up interval
    this.pollingInterval = setInterval(() => {
      this.poll();
    }, this.pollingConfig.intervalMs);

    console.log(
      `DataPollingService: Started polling with ${
        this.pollingConfig.intervalMs / 1000 / 60
      } minute interval`
    );
  }

  // Stop polling
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    this.pollingConfig.enabled = false;
    console.log("DataPollingService: Stopped polling");
  }

  // Perform a single poll
  private async poll(): Promise<void> {
    console.log("DataPollingService: Starting poll...");
    this.pollingConfig.lastPoll = Date.now();

    try {
      if (this.syncStatus.snowflake.available) {
        await this.syncFromSnowflake();
      } else {
        // Try to reconnect to Snowflake
        await this.attemptSnowflakeReconnect();
      }

      this.pollingConfig.retryCount = 0;
    } catch (error) {
      console.error("DataPollingService: Poll failed", error);
      this.pollingConfig.retryCount++;

      if (this.pollingConfig.retryCount >= this.pollingConfig.maxRetries) {
        console.error(
          "DataPollingService: Max retries reached, falling back to Firebase"
        );
        this.syncStatus.snowflake.available = false;
        this.syncStatus.activeSource = "firebase";
        this.notifySubscribers();
      }
    }
  }

  // Sync data from Snowflake to Firebase
  private async syncFromSnowflake(): Promise<void> {
    try {
      // For test data in 2025, use a fixed date range
      // TODO: Update this to use current dates in production
      const endDate = "2025-10-12"; // Test data end date
      const startDate = "2025-07-14"; // Test data start date (90 days before)

      console.log(
        `DataPollingService: Fetching data from ${startDate} to ${endDate}`
      );

      const metrics = await snowflakeService.getDailyLeadMetrics(
        startDate,
        endDate
      );

      // Transform and sync to Firebase
      await this.syncMetricsToFirebase(metrics);

      this.syncStatus.snowflake.lastSync = Date.now();
      this.syncStatus.snowflake.error = null;
      this.notifySubscribers();

      console.log(
        `DataPollingService: Successfully synced ${metrics.length} daily metrics`
      );
    } catch (error) {
      this.syncStatus.snowflake.error = (error as Error).message;
      this.notifySubscribers();
      throw error;
    }
  }

  // Transform Snowflake metrics to Firebase lead entries
  private async syncMetricsToFirebase(
    metrics: DailyLeadMetrics[]
  ): Promise<void> {
    const updates: Promise<void>[] = [];

    for (const metric of metrics) {
      // Calculate agents meeting minimum (8 leads)
      // This is an approximation based on average leads per agent
      const avgLeadsPerAgent = metric.billableLeads / (metric.totalCalls / 10); // Assuming ~10 calls per agent
      const agentsMeetingMin = Math.floor((metric.billableLeads / 8) * 0.7); // 70% estimation

      const leadEntry: LeadEntryInput = {
        dateISO: metric.date,
        site: metric.site,
        availableAgents: Math.ceil(metric.totalCalls / 10), // Estimation
        totalBillableLeads: metric.billableLeads,
        minPerAgent: 8,
        agentsMeetingMin: agentsMeetingMin > 0 ? agentsMeetingMin : undefined,
        notes: `Synced from Snowflake at ${new Date().toISOString()}`,
      };

      updates.push(leadService.upsertLeadEntry(leadEntry));
    }

    // Batch update to Firebase
    await Promise.all(updates);

    this.syncStatus.firebase.lastSync = Date.now();
    this.syncStatus.firebase.error = null;
  }

  // Attempt to reconnect to Snowflake
  private async attemptSnowflakeReconnect(): Promise<void> {
    try {
      await snowflakeService.initialize();
      this.syncStatus.snowflake.available = true;
      this.syncStatus.snowflake.error = null;
      this.syncStatus.activeSource = "snowflake";
      this.notifySubscribers();

      console.log("DataPollingService: Reconnected to Snowflake");

      // Perform sync after reconnection
      await this.syncFromSnowflake();
    } catch (error) {
      // Still can't connect, continue with Firebase
      console.log("DataPollingService: Still unable to connect to Snowflake");
    }
  }

  // Manual refresh
  async manualRefresh(): Promise<void> {
    console.log("DataPollingService: Manual refresh triggered");
    await this.poll();
  }

  // Get current sync status
  getSyncStatus(): DataSyncStatus {
    return { ...this.syncStatus };
  }

  // Set polling interval (for testing or configuration)
  setPollingInterval(minutes: number): void {
    this.pollingConfig.intervalMs = minutes * 60 * 1000;

    // Restart polling with new interval if enabled
    if (this.pollingConfig.enabled) {
      this.stopPolling();
      this.startPolling();
    }
  }

  // Clear Snowflake cache
  clearCache(): void {
    snowflakeService.clearCache();
    console.log("DataPollingService: Cleared Snowflake cache");
  }

  // Cleanup
  async cleanup(): Promise<void> {
    this.stopPolling();
    await snowflakeService.disconnect();
    this.subscribers.clear();
  }
}

// Export singleton instance
export const dataPollingService = new DataPollingService();
