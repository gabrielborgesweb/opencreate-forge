import { create } from 'zustand';

interface UIState {
  activeTab: 'home' | string; // 'home' ou ID do projeto
  setActiveTab: (tab: 'home' | string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'home',
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
