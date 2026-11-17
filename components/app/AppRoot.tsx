"use client";

import { useEffect } from "react";
import { StoreProvider } from "./store";
import { Shell } from "./Shell";
import type { Category, Transaction, Subscription } from "@/lib/notion/schemas";
import { readConnBackup, saveConnBackup } from "@/lib/conn-backup";

export function AppRoot({
  categories,
  transactions,
  subscriptions,
  year,
  loadError,
}: {
  categories: Category[];
  transactions: Transaction[];
  subscriptions?: Subscription[];
  year: number;
  loadError?: boolean;
}) {
  // Un dispositivo que ya estaba conectado crea su copia de respaldo de la conexión
  // (para que Safari en iOS no pida reconectar al cerrar el navegador). Una sola vez.
  useEffect(() => {
    if (readConnBackup()) return;
    (async () => {
      try {
        const r = await fetch("/api/setup/restore");
        if (!r.ok) return;
        const data = (await r.json()) as { value?: unknown };
        if (typeof data.value === "string") saveConnBackup(data.value);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  return (
    <StoreProvider
      initialCategories={categories}
      initialTransactions={transactions}
      initialSubscriptions={subscriptions}
      initialYear={year}
      initialLoadError={loadError}
    >
      <Shell />
    </StoreProvider>
  );
}
