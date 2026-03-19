import { create } from 'zustand';

interface PosStore {
  cartCount: number;
  setCartCount: (n: number) => void;
}

export const usePosStore = create<PosStore>((set) => ({
  cartCount: 0,
  setCartCount: (n) => set({ cartCount: n }),
}));
