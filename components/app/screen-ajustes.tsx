"use client";

import { useState, useEffect } from "react";
import { useStore, failureText, type DashStyle, type AppCurrency } from "./store";
import { Icon } from "./Icon";
import { Coin } from "./Coin";
import { SegmentedControl } from "./ui";
import { Sheet, SheetHeader, ConfirmRow } from "./Sheet";
import { fmt, parseAmount } from "@/lib/format";
import { clearConnBackup } from "@/lib/conn-backup";

const NOTION_TEMPLATE_URL =
  "https://app.notion.com/p/UNA-MONEDITA-copy-3795c48e39b6803da9abf7ab40919b39?source=copy_link";

// Respuesta de /api/me: la conexión con Notion de ESTE dispositivo.
type Conn = { connected: boolean; via: "cookie" | "legacy" | "dev" | null; remember: boolean | null };

function NotionSection() {
  const [status, setStatus] = useState<Conn | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ connected: false, via: null, remember: null }));
  }, []);

  const connected = !!status?.connected;
  const statusLabel = !status
    ? "Comprobando..."
    : !connected
      ? "No conectado"
      : status.via === "dev"
        ? "Conectado (modo desarrollo)"
        : status.remember === false
          ? "Conectado · hasta cerrar el navegador"
          : status.remember
            ? "Conectado · recordado en este dispositivo"
            : "Conectado";

  // Borra la conexión de este dispositivo (la cookie). Solo si el servidor
  // confirma se sale a /setup: si falla, la conexión sigue y se avisa.
  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/setup", { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // sin esto /setup restauraría la conexión desde la copia de localStorage
      clearConnBackup();
      window.location.replace("/setup");
    } catch (err) {
      console.error(err);
      setError("No se pudo desconectar. Probá de nuevo.");
      setBusy(false);
    }
  }

  return (
    <Row label="Notion" hint="Tu base de datos personal. Duplicá la plantilla y conectá tu cuenta.">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="dot" style={connected ? undefined : { background: "var(--text-2)" }} />
          <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text)", minWidth: 0 }}>
            {statusLabel}
          </span>
        </div>

        <a href={NOTION_TEMPLATE_URL} target="_blank" rel="noopener noreferrer" className="btn btn-block">
          <Icon name="Globe" size={16} stroke={1.75} />
          Abrir plantilla de Notion
          <span aria-hidden="true">↗</span>
        </a>

        <button
          className="btn btn-primary btn-block"
          onClick={() => {
            window.location.href = "/setup";
          }}
        >
          <Icon name="Plug" size={16} stroke={1.75} color="var(--paper)" />
          {connected ? "Cambiar de cuenta de Notion" : "Conectar Notion"}
        </button>

        {connected && status?.via !== "dev" && (
          <>
            <button
              className="btn btn-accent btn-block"
              onClick={() => {
                setError(null);
                setConfirming(true);
              }}
            >
              <Icon name="LogOut" size={16} stroke={1.75} color="var(--on-violet)" />
              Desconectar Notion
            </button>
            <div className="caption">
              Si perdés un dispositivo: en notion.so/my-integrations regenerá el token de la integración y volvé a conectar.
            </div>
          </>
        )}
      </div>

      {confirming && (
        <Sheet label="Desconectar Notion" onClose={() => (busy ? undefined : setConfirming(false))}>
          <SheetHeader title="Desconectar Notion" onClose={() => (busy ? undefined : setConfirming(false))} />
          <div style={{ padding: "8px 24px calc(24px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 8 }}>
            <ConfirmRow
              question="¿Desconectar Notion de este dispositivo?"
              detail="Tus datos quedan en Notion. Para volver a entrar necesitás tu token y la URL de la página."
              confirmLabel="Desconectar"
              busy={busy}
              onCancel={() => setConfirming(false)}
              onConfirm={disconnect}
            />
            {error && (
              <div role="alert" className="caption" style={{ textAlign: "center" }}>
                <span className="tag inv" style={{ whiteSpace: "normal" }}>{error}</span>
              </div>
            )}
          </div>
        </Sheet>
      )}
    </Row>
  );
}

type ActionState = { kind: "idle" } | { kind: "busy" } | { kind: "ok"; message: string } | { kind: "error"; message: string };

const DB_ID_LABELS: Record<string, string> = {
  transactions: "Transactions",
  accounts: "Accounts",
  categories: "Categories",
  subscriptions: "Subscriptions",
  budgets: "Budgets",
  fxRates: "FX Rates",
};

function MantenimientoSection() {
  const [migrateState, setMigrateState] = useState<ActionState>({ kind: "idle" });
  const [guideState, setGuideState] = useState<ActionState>({ kind: "idle" });
  const [showConn, setShowConn] = useState(false);
  const [conn, setConn] = useState<{ dbIds: Record<string, string>; parentPageId: string | null } | null>(null);
  const [connLoading, setConnLoading] = useState(false);

  async function runMigrate() {
    if (migrateState.kind === "busy") return;
    setMigrateState({ kind: "busy" });
    try {
      const res = await fetch("/api/subscriptions/migrate", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Error");
      const added: string[] = data.added ?? [];
      setMigrateState({
        kind: "ok",
        message: added.length ? `Agregado: ${added.join(", ")}` : "Ya estaba al día",
      });
    } catch (err) {
      setMigrateState({ kind: "error", message: err instanceof Error ? err.message : "Error preparando Notion" });
    }
  }

  async function runPublishGuide() {
    if (guideState.kind === "busy") return;
    setGuideState({ kind: "busy" });
    try {
      const res = await fetch("/api/notion/guide", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      // el endpoint manda `detail` con el error crudo de Notion — sin él el
      // mensaje genérico no alcanza para diagnosticar desde el celular
      if (!res.ok) throw new Error([data?.error, data?.detail].filter(Boolean).join(" — ") || "Error");
      setGuideState({ kind: "ok", message: data.url });
    } catch (err) {
      setGuideState({ kind: "error", message: err instanceof Error ? err.message : "Error publicando la guía" });
    }
  }

  async function toggleConn() {
    const next = !showConn;
    setShowConn(next);
    if (next && !conn) {
      setConnLoading(true);
      try {
        const res = await fetch("/api/me?full=1");
        const data = await res.json();
        if (data.dbIds) setConn({ dbIds: data.dbIds, parentPageId: data.parentPageId ?? null });
      } finally {
        setConnLoading(false);
      }
    }
  }

  return (
    <Row label="Mantenimiento" hint="Preparar la base de Notion para gastos fijos y mantener la guía que lee tu agente (Hermes) al día.">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button className="btn btn-block" onClick={runMigrate} disabled={migrateState.kind === "busy"}>
          <Icon name="Database" size={16} stroke={1.75} />
          {migrateState.kind === "busy" ? "Preparando..." : "Preparar Notion"}
        </button>
        {migrateState.kind === "ok" && (
          <div className="caption">
            <span className="tag" style={{ whiteSpace: "normal" }}>{migrateState.message}</span>
          </div>
        )}
        {migrateState.kind === "error" && (
          <div className="caption">
            <span className="tag inv" style={{ whiteSpace: "normal" }}>{migrateState.message}</span>
          </div>
        )}

        <button className="btn btn-block" onClick={runPublishGuide} disabled={guideState.kind === "busy"}>
          <Icon name="BookOpen" size={16} stroke={1.75} />
          {guideState.kind === "busy" ? "Publicando..." : "Publicar guía para agentes"}
        </button>
        {guideState.kind === "ok" && (
          <a href={guideState.message} target="_blank" rel="noopener noreferrer" className="link" style={{ fontSize: 12, wordBreak: "break-all" }}>
            {guideState.message} ↗
          </a>
        )}
        {guideState.kind === "error" && (
          <div className="caption">
            <span className="tag inv" style={{ whiteSpace: "normal", wordBreak: "break-word" }}>{guideState.message}</span>
          </div>
        )}

        <button className="btn btn-ghost btn-block" onClick={toggleConn} style={{ justifyContent: "space-between" }}>
          Datos de conexión
          <Icon name={showConn ? "ChevronUp" : "ChevronDown"} size={15} stroke={1.75} />
        </button>
        {showConn && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 12px", border: "1px solid var(--line)", background: "var(--bg-2)", fontFamily: "var(--font-mono)", fontSize: 12, overflowWrap: "anywhere" }}>
            {connLoading && <div style={{ color: "var(--text-2)" }}>Cargando...</div>}
            {!connLoading && conn && (
              <>
                <div style={{ color: "var(--text-2)" }}>Página principal: {conn.parentPageId ?? "—"}</div>
                {Object.entries(conn.dbIds).map(([key, id]) => (
                  <div key={key} style={{ color: "var(--text)" }}>
                    {DB_ID_LABELS[key] ?? key}: {id || "—"}
                  </div>
                ))}
              </>
            )}
            {!connLoading && !conn && <div style={{ color: "var(--text-2)" }}>No disponible</div>}
          </div>
        )}
      </div>
    </Row>
  );
}

// Grupo de ajustes: subtítulo entre corchetes + una sola tarjeta sin padding,
// con la ayuda como última fila separada por hairline.
function Row({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="eyebrow bracket">{label}</div>
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: 16 }}>{children}</div>
        {hint && (
          <div className="caption" style={{ padding: "8px 16px", borderTop: "1px solid var(--line)" }}>
            {hint}
          </div>
        )}
      </div>
    </section>
  );
}

function Pills<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return <SegmentedControl<T> label={label} options={options} value={value} onChange={onChange} stretch />;
}

// Saldo: "¿Cuánta plata tenés hoy?". La app calcula el saldo inicial para que el
// Disponible de hoy sea exactamente lo que escribís (Notion · Accounts.InitialBalance).
function SaldoSection() {
  const { available, setAvailableToday, hasPendingTx, initialBalance, retryHistory, currency, allTx } = useStore();
  const [value, setValue] = useState("");
  const [howOpen, setHowOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const parsed = parseAmount(value);
  const reason =
    available.status === "loading"
      ? "Calculando tu saldo…"
      : hasPendingTx
        ? "Esperá a que se guarde el último movimiento."
        : null;
  const canSave = available.status === "ready" && !hasPendingTx && parsed !== null && !busy;
  const currencies = [...new Set(allTx.map((t) => t.currency))];

  async function save() {
    if (parsed === null) {
      setMsg({ ok: false, text: "Ingresá un número." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await setAvailableToday(Math.round(parsed * 100) / 100);
      setValue("");
      setMsg({ ok: true, text: `Listo. Disponible hoy: ${fmt(parsed, currency)}.` });
    } catch (err) {
      setMsg({ ok: false, text: failureText(err, "No se pudo guardar tu saldo") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Row
      label="Saldo"
      hint="Lo que pongas acá es lo que tenés hoy. Desde ahí, cada gasto resta y cada ingreso suma, y el número no cambia al pasar de mes."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 16, borderBottom: "1px solid var(--line)" }}>
          <Coin size={30} sprout={available.status === "ready" && available.monthNet > 0} />
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow">Disponible hoy</div>
            {available.status === "loading" && <div className="skeleton-row" role="status" aria-label="Calculando saldo" style={{ height: 28, width: 140, marginTop: 4 }} />}
            {available.status === "error" && (
              <div role="alert" className="caption" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className="tag inv">No se pudo calcular tu saldo.</span>
                <button className="btn btn-ghost" onClick={retryHistory}>
                  Reintentar
                </button>
              </div>
            )}
            {available.status === "ready" && (
              <div className="display" style={{ fontSize: 28, lineHeight: 1.1, color: available.amount < 0 ? "var(--expense)" : "var(--text)" }}>
                {fmt(available.amount, currency)}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label htmlFor="plata-hoy" className="eyebrow" style={{ color: "var(--text)" }}>
            ¿Cuánta plata tenés hoy? (efectivo + banco)
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              id="plata-hoy"
              inputMode="decimal"
              value={value}
              disabled={available.status !== "ready"}
              onChange={(e) => {
                setValue(e.target.value);
                setMsg(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSave) void save();
              }}
              placeholder="Ej: 1000"
              className="field"
              style={{ flex: 1, minWidth: 0, fontSize: 20, fontWeight: 700 }}
            />
            <button className="btn btn-primary" onClick={save} disabled={!canSave} style={{ minHeight: 48 }}>
              {busy ? "Guardando…" : "Guardar"}
            </button>
          </div>
          {reason && <div className="caption">{reason}</div>}
          {msg && (
            <div role={msg.ok ? "status" : "alert"} className="caption">
              <span className={msg.ok ? "tag" : "tag inv"} style={{ whiteSpace: "normal" }}>{msg.text}</span>
            </div>
          )}
        </div>

        <div>
          <button className="btn btn-ghost" onClick={() => setHowOpen((o) => !o)} aria-expanded={howOpen}>
            Cómo se calcula
            <Icon name={howOpen ? "ChevronUp" : "ChevronDown"} size={15} stroke={1.75} />
          </button>
          {howOpen && (
            <div className="caption" style={{ display: "flex", flexDirection: "column", gap: 8, lineHeight: 1.5 }}>
              <span>Disponible hoy = saldo inicial + ingresos − gastos de todo lo fechado hasta hoy.</span>
              <span>
                Saldo inicial guardado: <strong style={{ color: "var(--text)", fontWeight: 700 }}>{initialBalance === null ? "…" : fmt(initialBalance, currency)}</strong>. Se calcula solo al guardar lo que tenés hoy, y puede ser negativo.
              </span>
              {available.status === "ready" && available.futureCount > 0 && (
                <span>
                  Hay {available.futureCount} {available.futureCount === 1 ? "movimiento con fecha futura" : "movimientos con fecha futura"}: se cuentan el día que llegan.
                </span>
              )}
              {currencies.length > 1 && <span>Sumamos movimientos en {currencies.join(" y ")} sin convertir.</span>}
            </div>
          )}
        </div>
      </div>
    </Row>
  );
}

export function Ajustes() {
  const { theme, setTheme, dashStyle, setDashStyle, currency, setCurrency, setScreen } = useStore();

  return (
    <div className="app-scroll" style={{ height: "100%", overflowY: "auto", padding: "8px 16px 24px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        <button
          className="card"
          onClick={() => setScreen("categorias")}
          style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 52, cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: "var(--text)" }}
        >
          <Icon name="Tags" size={20} stroke={1.75} color="var(--text)" />
          <span style={{ flex: 1, fontWeight: 500, fontSize: 14, minWidth: 0 }}>Categorías y presupuestos</span>
          <Icon name="ChevronRight" size={20} stroke={1.75} color="var(--text)" />
        </button>

        <Row label="Moneda" hint="Usada al registrar nuevos movimientos">
          <Pills label="Moneda" value={currency} onChange={(v) => setCurrency(v as AppCurrency)} options={[{ value: "EUR", label: "€ Euro" }, { value: "ARS", label: "$ Peso" }, { value: "USD", label: "US$ Dólar" }]} />
        </Row>

        <SaldoSection />

        <Row label="Tema">
          <Pills label="Tema" value={theme} onChange={setTheme} options={[{ value: "system", label: "Automático" }, { value: "light", label: "Claro" }, { value: "dark", label: "Oscuro" }]} />
        </Row>

        <Row label="Estilo del resumen" hint="Cómo se ve el Resumen en el celular.">
          <Pills label="Estilo del resumen" value={dashStyle} onChange={(v) => setDashStyle(v as DashStyle)} options={[{ value: "A", label: "Anillo" }, { value: "B", label: "Leyenda" }, { value: "C", label: "Grilla" }]} />
        </Row>

        <NotionSection />

        <MantenimientoSection />
      </div>
    </div>
  );
}
