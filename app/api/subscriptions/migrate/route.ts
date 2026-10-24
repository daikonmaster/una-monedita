import { NextResponse } from "next/server";
import { ensureSubscriptionsSchema } from "@/lib/notion/subscriptions";
import { ensureTransactionsSchema } from "@/lib/notion/transactions";
import { getNotionCredsFromRequest } from "@/lib/auth/session";
import { withNotionErrors } from "@/lib/notion/errors";

export const dynamic = "force-dynamic";

// Respaldo manual de lo que /api/setup ya hace al conectar: agrega las
// propiedades que falten a la DB Subscriptions y a Transactions (PaymentMethod)
// (idempotente, ver ensureSubscriptionsSchema / ensureTransactionsSchema).
export async function POST(request: Request) {
  const creds = await getNotionCredsFromRequest(request);
  if (!creds) return NextResponse.json({ error: "Notion no configurado" }, { status: 401 });

  return withNotionErrors("subscriptions:migrate", "No se pudo preparar Notion", async () => {
    const subs = await ensureSubscriptionsSchema(creds.dbIds.subscriptions, creds.token);
    const tx = await ensureTransactionsSchema(creds.dbIds.transactions, creds.token);
    return NextResponse.json({ ok: true, added: [...subs, ...tx] });
  });
}
