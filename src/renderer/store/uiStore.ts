import { create } from "zustand";

interface UIState {
  activeTab: "home" | string; // 'home' ou ID do projeto
  tabHistory: string[]; // Pilha de IDs (o último é o atual)
  toast: {
    message: string;
    type: "info" | "warning" | "error";
    visible: boolean;
    duration: number;
  } | null;
  setActiveTab: (tab: "home" | string) => void;
  removeFromHistory: (tabId: string) => void;
  showToast: (message: string, type?: "info" | "warning" | "error", duration?: number) => void;
  hideToast: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  activeTab: "home",
  tabHistory: ["home"],
  toast: null,
  setActiveTab: (tab) =>
    set((state) => {
      const newHistory = state.tabHistory.filter((id) => id !== tab);
      newHistory.push(tab);
      return { activeTab: tab, tabHistory: newHistory };
    }),
  removeFromHistory: (tabId) =>
    set((state) => ({
      tabHistory: state.tabHistory.filter((id) => id !== tabId),
    })),
  showToast: (message, type = "info", duration = 3000) => {
    set({ toast: { message, type, visible: true, duration } });
  },
  hideToast: () => {
    const currentToast = get().toast;
    if (currentToast) {
      set({ toast: { ...currentToast, visible: false } });
      setTimeout(() => {
        set({ toast: null });
      }, 300); // Wait for fade-out animation
    }
  },
}));
