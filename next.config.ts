import type { NextConfig } from "next";
import { randomBytes } from "node:crypto";
import { existsSync, linkSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

// Clave de respaldo para cifrar la cookie de conexión cuando no hay AUTH_COOKIE_SECRET
// (por ejemplo, un fork recién desplegado sin configurar nada). Se genera al azar al
// compilar y Next la deja fija en el código del servidor de ese deploy (env UM_BUILD_SECRET).
// Se guarda en .next/cache, que Vercel conserva entre builds: sobrevive a los redeploys
// mientras no se borre la caché del build. Si cambia, cada dispositivo tiene que volver a
// conectar Notion. Definir AUTH_COOKIE_SECRET lo evita (y entonces no se genera nada).
function buildSecret(): string {
  if (process.env.AUTH_COOKIE_SECRET) return "";
  const file = path.join(process.cwd(), ".next", "cache", "um-auth-secret");
  if (!existsSync(file)) {
    mkdirSync(path.dirname(file), { recursive: true });
    // Next puede evaluar este archivo en varios procesos durante el build: si cada uno
    // generara su propio valor, el proxy y las rutas tendrían claves distintas. linkSync
    // es atómico y falla si el destino ya existe, así que todos terminan leyendo el mismo
    // valor, siempre completo.
    const tmp = `${file}.${process.pid}.tmp`;
    try {
      writeFileSync(tmp, randomBytes(32).toString("base64url"));
      linkSync(tmp, file);
    } catch {
      // EEXIST: otro proceso ya lo creó y se lee el suyo. Si el sistema de archivos no
      // admite hard links, se renombra el temporal (menos estricto, pero no frena el build).
      if (!existsSync(file) && existsSync(tmp)) renameSync(tmp, file);
    } finally {
      try {
        unlinkSync(tmp);
      } catch {
        /* el temporal no llegó a crearse */
      }
    }
  }
  return readFileSync(file, "utf8").trim();
}

const nextConfig: NextConfig = {
  env: {
    UM_BUILD_SECRET: buildSecret(),
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // docs/NOTION-SCHEMA.md is read at runtime by /api/notion/guide (Ajustes →
  // Mantenimiento → "Publicar guía") — without this it doesn't get traced
  // into the serverless function bundle and the route 500s in production.
  outputFileTracingIncludes: {
    "/api/notion/guide": ["./docs/NOTION-SCHEMA.md"],
  },
  experimental: {
    // Optimistic Server Actions feedback
    serverActions: {
      bodySizeLimit: "1mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
