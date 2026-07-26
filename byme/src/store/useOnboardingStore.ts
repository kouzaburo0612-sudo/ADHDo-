import { create } from 'zustand';
import type { GoalCategory } from '../db/types';
import type { GoalConversion, IdentityMvv } from '../lib/ai';

/** オンボーディング中だけ使う下書き状態(確定時にSQLiteへ書き込む) */
export interface DraftGoal {
  title: string;
  category: GoalCategory;
  deadline: string | null;
}

interface OnboardingState {
  identityInput: string;
  valuesInput: string;
  identityMvv: IdentityMvv | null;
  identityFromAi: boolean;
  goals: DraftGoal[];
  conversions: GoalConversion[];
  conversionsFromAi: boolean;

  setIdentityInput: (v: string) => void;
  setValuesInput: (v: string) => void;
  setIdentityMvv: (v: IdentityMvv, fromAi: boolean) => void;
  patchIdentityMvv: (patch: Partial<IdentityMvv>) => void;
  addGoal: (g: DraftGoal) => void;
  removeGoal: (index: number) => void;
  setConversions: (c: GoalConversion[], fromAi: boolean) => void;
  patchConversion: (index: number, affirmation: string) => void;
  reset: () => void;
}

const initial = {
  identityInput: '',
  valuesInput: '',
  identityMvv: null,
  identityFromAi: false,
  goals: [] as DraftGoal[],
  conversions: [] as GoalConversion[],
  conversionsFromAi: false,
};

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  ...initial,
  setIdentityInput: (v) => set({ identityInput: v }),
  setValuesInput: (v) => set({ valuesInput: v }),
  setIdentityMvv: (v, fromAi) => set({ identityMvv: v, identityFromAi: fromAi }),
  patchIdentityMvv: (patch) => {
    const cur = get().identityMvv;
    if (cur) set({ identityMvv: { ...cur, ...patch } });
  },
  addGoal: (g) => set({ goals: [...get().goals, g] }),
  removeGoal: (index) => set({ goals: get().goals.filter((_, i) => i !== index) }),
  setConversions: (c, fromAi) => set({ conversions: c, conversionsFromAi: fromAi }),
  patchConversion: (index, affirmation) =>
    set({
      conversions: get().conversions.map((c, i) => (i === index ? { ...c, affirmation } : c)),
    }),
  reset: () => set(initial),
}));
