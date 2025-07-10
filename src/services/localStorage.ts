import { RevenueData, TargetSettings } from "../types/revenue";
import { TARGETS } from "../utils/calculations";

const REVENUE_DATA_KEY = "attainment_tracker_revenue_data";
const TARGET_SETTINGS_KEY = "attainment_tracker_target_settings";

export const localStorageService = {
  // Revenue Data Methods
  getRevenueData: (): RevenueData[] => {
    try {
      const data = localStorage.getItem(REVENUE_DATA_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Error reading revenue data from localStorage:", error);
      return [];
    }
  },

  saveRevenueData: (data: RevenueData[]): void => {
    try {
      localStorage.setItem(REVENUE_DATA_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Error saving revenue data to localStorage:", error);
    }
  },

  addRevenueEntry: (entry: RevenueData): boolean => {
    try {
      const currentData = localStorageService.getRevenueData();
      
      // Check if entry for this date already exists
      const existingIndex = currentData.findIndex(item => item.date === entry.date);
      
      if (existingIndex >= 0) {
        // Update existing entry
        currentData[existingIndex] = { ...entry, id: currentData[existingIndex].id };
      } else {
        // Add new entry with generated ID
        const newEntry = {
          ...entry,
          id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
        currentData.push(newEntry);
      }
      
      // Sort by date
      currentData.sort((a, b) => a.date.localeCompare(b.date));
      
      localStorageService.saveRevenueData(currentData);
      return true;
    } catch (error) {
      console.error("Error adding revenue entry to localStorage:", error);
      return false;
    }
  },

  // Target Settings Methods
  getTargetSettings: (): TargetSettings => {
    try {
      const data = localStorage.getItem(TARGET_SETTINGS_KEY);
      return data ? JSON.parse(data) : {
        dailyTargets: TARGETS,
        monthlyAdjustments: [],
      };
    } catch (error) {
      console.error("Error reading target settings from localStorage:", error);
      return {
        dailyTargets: TARGETS,
        monthlyAdjustments: [],
      };
    }
  },

  saveTargetSettings: (settings: TargetSettings): void => {
    try {
      localStorage.setItem(TARGET_SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Error saving target settings to localStorage:", error);
    }
  },
}; 