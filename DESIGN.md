---
name: Equinox
description: A restrained monochrome strategy interface for balanced Pokemon team building.
colors:
  equilibrium-black: "#020405"
  deep-ink: "#07090c"
  twilight-surface: "#0a0d11c7"
  strong-surface: "#0e1116f0"
  soft-light-layer: "#ffffff0c"
  precise-border: "#ffffff1b"
  strong-border: "#ffffff2e"
  balanced-white: "#f6f5f1"
  muted-guidance: "#a6a6a0"
  quiet-subtle: "#73736e"
  inverse-ink: "#070707"
  light-paper: "#f5f4ef"
  light-paper-deep: "#ebe9e2"
  light-text: "#141412"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "clamp(32px, 5vw, 56px)"
    fontWeight: 950
    lineHeight: 0.95
    letterSpacing: "-0.06em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "32px"
    fontWeight: 950
    lineHeight: 1.1
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "18px"
    fontWeight: 950
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "11px"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "0.13em"
  symbol:
    fontFamily: "\"Segoe UI Symbol\", \"Noto Sans Symbols 2\", \"Apple Symbols\", ui-sans-serif, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 400
    lineHeight: 0.9
rounded:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "22px"
  xl: "30px"
  full: "999px"
spacing:
  2xs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.balanced-white}"
    textColor: "{colors.inverse-ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "42px"
  button-secondary:
    backgroundColor: "{colors.soft-light-layer}"
    textColor: "{colors.balanced-white}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "42px"
  card-default:
    backgroundColor: "{colors.twilight-surface}"
    textColor: "{colors.balanced-white}"
    rounded: "{rounded.lg}"
    padding: "24px"
  input-default:
    backgroundColor: "{colors.twilight-surface}"
    textColor: "{colors.balanced-white}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "56px"
  chip-default:
    backgroundColor: "{colors.soft-light-layer}"
    textColor: "{colors.muted-guidance}"
    rounded: "{rounded.full}"
    padding: "8px 10px"
---

# Design System: Equinox

## 1. Overview

**Creative North Star: "The Balanced Strategy Console"**

Equinox is a strategic product interface where balance is not decoration; it is the operating model. The system uses a restrained monochrome palette, measured spacing, high-contrast text, and progressive disclosure so complex team analysis feels organized instead of noisy.

The interface should feel modern, humanized, and directional: a calm strategist that helps the user understand synergy, compare options, and move forward. The visual identity rejects overloaded fan-site energy, generic SaaS gloss, and childish game theming. The Yin Yang symbol is a quiet identity anchor, not an excuse for ornament.

**Key Characteristics:**
- Restrained black, white, and gray identity with no decorative accent palette.
- Dense analytical content staged through panels, tabs, accordions, and compact metrics.
- Strong typography for hierarchy, compact labels for scanning, and readable body text for explanations.
- Layered surfaces with soft borders and controlled shadows, never visual noise.
- Motion limited to state feedback, loading, and short transitions.

## 2. Colors

The Equinox palette is monochrome with tonal contrast as the primary expressive tool.

### Primary
- **Balanced White**: The primary action and active-state color. Use it for generated-team CTAs, selected tabs, score bars, and the strongest text.
- **Equilibrium Black**: The default dark canvas. It carries the product mood and should remain the dominant dark-mode background.

### Neutral
- **Deep Ink**: Secondary dark depth for gradients and low-contrast background transitions.
- **Twilight Surface**: Main panel and control surface. Use for cards, inputs, selectors, and sidebar controls.
- **Strong Surface**: Higher-emphasis panels such as hero summaries and major result containers.
- **Soft Light Layer**: Subtle fill for nested metrics, chips, tags, input wells, and inactive segmented controls.
- **Precise Border**: Default 1px divider and surface outline.
- **Strong Border**: Focus, hover, selected outline, and alert-level separation.
- **Muted Guidance**: Secondary explanatory copy.
- **Quiet Subtle**: Labels, helper notes, and low-priority metadata.
- **Light Paper / Light Text**: Light-mode equivalents. Keep light mode restrained and neutral, not beige or playful.

### Named Rules

**The Monochrome Discipline Rule.** Black, white, and gray carry the identity. Do not add type-color palettes, rarity colors, neon accents, or decorative gradients unless the color communicates state.

**The Active State Rule.** Active and primary states invert the surface: white fill on dark mode, black text inside. This is the system's strongest signal and must stay rare.

## 3. Typography

**Display Font:** Inter with system sans fallbacks
**Body Font:** Inter with system sans fallbacks
**Label/Mono Font:** Inter with system sans fallbacks
**Symbol Font:** Segoe UI Symbol / Noto Sans Symbols / Apple Symbols for the Yin Yang mark only

**Character:** One compact sans family keeps the interface product-focused. Weight, spacing, and case create hierarchy; font switching is unnecessary and would weaken the sense of control.

### Hierarchy
- **Display** (950, fluid 32px to 56px, 0.95 line-height): Main app title and major result moments only.
- **Headline** (950, 32px, tight line-height): Empty states, loading states, and high-level result headings.
- **Title** (950, 18px, compact line-height): Cards, option tabs, metric groups, and detail headings.
- **Body** (400, 15px, 1.65 line-height): Explanations and coaching text. Keep prose blocks around 65-75ch where possible.
- **Label** (900-950, 10px to 12px, uppercase with tracked spacing): Section labels, metadata, status chips, and compact dashboard affordances.

### Named Rules

**The One-Family Rule.** Do not introduce display fonts, decorative type, or mono labels. Equinox earns personality through balance, density, and clear hierarchy.

**The Tight-But-Readable Rule.** Large headings may be tight, but never below -0.075em and never so large that Portuguese labels overflow on mobile.

**The Symbol Exception Rule.** The symbol stack exists only so the Yin Yang mark renders consistently. Do not use it for headings, labels, buttons, or body copy.

## 4. Elevation

Equinox uses a hybrid of tonal layering, translucent surfaces, 1px borders, and soft shadows. Depth should clarify the structure of the builder, not decorate it. Most nested analytical elements are flat inside a larger elevated surface; the page should not become a grid of floating objects.

### Shadow Vocabulary
- **Soft Surface Lift** (`0 10px 24px rgba(0, 0, 0, 0.22)`): Small reusable cards that need mild separation.
- **Panel Lift** (`0 18px 42px rgba(0, 0, 0, 0.34)`): Hero panels and strong containers.
- **Page Lift** (`0 20px 60px var(--eq-shadow)`): Main empty, loading, and result surfaces.
- **Deep Stage Lift** (`0 28px 80px rgba(0, 0, 0, 0.46)`): Rare large-stage moments only.

### Named Rules

**The One Container Lift Rule.** Elevate the parent section; keep the contents mostly flat. Nested cards should rely on border and tonal fill, not stacked shadows.

**The Focus Ring Rule.** Focus uses a visible soft ring, commonly `0 0 0 4px rgba(255, 255, 255, 0.06-0.07)`, paired with a stronger border.

## 5. Components

### Buttons
- **Shape:** Gently rectangular, not pill-shaped for main buttons (15-16px radius).
- **Primary:** White fill with inverse ink text, heavy weight, compact height (42-50px).
- **Hover / Focus:** Subtle upward movement up to 1px and stronger border. Focus must remain visible.
- **Secondary / Ghost:** Secondary buttons use soft translucent fill and a 1px border. Ghost buttons stay transparent and muted.

### Chips
- **Style:** Full-pill capsules with soft translucent fill, 1px border, compact 11-12px labels, and strong uppercase weight.
- **State:** Selected chips should invert like primary controls; inactive chips stay muted.

### Cards / Containers
- **Corner Style:** Strong but controlled curves (18-30px), with 22px as the common analytical panel radius.
- **Background:** Main containers use twilight or strong surfaces with subtle vertical light layering.
- **Shadow Strategy:** Parent surfaces may carry lift; nested metrics and detail cards should generally be flat.
- **Border:** Always 1px; dashed only for warnings, unknown states, or incomplete data.
- **Internal Padding:** Compact panels start at 14-18px; major panels use 24-42px depending on viewport.

### Inputs / Fields
- **Style:** Dark translucent surface, 1px border, 14px horizontal padding, 56px height for primary team inputs.
- **Focus:** Border strengthens and a soft white focus ring appears.
- **Error / Disabled:** Errors remain monochrome: stronger border, readable text, no red unless a future semantic system is deliberately added. Disabled controls reduce opacity and keep shape.

### Navigation
- **Style, typography, default/hover/active states, mobile treatment.** Sidebar navigation and selectors use compact stacked controls. Active selections invert to the primary white/ink treatment; inactive options remain muted. On smaller screens, the sticky sidebar becomes a top section and grids collapse to one or two columns.

### Signature Component: Battle Plan Hero

The battle plan hero is the system's strategic summary surface. It should combine a strong container, compact metrics, clear recommendation copy, and a subtle Yin Yang identity mark without overpowering the team recommendations below it.

## 6. Do's and Don'ts

### Do:
- **Do** preserve the black, white, and gray identity as the default design language.
- **Do** express balance through equal visual weight, clear spacing, and calm contrast.
- **Do** use white or black inversion for the strongest active state; this is the main accent.
- **Do** keep dense analysis readable through accordions, tabs, compact cards, and progressive disclosure.
- **Do** maintain visible focus states, reduced-motion support, and layouts that handle Portuguese text.

### Don't:
- **Don't** create noisy fan-site visuals, overloaded dashboards, excessive decorative color, childish game theming, generic SaaS gloss, or UI that feels more like a marketing landing page than a useful builder.
- **Don't** add decorative Pokemon-type color systems unless they serve an explicit state or data role.
- **Don't** stack card shadows inside card shadows; use tonal layers and 1px borders for nested detail.
- **Don't** use gradient text, side-stripe borders, decorative grid backgrounds, or large rounded cards beyond the existing Equinox vocabulary.
- **Don't** make the Yin Yang mark oversized or ornamental; it is an identity anchor, not page decoration.
