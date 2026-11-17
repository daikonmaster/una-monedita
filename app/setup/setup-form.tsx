"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plug, ExternalLink } from "lucide-react";
import { readConnBackup, saveConnBackup, clearConnBackup } from "@/lib/conn-backup";

const NOTION_TEMPLATE_URL =
  "https://app.notion.com/p/UNA-MONEDITA-copy-3795c48e39b6803da9abf7ab40919b39?source=copy_link";
const NOTION_INTEGRATIONS_URL = "https://www.notion.so/my-integrations";
// Marca que deja un /setup exitoso: si volvemos acá enseguida sin conexión, el
// navegador no guardó la cookie (modo privado, cookies bloqueadas).
const JUST_CONNECTED = "um.justConnected";

export type SetupReason = "missing" | "expired" | "revoked";

const REASON_TEXT: Record<SetupReason, string> = {
  missing: "Conectá tu Notion para entrar.",
  expired: "Tu conexión venció. Volvé a conectar.",
  revoked: "Notion rechazó el token (¿lo regeneraste o quitaste la conexión de la página?). Pegá el nuevo.",
};

const STEPS: { n: number; title: string; body: string }[] = [
  {
    n: 1,
    title: "Duplicá la plantilla",
    body: 'Abrí la plantilla con el botón de arriba y tocá "Duplicar" (arriba a la derecha en Notion). Se copiará "UNA MONEDITA" a tu propia cuenta.',
  },
  {
    n: 2,
    title: "Crea una integración",
    body: 'Entra a notion.so/my-integrations → "New integration". Ponle un nombre (ej. UNA MONEDITA), créala y copia el "Internal Integration Token".',
  },
  {
    n: 3,
    title: "Conecta la integración a tu página",
    body: "En tu página duplicada, arriba a la derecha pulsa el menú ⋯ → Conexiones (Connections) → busca y agrega tu integración.",
  },
  {
    n: 4,
    title: "Copia la URL de tu página",
    body: 'En tu página duplicada pulsa "Compartir" (Share) → "Copiar enlace" (Copy link). Esa es la URL que pegarás abajo.',
  },
  {
    n: 5,
    title: "Conecta",
    body: "Pega el token y la URL en el formulario y pulsa Conectar. La app encontrará tus bases de datos automáticamente.",
  },
];

const inputStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontWeight: 500,
};

function Steps() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {STEPS.map((s) => (
        <div key={s.n} style={{ display: "flex", gap: 12 }}>
          <div aria-hidden="true" style={{ flex: "0 0 auto", minWidth: 32, color: "var(--violet)", fontWeight: 700, fontSize: 13, lineHeight: "18px" }}>
            {"/" + String(s.n).padStart(2, "0")}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 4 }}>{s.title}</div>
            <div className="caption" style={{ lineHeight: 1.45 }}>{s.body}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ConnectFlow() {
  const [token, setToken] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [remember, setRemember] = useState(true);
  // La app instalada (PWA) ya es "este dispositivo": siempre recuerda.
  const [standalone, setStandalone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lee una API del navegador (no existe en el servidor)
    setStandalone(window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notionToken: token.trim(), pageUrl: pageUrl.trim(), remember: standalone || remember }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        // con "recordar" el servidor devuelve el mismo valor cifrado de la cookie: se
        // guarda como respaldo por si Safari la borra al cerrar; sin recordar, no hay copia
        if (typeof data.backup === "string") saveConnBackup(data.backup);
        else clearConnBackup();
        try {
          sessionStorage.setItem(JUST_CONNECTED, String(Date.now()));
        } catch {
          /* ignore */
        }
        // navegación completa: así el servidor lee la cookie recién guardada
        window.location.replace("/");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo conectar. Revisá los datos y probá de nuevo.");
    } catch {
      setError("Error de conexión.");
    }
    setLoading(false);
  }

  const disabled = loading || !token || !pageUrl;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <a href={NOTION_TEMPLATE_URL} target="_blank" rel="noopener noreferrer" className="btn btn-accent btn-block">
          <ExternalLink size={16} strokeWidth={1.75} />
          Abrir plantilla y duplicar
          <span aria-hidden="true">↗</span>
        </a>
        <a href={NOTION_INTEGRATIONS_URL} target="_blank" rel="noopener noreferrer" className="btn btn-block">
          <ExternalLink size={16} strokeWidth={1.75} />
          Crear integración de Notion
          <span aria-hidden="true">↗</span>
        </a>
      </div>

      <Steps />

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label htmlFor="pageUrl" className="eyebrow" style={{ display: "block", marginBottom: 8 }}>URL de tu página de Notion</label>
          <input
            id="pageUrl"
            name="username"
            type="text"
            value={pageUrl}
            onChange={(e) => setPageUrl(e.target.value)}
            placeholder="https://notion.so/..."
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="field"
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="token" className="eyebrow" style={{ display: "block", marginBottom: 8 }}>Token de integración</label>
          <input
            id="token"
            name="password"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ntn_..."
            autoComplete="current-password"
            className="field"
            style={inputStyle}
          />
        </div>

        {!standalone && (
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 44, cursor: "pointer", fontWeight: 500, fontSize: 14, color: "var(--text)" }}>
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                style={{ width: 20, height: 20, accentColor: "var(--ink)", flex: "0 0 auto" }}
              />
              Recordar en este dispositivo
            </label>
            <div className="caption">
              Desmarcalo en una compu compartida: se borra al cerrar el navegador.
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="is-inv" style={{ fontSize: 13, border: "1.5px solid var(--ink)", padding: "8px 12px", fontWeight: 500, lineHeight: 1.4, margin: 0 }}>{error}</p>
        )}

        <button type="submit" disabled={disabled} className="btn btn-primary btn-block" style={{ minHeight: 52 }}>
          <Plug size={18} strokeWidth={1.75} />
          {loading ? "Conectando…" : "Conectar"}
          <span aria-hidden="true">↗</span>
        </button>

        <p className="caption" style={{ textAlign: "center", margin: 0 }}>
          Conectá solo en una instalación tuya o de alguien de confianza: el servidor usa tu token para leer tu Notion.
        </p>
      </form>
    </div>
  );
}

export function SetupForm({
  connected,
  via,
  reason,
  autoSecret,
}: {
  connected: boolean;
  via: "cookie" | "legacy" | "dev" | null;
  reason: SetupReason | null;
  // true si el servidor cifra la cookie con la clave automática (sin AUTH_COOKIE_SECRET)
  autoSecret: boolean;
}) {
  // Si recién se conectó y volvió sin conexión, el navegador no guardó la cookie.
  const [lostCookie, setLostCookie] = useState(false);
  // Restaurando la conexión desde la copia de localStorage (um.conn)
  const [restoring, setRestoring] = useState(false);
  useEffect(() => {
    // El token fue rechazado: la copia ya no sirve y no hay que restaurarla.
    if (reason === "revoked") clearConnBackup();

    let mark = 0;
    try {
      mark = Number(sessionStorage.getItem(JUST_CONNECTED));
      if (mark) sessionStorage.removeItem(JUST_CONNECTED);
    } catch {
      /* ignore */
    }

    // Recién conectado (<30 s) y sin conexión: el navegador no guarda la cookie. Se corta
    // acá, sin restaurar, para no entrar en un bucle de restauraciones.
    if (mark && Date.now() - mark <= 30_000 && !connected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lee sessionStorage (no existe en el servidor)
      setLostCookie(true);
      clearConnBackup();
      return;
    }

    const backup = readConnBackup();

    // Sin cookie (Safari iOS la borra al cerrar) pero con copia: restaurarla en silencio.
    if (!connected && (reason === null || reason === "missing" || reason === "expired") && backup) {
      let cancelled = false;
      setRestoring(true);
      (async () => {
        try {
          const res = await fetch("/api/setup/restore", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value: backup }),
          });
          if (res.ok) {
            try {
              sessionStorage.setItem(JUST_CONNECTED, String(Date.now()));
            } catch {
              /* ignore */
            }
            window.location.replace("/");
            return;
          }
          if (res.status === 401) clearConnBackup();
        } catch {
          /* red caída: se conserva la copia */
        }
        if (!cancelled) setRestoring(false);
      })();
      return () => {
        cancelled = true;
      };
    }

    // Ya conectado con cookie recordada y sin copia: crearla sin tener que reconectar.
    if (connected && via === "cookie" && reason !== "revoked" && !backup) {
      fetch("/api/setup/restore")
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { value?: unknown } | null) => {
          if (data && typeof data.value === "string") saveConnBackup(data.value);
        })
        .catch(() => {});
    }
  }, [connected, via, reason]);

  // Con el token rechazado la cookie sigue "válida" pero ya no sirve: se pide el nuevo
  // en vez de ofrecer "Ir a la app" (que volvería acá).
  const showConnected = connected && reason !== "revoked";

  const banner = lostCookie
    ? "Tu navegador no guardó la conexión (¿modo privado o cookies bloqueadas?). Probá en una ventana normal."
    : reason
      ? REASON_TEXT[reason]
      : null;

  return (
    <div
      className="app-root"
      data-theme="light"
      style={{ position: "relative", minHeight: "100dvh", background: "var(--bg)" }}
    >
      {/* Barra fina de marca y estado real de la conexión */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "12px 16px", borderBottom: "1.5px solid var(--ink)", background: "var(--surface)" }}>
        <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: "0.08em" }}>UNA_MONEDITA</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 500, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          <span className="dot" style={connected ? undefined : { background: "var(--text-2)" }} />
          {connected ? "Conectado" : "Sin conectar"}
        </span>
      </div>

      <div style={{ width: "100%", maxWidth: 520, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ marginBottom: 40 }}>
          <div className="sec-label" style={{ marginBottom: 16 }}>/00 — Conectar</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="UnaMonedita"
            width={56}
            height={56}
            style={{ display: "block", width: 56, height: 56, marginBottom: 16, border: "1.5px solid var(--ink)", objectFit: "cover" }}
          />
          <h1 className="display" style={{ fontSize: "clamp(48px, 13vw, 96px)", lineHeight: 0.9, margin: "0 0 16px" }}>
            Una
            <br />
            Monedita
          </h1>
          <p className="kicker" style={{ margin: 0 }}>
            Finanzas personales. Tu base de datos es privada y vive en tu propia cuenta de Notion.
          </p>
        </div>

        {banner && (
          <p role="status" className="is-inv" style={{ fontSize: 13, border: "1.5px solid var(--ink)", padding: "8px 12px", fontWeight: 500, lineHeight: 1.4, margin: "0 0 24px" }}>
            {banner}
          </p>
        )}

        <div className="card-hero" style={{ margin: 8 }}>
          {restoring ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Reconectando…</div>
              <div className="caption">Recuperando tu conexión guardada en este navegador.</div>
            </div>
          ) : showConnected ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Ya estás conectado</div>
                <div className="caption">
                  {via === "dev" ? "Modo desarrollo: usa el Notion de .env.local." : "Este dispositivo ya tiene tu Notion conectado."}
                </div>
                <Link href="/" className="btn btn-primary btn-block" style={{ minHeight: 52 }}>
                  Ir a la app
                  <span aria-hidden="true">↗</span>
                </Link>
              </div>
              <details>
                <summary className="eyebrow" style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center", color: "var(--text)" }}>
                  Conectar otra cuenta de Notion
                </summary>
                <div style={{ paddingTop: 16 }}>
                  <ConnectFlow />
                </div>
              </details>
            </div>
          ) : (
            <ConnectFlow />
          )}
        </div>

        {autoSecret && (
          <p className="caption" style={{ border: "1.5px solid var(--ink)", padding: "8px 12px", marginTop: 24, marginBottom: 0 }}>
            Esta instalación usa una clave automática: después de cada nuevo deploy puede pedirte conectar otra vez. Para evitarlo, definí AUTH_COOKIE_SECRET en Vercel (ver DEPLOY.md).
          </p>
        )}
      </div>
    </div>
  );
}
