// Template registry — drives which set of visual components renders the
// public-facing site for each Restaurant. Each template bundle provides
// overrides for the visually-distinctive pieces; anything unset falls back
// to the Modern (default) implementation.

import { Hero as ModernHero } from "@/components/restaurant/hero";
import { FeaturedStrip as ModernFeaturedStrip } from "@/components/restaurant/featured-strip";
import { ServicesSection as ModernServicesSection } from "@/components/restaurant/services-section";
import { AboutSection as ModernAboutSection } from "@/components/restaurant/about-section";
import { VisitCard as ModernVisitCard } from "@/components/restaurant/visit-card";
import { MenuItemCard as ModernMenuItemCard } from "@/components/restaurant/menu-item-card";

import { ClassicHero } from "@/components/templates/classic/hero";
import { ClassicFeaturedStrip } from "@/components/templates/classic/featured-strip";
import { ClassicMenuItemCard } from "@/components/templates/classic/menu-item-card";

export interface TemplateBundle {
  id: string;
  label: string;
  description: string;
  // Layout/typography variant — applied at the customer layout level
  // as a CSS variable hint. "warm" is the default (Inter + Fraunces serif
  // for display). "serif" uses Fraunces in more places for a formal feel.
  typographyMode: "warm" | "serif";
  components: {
    Hero: typeof ModernHero;
    FeaturedStrip: typeof ModernFeaturedStrip;
    ServicesSection: typeof ModernServicesSection;
    AboutSection: typeof ModernAboutSection;
    VisitCard: typeof ModernVisitCard;
    MenuItemCard: typeof ModernMenuItemCard;
  };
}

const MODERN: TemplateBundle = {
  id: "modern",
  label: "Modern",
  description:
    "Warm + organic. Full-bleed hero photo, soft serif headings, large pill buttons. Matches the Mama Bears look.",
  typographyMode: "warm",
  components: {
    Hero: ModernHero,
    FeaturedStrip: ModernFeaturedStrip,
    ServicesSection: ModernServicesSection,
    AboutSection: ModernAboutSection,
    VisitCard: ModernVisitCard,
    MenuItemCard: ModernMenuItemCard,
  },
};

const CLASSIC: TemplateBundle = {
  id: "classic",
  label: "Classic",
  description:
    "Formal + elegant. Centered serif typography, bordered cards, restrained palette. Good fit for fine dining, law firms, salons.",
  typographyMode: "serif",
  components: {
    Hero: ClassicHero,
    FeaturedStrip: ClassicFeaturedStrip,
    // Sections we don't override fall back to Modern
    ServicesSection: ModernServicesSection,
    AboutSection: ModernAboutSection,
    VisitCard: ModernVisitCard,
    MenuItemCard: ClassicMenuItemCard,
  },
};

export const TEMPLATES = {
  modern: MODERN,
  classic: CLASSIC,
} as const;

export const TEMPLATE_OPTIONS: TemplateBundle[] = [MODERN, CLASSIC];

export function getTemplate(id: string | null | undefined): TemplateBundle {
  if (id && id in TEMPLATES) return TEMPLATES[id as keyof typeof TEMPLATES];
  return MODERN;
}
