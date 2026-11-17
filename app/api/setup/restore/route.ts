import { NextResponse } from "next/server";
import { z } from "zod";
import {
  readNotionCookie,
  getCookie,
  notionCookieOptions,
  NOTION_COOKIE,
  LEGACY_COOKIE,
} from "@/lib/auth/session";
import { checkRateLimit, clientIp } from "@/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  value: z.string().min(20).max(8000),
});

// Restaura la cookie de conexión desde la copia de localStorage (`um.conn`): Safari en
// iOS borra las cookies al cerrar el navegador. El valor es el mismo JWE que ya emitió
// /api/setup; solo se acepta si descifra bien y fue creado con "recordar". Es pública
// (la cookie falta justamente), así que va con CSRF en el proxy y límite por IP.
export async function POST(request: Request) {
  // segunda capa por si algo se saltea el proxy: solo JSON
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "El contenido debe ser application/json" }, { status: 415 });
  }
  if (!checkRateLimit("restore:" + clientIp(request), 20, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Demasiados intentos. Esperá 15 minutos." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { value } = parsed.data;

  const c = await readNotionCookie(value);
  if (!c || !c.remember) {
    return NextResponse.json(
      { error: "La copia de la conexión ya no sirve", code: "backup_invalid" },
      { status: 401 }
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(NOTION_COOKIE, value, notionCookieOptions(true, new URL(request.url).protocol === "https:"));
  res.cookies.delete(LEGACY_COOKIE);
  return res;
}

// Un dispositivo que ya estaba conectado (cookie vigente y recordada) pide su propio
// valor para crear la copia en localStorage sin tener que reconectar. Solo devuelve
// la cookie que el navegador ya mandó: no expone nada nuevo al propio dispositivo.
export async function GET(request: Request) {
  const raw = getCookie(request.headers.get("cookie") ?? "", NOTION_COOKIE);
  const c = raw ? await readNotionCookie(raw) : null;
  if (!raw || !c || !c.remember) {
    return NextResponse.json({ error: "Sin conexión recordada" }, { status: 404 });
  }
  return NextResponse.json({ value: raw }, { headers: { "Cache-Control": "no-store" } });
}
