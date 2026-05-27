// Visual SVG thumbnails for the template picker. These approximate the
// rendered look — header, hero, content blocks — using each template's
// typographic and palette traits, so an operator can tell them apart at a
// glance before committing.

import * as React from "react";

export type TemplateThumbnailId = "modern" | "classic" | "bold" | "refined";

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

const BOLD_PRIMARY = "#FF4D2E";
const BOLD_ACCENT = "#FFFFFF";

const REFINED_PRIMARY = "#3D5A4C";
const REFINED_ACCENT = "#B89968";
const REFINED_BG = "#FAF8F4";

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
  if (id === "bold") {
    return (
      <BoldThumbnail
        className={className}
        primary={primary ?? BOLD_PRIMARY}
        accent={accent ?? BOLD_ACCENT}
      />
    );
  }
  if (id === "refined") {
    return (
      <RefinedThumbnail
        className={className}
        primary={primary ?? REFINED_PRIMARY}
        accent={accent ?? REFINED_ACCENT}
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

function BoldThumbnail({
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
      aria-label="Bold template thumbnail"
      className={className}
    >
      <defs>
        <linearGradient id="bold-hero" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.6" />
          <stop offset="100%" stopColor={primary} stopOpacity="0.85" />
        </linearGradient>
      </defs>
      {/* Full-bleed dark hero */}
      <rect width="320" height="138" fill="#000" />
      <rect width="320" height="138" fill="url(#bold-hero)" />
      {/* Top bar */}
      <rect x="14" y="14" width="46" height="6" fill={accent} opacity="0.9" />
      <rect x="244" y="12" width="60" height="10" fill={primary} />
      {/* Massive bottom-left headline */}
      <rect x="14" y="74" width="140" height="14" fill={accent} />
      <rect x="14" y="92" width="200" height="14" fill={accent} />
      <rect x="14" y="110" width="100" height="14" fill={primary} />
      {/* Hard CTA buttons */}
      <rect x="14" y="146" width="68" height="14" fill={primary} />
      <rect x="86" y="146" width="48" height="14" fill="#000" stroke="#000" />
      {/* Footer strip */}
      <rect x="0" y="166" width="320" height="34" fill="#0a0a0a" />
      <rect x="14" y="178" width="60" height="4" fill={accent} opacity="0.7" />
      <rect x="80" y="178" width="46" height="4" fill={accent} opacity="0.5" />
      <rect x="132" y="178" width="46" height="4" fill={accent} opacity="0.5" />
      <rect x="184" y="178" width="46" height="4" fill={accent} opacity="0.5" />
      <rect x="236" y="178" width="46" height="4" fill={accent} opacity="0.5" />
    </svg>
  );
}

function RefinedThumbnail({
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
      aria-label="Refined template thumbnail"
      className={className}
    >
      <rect width="320" height="200" fill={REFINED_BG} />
      {/* Top eyebrow row with hairline rule */}
      <rect x="14" y="14" width="44" height="4" fill={primary} opacity="0.7" />
      <rect x="248" y="14" width="56" height="4" fill={primary} opacity="0.5" />
      <line x1="14" y1="26" x2="306" y2="26" stroke={primary} strokeOpacity="0.25" strokeWidth="0.6" />

      {/* Split hero: text left (cols 1-7), image right (8-12) */}
      {/* Text column */}
      <rect x="14" y="44" width="48" height="4" fill={accent} opacity="0.8" />
      <rect x="14" y="58" width="156" height="11" fill={primary} />
      <rect x="14" y="72" width="180" height="11" fill={primary} />
      <rect x="14" y="86" width="120" height="11" fill={primary} opacity="0.85" />
      <rect x="14" y="106" width="172" height="5" fill={primary} opacity="0.45" />
      <rect x="14" y="114" width="148" height="5" fill={primary} opacity="0.45" />
      {/* Pill CTA + underlined secondary */}
      <rect x="14" y="130" width="50" height="12" rx="6" fill={primary} />
      <rect x="72" y="134" width="50" height="3" fill={primary} opacity="0.7" />
      <line x1="72" y1="139" x2="122" y2="139" stroke={primary} strokeWidth="0.5" />

      {/* Image column — tall portrait */}
      <rect x="206" y="34" width="100" height="148" fill={primary} opacity="0.18" />
      <line x1="200" y1="32" x2="312" y2="32" stroke={primary} strokeOpacity="0.3" strokeWidth="0.6" />
      <line x1="200" y1="184" x2="312" y2="184" stroke={primary} strokeOpacity="0.3" strokeWidth="0.6" />
      <rect x="216" y="148" width="80" height="4" fill={primary} opacity="0.6" />
      <rect x="216" y="158" width="56" height="4" fill={primary} opacity="0.4" />
    </svg>
  );
}
