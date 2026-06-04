"use client";

import { useEffect } from "react";
import { useWalletStore } from "@/lib/store";

export function AuthHydrate() {
  const setToken = useWalletStore((s) => s.setToken);

  useEffect(() => {
    const token = localStorage.getItem("jwt");
    if (token) setToken(token);
  }, [setToken]);

  return null;
}
