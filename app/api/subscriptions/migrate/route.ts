import { NextResponse } from "next/server";
import { ensureSubscriptionsSchema } from "@/lib/notion/subscriptions";
import { getNotionCredsFromRequest } from "@/lib/auth/session";
import { withNotionErrors } from "@/lib/notion/errors";

export const dynamic = "force-dynamic";

// Respaldo manual de lo que /api/setup ya hace al conectar: agrega a la DB
// Subscriptions las propiedades que falten (idempotente, ver
// ensureSubscriptionsSchema).
export async function POST(request: Request) {
  const creds = await getNotionCredsFromRequest(request);
  if (!creds) return NextResponse.json({ error: "Notion no configurado" }, { status: 401 });

  return withNotionErrors("subscriptions:migrate", "No se pudo preparar Notion", async () => {
    const added = await ensureSubscriptionsSchema(creds.dbIds.subscriptions, creds.token);
    return NextResponse.json({ ok: true, added });
  });
}
