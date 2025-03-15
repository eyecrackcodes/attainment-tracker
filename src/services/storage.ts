import { RevenueData, FilterOptions, AppState } from "../types/revenue";
import { TARGETS } from "../utils/calculations";

const STORAGE_KEY = "revenue_dashboard_state";

const defaultFilterOptions: FilterOptions = {
  startDate: null,
  endDate: null,
  location: "Combined",
  timeFrame: "MTD",
  attainmentThreshold: {
    min: 0,
    max: 100,
  },
};

const defaultState: AppState = {
  revenueData: [],
  filterOptions: defaultFilterOptions,
  targets: TARGETS,
};

export const saveState = (state: AppState): void => {
  try {
    const serializedState = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serializedState);
  } catch (err) {
    console.error("Error saving state to localStorage:", err);
  }
};

export const loadState = (): AppState => {
  try {
    const serializedState = localStorage.getItem(STORAGE_KEY);
    if (!serializedState) return defaultState;
    return JSON.parse(serializedState);
  } catch (err) {
    console.error("Error loading state from localStorage:", err);
    return defaultState;
  }
};

export const clearState = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error("Error clearing state from localStorage:", err);
  }
};

export const updateRevenueData = (data: RevenueData[]): void => {
  const currentState = loadState();
  saveState({
    ...currentState,
    revenueData: data,
  });
};

export const updateFilterOptions = (filterOptions: FilterOptions): void => {
  const currentState = loadState();
  saveState({
    ...currentState,
    filterOptions,
  });
};
