import { create } from "zustand";

export const useWalletStore = create((set) => ({
  address: null,
  chainId: null,
  token: null,
  setWallet: (address, chainId) => set({ address, chainId }),
  setToken: (token) => set({ token }),
  disconnect: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("jwt");
    }
    set({ address: null, chainId: null, token: null });
  },
}));
