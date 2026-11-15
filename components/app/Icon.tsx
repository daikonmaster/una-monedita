"use client";

import type { CSSProperties } from "react";
import { ICONS, FALLBACK_ICON } from "@/lib/icon-registry";

export function Icon({
  name,
  size = 24,
  stroke = 2,
  color = "currentColor",
  className,
  style,
}: {
  name: string;
  size?: number;
  stroke?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const Cmp = ICONS[name] || FALLBACK_ICON;
  return (
    <Cmp
      size={size}
      strokeWidth={Math.min(stroke, 1.75)}
      strokeLinecap="square"
      strokeLinejoin="miter"
      color={color}
      className={className}
      style={style}
      aria-hidden
    />
  );
}

export function CatBubble({
  icon,
  color,
  size = 44,
  stroke = 2,
  active = false,
  onClick,
  title,
}: {
  icon: string;
  color: string;
  size?: number;
  stroke?: number;
  active?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  const s: CSSProperties = {
    width: size,
    height: size,
    display: "grid",
    placeItems: "center",
    flex: "0 0 auto",
    background: color,
    border: "1.5px solid var(--ink)",
    cursor: onClick ? "pointer" : "default",
    ...(active ? { outline: "3px solid var(--violet)", outlineOffset: 2 } : null),
  };
  return (
    <div
      role={onClick ? "button" : undefined}
      title={title}
      onClick={onClick}
      style={s}
      className="cat-bubble"
    >
      <Icon name={icon} size={Math.round(size * 0.48)} stroke={stroke} color="var(--on-cat)" />
    </div>
  );
}
