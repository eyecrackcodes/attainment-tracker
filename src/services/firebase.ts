import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  getDatabase,
  ref,
  set,
  onValue,
  off,
  push,
  update,
  get,
} from "firebase/database";
import { RevenueData, DailyTarget, TargetSettings } from "../types/revenue";
import { TARGETS } from "../utils/calculations";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const database = getDatabase(app);

export const revenueService = {
  // Subscribe to revenue data changes
  subscribeToRevenueData: (callback: (data: RevenueData[]) => void) => {
    const revenueRef = ref(database, "revenue");
    onValue(revenueRef, (snapshot) => {
      const data = snapshot.val();
      console.log("Raw revenue data from Firebase:", data);

      if (!data) {
        console.log("No revenue data found in database");
        callback([]);
        return;
      }

      const revenueArray = Object.values(data);
      console.log("Transformed revenue array:", revenueArray);

      // Check if the data has the expected structure
      if (revenueArray.length > 0) {
        const firstItem = revenueArray[0] as any;
        console.log("First item keys:", Object.keys(firstItem));

        // Check if we need to transform property names
        const needsTransform =
          firstItem.austinRevenue !== undefined ||
          firstItem.charlotteRevenue !== undefined;

        if (needsTransform) {
          console.log("Data needs property name transformation");
          const transformedArray = revenueArray.map((item: any) => ({
            id: item.id,
            date: item.date,
            austin:
              item.austinRevenue !== undefined
                ? item.austinRevenue
                : item.austin,
            charlotte:
              item.charlotteRevenue !== undefined
                ? item.charlotteRevenue
                : item.charlotte,
          }));
          console.log("After transformation:", transformedArray);
          callback(transformedArray as RevenueData[]);
        } else {
          callback(revenueArray as RevenueData[]);
        }
      } else {
        callback(revenueArray as RevenueData[]);
      }
    });

    // Return unsubscribe function
    return () => off(revenueRef);
  },

  // Add new revenue entry
  addRevenueEntry: async (entry: RevenueData) => {
    try {
      const revenueRef = ref(database, "revenue");
      const newEntryRef = push(revenueRef);
      await set(newEntryRef, {
        ...entry,
        id: newEntryRef.key,
      });
      return true;
    } catch (error) {
      console.error("Error adding revenue entry:", error);
      return false;
    }
  },

  // Update existing revenue entry
  updateRevenueEntry: async (entryId: string, entry: RevenueData) => {
    try {
      const updates: { [key: string]: any } = {};
      updates[`/revenue/${entryId}`] = entry;
      await update(ref(database), updates);
      return true;
    } catch (error) {
      console.error("Error updating revenue entry:", error);
      return false;
    }
  },

  // Get all revenue data once
  getAllRevenueData: () => {
    return new Promise<RevenueData[]>((resolve, reject) => {
      const revenueRef = ref(database, "revenue");
      onValue(
        revenueRef,
        (snapshot) => {
          const data = snapshot.val();
          const revenueArray = data ? Object.values(data) : [];
          resolve(revenueArray as RevenueData[]);
        },
        {
          onlyOnce: true,
        }
      );
    });
  },

  // Save target settings
  saveTargetSettings: async (settings: TargetSettings): Promise<void> => {
    try {
      const settingsRef = ref(database, "settings/targets");
      await set(settingsRef, settings);
    } catch (error) {
      console.error("Error saving target settings:", error);
      // Instead of throwing the error, we'll handle it gracefully
      // This allows the app to continue functioning even if saving fails
      console.log("Continuing with local settings only");
      // We could show a notification to the user here
    }
  },

  // Get target settings
  getTargetSettings: async (): Promise<TargetSettings> => {
    try {
      const settingsRef = ref(database, "settings/targets");
      const snapshot = await get(settingsRef);

      if (snapshot.exists()) {
        return snapshot.val() as TargetSettings;
      } else {
        // Return default settings if none exist
        return {
          dailyTargets: TARGETS,
          monthlyAdjustments: [],
        };
      }
    } catch (error) {
      console.error("Error getting target settings:", error);
      // Return default settings on error
      return {
        dailyTargets: TARGETS,
        monthlyAdjustments: [],
      };
    }
  },

  // Subscribe to target settings changes
  subscribeToTargetSettings: (callback: (settings: TargetSettings) => void) => {
    // Default settings to use if there's an error or no data
    const defaultSettings: TargetSettings = {
      dailyTargets: TARGETS,
      monthlyAdjustments: [],
    };

    try {
      const settingsRef = ref(database, "settings/targets");

      onValue(
        settingsRef,
        (snapshot) => {
          if (snapshot.exists()) {
            callback(snapshot.val() as TargetSettings);
          } else {
            // Use default settings if none exist
            console.log("No target settings found, using defaults");
            callback(defaultSettings);
          }
        },
        (error) => {
          console.error("Error subscribing to target settings:", error);
          // Use default settings on error
          console.log("Using default target settings due to error");
          callback(defaultSettings);
        }
      );

      // Return unsubscribe function
      return () => off(settingsRef);
    } catch (error) {
      console.error("Exception in subscribeToTargetSettings:", error);
      // Return a no-op unsubscribe function
      callback(defaultSettings);
      return () => {};
    }
  },
};
