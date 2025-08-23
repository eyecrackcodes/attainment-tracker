import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  update,
  off,
} from "firebase/database";

export type SiteKey = "ATX" | "CLT";

export interface LeadEntryInput {
  dateISO: string; // yyyy-mm-dd
  site: SiteKey;
  availableAgents: number;
  totalBillableLeads: number;
  minPerAgent?: number; // default 8
  agentsMeetingMin?: number; // optional manual
  openOrderZeroLeads?: number; // optional manual
  notes?: string;
}

export interface LeadEntryStored {
  availableAgents: number;
  totalBillableLeads: number;
  minPerAgent: number;
  agentsMeetingMin?: number;
  openOrderZeroLeads?: number;
  derived: {
    targetLeads: number;
    attainmentPct: number; // 0..n
    pctAgentsMeetingMin?: number; // 0..1 (only if agentsMeetingMin provided)
  };
  notes?: string;
  savedAt: number;
}

const database = getDatabase();

const pathFor = (dateISO: string, site: SiteKey) =>
  `leadAttainment/${dateISO}/${site}`;

export const leadService = {
  async upsertLeadEntry(input: LeadEntryInput): Promise<void> {
    const minPerAgent = input.minPerAgent ?? 8;
    const targetLeads = minPerAgent * input.availableAgents;
    const attainmentPct =
      targetLeads > 0 ? input.totalBillableLeads / targetLeads : 0;

    const pctAgentsMeetingMin =
      input.agentsMeetingMin != null && input.availableAgents > 0
        ? input.agentsMeetingMin / input.availableAgents
        : undefined;

    const payload: LeadEntryStored = {
      availableAgents: input.availableAgents,
      totalBillableLeads: input.totalBillableLeads,
      minPerAgent,
      agentsMeetingMin: input.agentsMeetingMin,
      openOrderZeroLeads: input.openOrderZeroLeads,
      derived: {
        targetLeads,
        attainmentPct,
        pctAgentsMeetingMin,
      },
      notes: input.notes,
      savedAt: Date.now(),
    };

    await set(ref(database, pathFor(input.dateISO, input.site)), payload);
  },

  async getLeadEntry(
    dateISO: string,
    site: SiteKey
  ): Promise<LeadEntryStored | null> {
    const snap = await get(ref(database, pathFor(dateISO, site)));
    return snap.exists() ? (snap.val() as LeadEntryStored) : null;
  },

  subscribeToDate(
    dateISO: string,
    cb: (data: Record<SiteKey, LeadEntryStored | null>) => void
  ) {
    const atxRef = ref(database, pathFor(dateISO, "ATX"));
    const cltRef = ref(database, pathFor(dateISO, "CLT"));

    const state: Record<SiteKey, LeadEntryStored | null> = {
      ATX: null,
      CLT: null,
    };

    const emit = () => cb({ ...state });

    const unsubATX = onValue(atxRef, (s) => {
      state.ATX = s.exists() ? (s.val() as LeadEntryStored) : null;
      emit();
    });

    const unsubCLT = onValue(cltRef, (s) => {
      state.CLT = s.exists() ? (s.val() as LeadEntryStored) : null;
      emit();
    });

    return () => {
      off(atxRef);
      off(cltRef);
    };
  },

  // Subscribe to a range of dates for historical data
  subscribeToRange(
    startDate: string,
    endDate: string,
    cb: (data: Map<string, Record<SiteKey, LeadEntryStored | null>>) => void
  ) {
    const leadRef = ref(database, "leadAttainment");

    const unsubscribe = onValue(leadRef, (snapshot) => {
      const allData = snapshot.val() || {};
      const rangeData = new Map<
        string,
        Record<SiteKey, LeadEntryStored | null>
      >();

      Object.keys(allData).forEach((date) => {
        if (date >= startDate && date <= endDate) {
          rangeData.set(date, allData[date]);
        }
      });

      cb(rangeData);
    });

    return () => off(leadRef);
  },

  // Handy if you want to store a combined "daily index" under /derived/daily/{date}
  async upsertDailyIndex(dateISO: string, indexValue: number) {
    await update(ref(database, `derived/daily/${dateISO}`), {
      leadSalesIndex: indexValue,
      updatedAt: Date.now(),
    });
  },
};
