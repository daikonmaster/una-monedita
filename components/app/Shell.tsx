"use client";

import { useState, useEffect } from "react";
import { useStore, type Screen } from "./store";
import { Icon } from "./Icon";
import { DashboardMobile, DashboardDesktop } from "./screen-dashboard";
import { Movimientos } from "./screen-movimientos";
import { Calendario } from "./screen-calendario";
import { Categorias } from "./screen-categorias";
import { Recurrentes } from "./screen-recurrentes";
import { Ajustes } from "./screen-ajustes";
import { NewEntryModal } from "./modal-new-entry";
import { Toast } from "./ui";

const NAV: { id: Screen; label: string; icon: string; n: string; short: string }[] = [
  { id: "dashboard", label: "Resumen", icon: "ChartPie", n: "01", short: "Resumen" },
  { id: "movimientos", label: "Movimientos", icon: "List", n: "02", short: "Movs." },
  { id: "calendario", label: "Calendario", icon: "CalendarDays", n: "03", short: "Calendario" },
  { id: "recurrentes", label: "Fijos", icon: "Repeat", n: "04", short: "Fijos" },
  { id: "categorias", label: "Categorías", icon: "Tags", n: "05", short: "Categorías" },
  { id: "ajustes", label: "Ajustes", icon: "Settings", n: "06", short: "Ajustes" },
];
// Móvil: 5 pestañas (Categorías es configuración de baja frecuencia y se abre
// desde Ajustes). El desktop conserva las 6 en el sidebar.
const NAV_MOBILE = NAV.filter((n) => n.id !== "categorias");

// Marca en tipografía del sistema: imagen cuadrada con borde + UNA_MONEDITA en mono.
function Logo({ size = 30 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size, flex: "0 0 auto", objectFit: "cover", border: "1.5px solid var(--ink)" }}
      />
      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: Math.round(size * 0.45), letterSpacing: "0.04em" }}>UNA_MONEDITA</span>
    </div>
  );
}

function ScreenBody({ screen }: { screen: Screen }) {
  switch (screen) {
    case "dashboard":
      return <DashboardMobile />;
    case "movimientos":
      return <Movimientos />;
    case "calendario":
      return <Calendario />;
    case "recurrentes":
      return <Recurrentes />;
    case "categorias":
      return <Categorias />;
    case "ajustes":
      return <Ajustes />;
  }
}

function MobileLayout() {
  const { screen, setScreen, openEntry } = useStore();
  const current = NAV.find((n) => n.id === screen);
  const title = screen === "dashboard" ? null : current?.label;
  // Categorías cuelga de Ajustes: la pestaña activa sigue siendo Ajustes.
  const activeTab: Screen = screen === "categorias" ? "ajustes" : screen;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "max(10px, calc(env(safe-area-inset-top) - 8px)) 16px 4px", minHeight: 56, flex: "0 0 auto", borderBottom: "1.5px solid var(--ink)", background: "var(--surface)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 2, minWidth: 0 }}>
          {screen === "categorias" && (
            <button className="icon-btn" onClick={() => setScreen("ajustes")} aria-label="Volver a Ajustes" style={{ marginLeft: -10 }}>
              <Icon name="ChevronLeft" size={22} stroke={2.4} color="var(--text-2)" />
            </button>
          )}
          {screen === "dashboard" ? (
            <Logo size={28} />
          ) : (
            <>
              <span aria-hidden="true" className="kicker" style={{ fontSize: 12, marginRight: 8 }}>/{current?.n}</span>
              <h1 className="display" style={{ fontSize: 26, margin: 0 }}>{title}</h1>
            </>
          )}
        </div>
        {screen === "movimientos" && (
          <button className="icon-btn" onClick={() => openEntry("expense")} aria-label="Agregar gasto">
            <Icon name="Plus" size={22} stroke={2.4} color="var(--text-2)" />
          </button>
        )}
      </header>
      <main style={{ flex: 1, minHeight: 0 }}>
        <ScreenBody screen={screen} />
      </main>
      <nav aria-label="Secciones" className="mobile-nav" style={{ display: "flex", borderTop: "1.5px solid var(--ink)", background: "var(--surface)", flex: "0 0 auto" }}>
        {NAV_MOBILE.map((n, i) => {
          const on = activeTab === n.id;
          return (
            <button
              key={n.id}
              onClick={() => setScreen(n.id)}
              aria-current={on ? "page" : undefined}
              aria-label={n.short !== n.label ? n.label : undefined}
              style={{ flex: 1, minWidth: 0, minHeight: 52, display: "flex", padding: 0, border: "none", borderLeft: i === 0 ? "none" : "1px solid var(--line)", background: "transparent", cursor: "pointer", fontFamily: "inherit" }}
            >
              <span
                style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, padding: "6px 0", background: on ? "var(--ink)" : "transparent", color: on ? "var(--paper)" : "var(--text)" }}
              >
                <Icon name={n.icon} size={20} stroke={1.75} color={on ? "var(--paper)" : "var(--text)"} />
                <span style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", whiteSpace: "nowrap" }}>{n.short}</span>
              </span>
            </button>
          );
        })}
      </nav>
      {/* Le pasa a Safari 26 el color de la nav para la franja de su barra (ver .chin-tint en globals.css). */}
      <div aria-hidden="true" className="chin-tint" />
    </div>
  );
}

// Encabezado de las pantallas desktop: "/0N — Nombre" + titular Anton.
function PageHead({ id }: { id: Screen }) {
  const n = NAV.find((x) => x.id === id);
  if (!n) return null;
  return (
    <>
      <div className="sec-label">/{n.n} — {n.label}</div>
      <h1 className="display" style={{ fontSize: 56, margin: "8px 0 24px" }}>{n.label}</h1>
    </>
  );
}

function DesktopLayout() {
  const { screen, setScreen, openEntry, today, currency } = useStore();
  const [y, m, d] = today.split("-");
  const stackBtn = { width: "100%", minHeight: 48, justifyContent: "flex-start" } as const;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "236px 1fr", height: "100%" }}>
      <aside style={{ borderRight: "1.5px solid var(--ink)", background: "var(--surface)", padding: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ padding: "20px 16px", borderBottom: "1.5px solid var(--ink)" }}><Logo size={30} /></div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <button onClick={() => openEntry("expense")} title="Agregar gasto (G)" className="btn btn-accent fab-btn" style={stackBtn}>
            <Icon name="Minus" size={18} stroke={1.75} color="currentColor" /> Agregar gasto
            <span aria-hidden="true" style={{ marginLeft: "auto", fontSize: 11, fontWeight: 500 }}>[G]</span>
          </button>
          <button onClick={() => openEntry("income")} title="Agregar ingreso (I)" className="btn btn-primary fab-btn" style={stackBtn}>
            <Icon name="Plus" size={18} stroke={1.75} color="currentColor" /> Agregar ingreso
            <span aria-hidden="true" style={{ marginLeft: "auto", fontSize: 11, fontWeight: 500 }}>[I]</span>
          </button>
        </div>
        <nav aria-label="Secciones" style={{ display: "flex", flexDirection: "column", borderTop: "1.5px solid var(--ink)" }}>
          {NAV.map((n) => {
            const on = screen === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setScreen(n.id)}
                aria-current={on ? "page" : undefined}
                className={on ? "is-inv" : undefined}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 16px", minHeight: 44, width: "100%", border: "none", borderBottom: "1px solid var(--line)", cursor: "pointer", fontFamily: "var(--font-mono)", textAlign: "left", background: on ? undefined : "transparent", color: "var(--text)", fontWeight: on ? 700 : 500, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em" }}
              >
                <span aria-hidden="true" style={{ color: "var(--text-2)", fontWeight: 500 }}>/{n.n}</span>
                <Icon name={n.icon} size={18} stroke={1.75} color="currentColor" />
                {n.label}
              </button>
            );
          })}
        </nav>
        <div className="statusbar" style={{ marginTop: "auto" }}>
          <span className="dot" aria-hidden="true" />
          {d}.{m}.{y} · {currency}
        </div>
      </aside>
      <main style={{ minWidth: 0, overflow: "hidden" }}>
        {screen === "dashboard" && <DashboardDesktop />}
        {screen === "calendario" && (
          <div className="app-scroll" style={{ height: "100%", overflowY: "auto" }}>
            <Calendario />
          </div>
        )}
        {screen === "movimientos" && (
          <div className="app-scroll" style={{ height: "100%", overflowY: "auto" }}>
            <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 24px 40px" }}>
              <PageHead id="movimientos" />
              <Movimientos />
            </div>
          </div>
        )}
        {screen === "recurrentes" && (
          <div className="app-scroll" style={{ height: "100%", overflowY: "auto" }}>
            <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 24px 40px" }}>
              <PageHead id="recurrentes" />
              <Recurrentes />
            </div>
          </div>
        )}
        {screen === "categorias" && (
          <div className="app-scroll" style={{ height: "100%", overflowY: "auto" }}>
            <div style={{ maxWidth: 880, margin: "0 auto", padding: "24px 24px 40px" }}>
              <PageHead id="categorias" />
              <Categorias />
            </div>
          </div>
        )}
        {screen === "ajustes" && (
          <div className="app-scroll" style={{ height: "100%", overflowY: "auto" }}>
            <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 24px 40px" }}>
              <PageHead id="ajustes" />
              <Ajustes />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export function Shell() {
  const { openEntry } = useStore();
  const [isDesktop, setDesktop] = useState(false);
  useEffect(() => {
    const onResize = () => setDesktop(window.innerWidth > 760);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Atajos globales: G = agregar gasto, I = agregar ingreso. Se ignoran al
  // escribir en un campo, con modificadores o si ya hay un diálogo abierto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k !== "g" && k !== "i") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      openEntry(k === "g" ? "expense" : "income");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openEntry]);

  // El tema y el acento viven en <html> (ver app/layout.tsx y el store).
  return (
    <div
      className={"app-root app-shell " + (isDesktop ? "desktop" : "mobile")}
      style={{ height: "100dvh", width: "100%", overflow: "hidden", position: "relative", display: "flex", flexDirection: "column" }}
    >
      <div style={{ flex: 1, minHeight: 0 }}>{isDesktop ? <DesktopLayout /> : <MobileLayout />}</div>
      <NewEntryModal />
      <Toast desktop={isDesktop} />
    </div>
  );
}
