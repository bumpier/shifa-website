"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Currency } from "@/config/brand";

const CurrencyContext = createContext<{
  currency: Currency;
  setCurrency: (c: Currency) => void;
}>({ currency: "PKR", setCurrency: () => {} });

export function CurrencyProvider({
  initial,
  children,
}: {
  initial: Currency;
  children: ReactNode;
}) {
  const [currency, setCurrencyState] = useState<Currency>(initial);

  function setCurrency(c: Currency) {
    setCurrencyState(c);
    // Preference cookie (not a credential) — lax so links keep it
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `currency=${c}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
