import { create } from 'zustand';

interface UIState {
  activeTab: 'home' | string; // 'home' ou ID do projeto
  toast: { message: string; type: 'info' | 'warning' | 'error'; visible: boolean; duration: number } | null;
  setActiveTab: (tab: 'home' | string) => void;
  showToast: (message: string, type?: 'info' | 'warning' | 'error', duration?: number) => void;
  hideToast: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  activeTab: 'home',
  toast: null,
  setActiveTab: (tab) => set({ activeTab: tab }),
  showToast: (message, type = 'info', duration = 3000) => {
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
