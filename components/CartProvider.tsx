"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Currency } from "@/config/brand";

export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  qty: number;
  prices: Record<Currency, string>; // display only — server re-prices at checkout
}

interface CartApi {
  items: CartItem[];
  count: number;
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  hydrated: boolean;
}

const CartContext = createContext<CartApi>({
  items: [],
  count: 0,
  add: () => {},
  setQty: () => {},
  remove: () => {},
  clear: () => {},
  hydrated: false,
});

const STORAGE_KEY = "cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // corrupted cart — start fresh
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const api: CartApi = {
    items,
    hydrated,
    count: items.reduce((n, i) => n + i.qty, 0),
    add(item, qty = 1) {
      setItems((prev) => {
        const existing = prev.find((i) => i.productId === item.productId);
        if (existing) {
          return prev.map((i) =>
            i.productId === item.productId
              ? { ...i, qty: Math.min(50, i.qty + qty) }
              : i
          );
        }
        return [...prev, { ...item, qty: Math.min(50, qty) }];
      });
    },
    setQty(productId, qty) {
      setItems((prev) =>
        qty <= 0
          ? prev.filter((i) => i.productId !== productId)
          : prev.map((i) =>
              i.productId === productId ? { ...i, qty: Math.min(50, qty) } : i
            )
      );
    },
    remove(productId) {
      setItems((prev) => prev.filter((i) => i.productId !== productId));
    },
    clear() {
      setItems([]);
    },
  };

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}
