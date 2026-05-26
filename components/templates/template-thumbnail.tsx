// Visual SVG thumbnails for the template picker. These approximate the
// rendered look — header, hero, content blocks — using each template's
// typographic and palette traits, so an operator can tell them apart at a
// glance before committing.

import * as React from "react";

export type TemplateThumbnailId = "modern" | "classic";

export interface TemplateThumbnailProps {
  id: TemplateThumbnailId;
  className?: string;
  /** Override accent + primary colors. Defaults match each template's stock palette. */
  primary?: string;
  accent?: string;
}

const MODERN_PRIMARY = "#C8542C";
const MODERN_ACCENT = "#2D5A3D";
const MODERN_BG = "#FBF6EE";

const CLASSIC_PRIMARY = "#1A1A1A";
const CLASSIC_ACCENT = "#8B7050";
const CLASSIC_BG = "#F5F1EA";

export function TemplateThumbnail({
  id,
  className,
  primary,
  accent,
}: TemplateThumbnailProps) {
  if (id === "classic") {
    return (
      <ClassicThumbnail
        className={className}
        primary={primary ?? CLASSIC_PRIMARY}
        accent={accent ?? CLASSIC_ACCENT}
      />
    );
  }
  return (
    <ModernThumbnail
      className={className}
      primary={primary ?? MODERN_PRIMARY}
      accent={accent ?? MODERN_ACCENT}
    />
  );
}

function ModernThumbnail({
  className,
  primary,
  accent,
}: {
  className?: string;
  primary: string;
  accent: string;
}) {
  return (
    <svg
      viewBox="0 0 320 200"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Modern template thumbnail"
      className={className}
    >
      <defs>
        <linearGradient id="modern-hero" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={primary} stopOpacity="0.92" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={MODERN_BG} />
      {/* Header */}
      <rect x="0" y="0" width="320" height="22" fill="#fff" />
      <circle cx="14" cy="11" r="4" fill={primary} />
      <rect x="22" y="8" width="46" height="6" rx="3" fill="#3F3A33" opacity="0.78" />
      <rect x="244" y="6" width="46" height="11" rx="5.5" fill={primary} />
      <rect x="200" y="9" width="32" height="5" rx="2.5" fill="#3F3A33" opacity="0.35" />
      {/* Hero photo block */}
      <rect x="12" y="32" width="296" height="96" rx="18" fill="url(#modern-hero)" />
      {/* Hero copy on top */}
      <rect x="28" y="58" width="124" height="9" rx="3" fill="#fff" opacity="0.95" />
      <rect x="28" y="71" width="178" height="9" rx="3" fill="#fff" opacity="0.85" />
      <rect x="28" y="84" width="98" height="6" rx="3" fill="#fff" opacity="0.7" />
      <rect x="28" y="100" width="68" height="14" rx="7" fill="#fff" />
      <rect x="100" y="100" width="60" height="14" rx="7" fill="#fff" opacity="0.4" />
      {/* Featured cards */}
      <rect x="12" y="140" width="92" height="48" rx="12" fill="#fff" />
      <rect x="22" y="148" width="44" height="22" rx="6" fill={primary} opacity="0.2" />
      <rect x="22" y="174" width="58" height="5" rx="2.5" fill="#3F3A33" opacity="0.55" />
      <rect x="114" y="140" width="92" height="48" rx="12" fill="#fff" />
      <rect x="124" y="148" width="44" height="22" rx="6" fill={accent} opacity="0.22" />
      <rect x="124" y="174" width="58" height="5" rx="2.5" fill="#3F3A33" opacity="0.55" />
      <rect x="216" y="140" width="92" height="48" rx="12" fill="#fff" />
      <rect x="226" y="148" width="44" height="22" rx="6" fill={primary} opacity="0.18" />
      <rect x="226" y="174" width="58" height="5" rx="2.5" fill="#3F3A33" opacity="0.55" />
    </svg>
  );
}

function ClassicThumbnail({
  className,
  primary,
  accent,
}: {
  className?: string;
  primary: string;
  accent: string;
}) {
  return (
    <svg
      viewBox="0 0 320 200"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Classic template thumbnail"
      className={className}
    >
      <rect width="320" height="200" fill={CLASSIC_BG} />
      {/* Header bar */}
      <rect x="0" y="0" width="320" height="22" fill="#fff" />
      <rect x="138" y="9" width="44" height="6" rx="0" fill={primary} opacity="0.9" />
      <rect x="14" y="9" width="22" height="5" rx="0" fill={primary} opacity="0.4" />
      <rect x="40" y="9" width="22" height="5" rx="0" fill={primary} opacity="0.4" />
      <rect x="66" y="9" width="22" height="5" rx="0" fill={primary} opacity="0.4" />
      <line x1="0" y1="22" x2="320" y2="22" stroke={accent} strokeWidth="0.6" />
      {/* Hero — centered serif title block */}
      <rect x="98" y="42" width="124" height="2" rx="0" fill={accent} opacity="0.7" />
      <rect x="68" y="54" width="184" height="14" rx="0" fill={primary} />
      <rect x="84" y="74" width="152" height="6" rx="0" fill={primary} opacity="0.55" />
      <rect x="100" y="84" width="120" height="6" rx="0" fill={primary} opacity="0.35" />
      <rect x="98" y="100" width="124" height="2" rx="0" fill={accent} opacity="0.7" />
      {/* CTA */}
      <rect x="118" y="112" width="84" height="14" rx="0" fill={primary} />
      <rect x="138" y="118" width="44" height="3" rx="0" fill="#fff" />
      {/* Featured cards — bordered, rectilinear */}
      <rect x="12" y="140" width="92" height="48" rx="2" fill="#fff" stroke={accent} strokeWidth="0.8" />
      <line x1="22" y1="156" x2="62" y2="156" stroke={accent} strokeWidth="0.6" />
      <rect x="22" y="162" width="58" height="5" rx="0" fill={primary} opacity="0.7" />
      <rect x="22" y="171" width="38" height="4" rx="0" fill={primary} opacity="0.35" />
      <rect x="114" y="140" width="92" height="48" rx="2" fill="#fff" stroke={accent} strokeWidth="0.8" />
      <line x1="124" y1="156" x2="164" y2="156" stroke={accent} strokeWidth="0.6" />
      <rect x="124" y="162" width="58" height="5" rx="0" fill={primary} opacity="0.7" />
      <rect x="124" y="171" width="38" height="4" rx="0" fill={primary} opacity="0.35" />
      <rect x="216" y="140" width="92" height="48" rx="2" fill="#fff" stroke={accent} strokeWidth="0.8" />
      <line x1="226" y1="156" x2="266" y2="156" stroke={accent} strokeWidth="0.6" />
      <rect x="226" y="162" width="58" height="5" rx="0" fill={primary} opacity="0.7" />
      <rect x="226" y="171" width="38" height="4" rx="0" fill={primary} opacity="0.35" />
    </svg>
  );
}
