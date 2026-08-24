// Derives a full, WCAG-contrast-safe set of CSS tokens from a single
// researcher-chosen background color, so "any color" stays a genuinely
// legible page and not just a colored background with hardcoded cream text
// (exactly the class of bug the sociogram canvas had earlier — a background
// swap without recomputing what sits on top of it).
//
// The core guarantee is mathematical, not a heuristic: for any RGB
// background, max(contrastRatio(bg, white), contrastRatio(bg, black)) is
// always >= ~4.6 (a well-known WCAG property — the two contrast ratios
// multiply to ~21). Picking whichever of pure white/black contrasts better
// against the chosen background is therefore always at least WCAG AA
// (4.5:1) for normal text, for literally any input color.

export interface CustomThemeTokens {
  background: string
  foreground: string
  card: string
  cardForeground: string
  popover: string
  popoverForeground: string
  muted: string
  mutedForeground: string
  secondary: string
  secondaryForeground: string
  accent: string
  accentForeground: string
  border: string
  input: string
  ring: string
}

type RGB = { r: number; g: number; b: number }

function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean
  const n = parseInt(full, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbToHex({ r, g, b }: RGB): string {
  const h = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

function relativeLuminance({ r, g, b }: RGB): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrastRatio(a: RGB, b: RGB): number {
  const l1 = relativeLuminance(a), l2 = relativeLuminance(b)
  const lighter = Math.max(l1, l2), darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function rgbToHsl({ r, g, b }: RGB): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6
  return [h * 360, s, l]
}

function hslToRgb(h: number, s: number, l: number): RGB {
  h /= 360
  if (s === 0) { const v = l * 255; return { r: v, g: v, b: v } }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return {
    r: hue2rgb(p, q, h + 1 / 3) * 255,
    g: hue2rgb(p, q, h) * 255,
    b: hue2rgb(p, q, h - 1 / 3) * 255,
  }
}

// Shifts lightness toward or away from the chosen foreground's tone. When
// `awayFromFg` is true (the normal case for surfaces like card/popover),
// the shift moves lightness further from the foreground's own luminance —
// which can only ever *improve* contrast for that foreground, never
// reduce it below the base background's already-verified contrast.
function shiftLightness(hex: string, deltaPercent: number, darken: boolean): string {
  const [h, s, l] = rgbToHsl(hexToRgb(hex))
  const delta = deltaPercent / 100
  const newL = darken ? Math.max(0, l - delta) : Math.min(1, l + delta)
  return rgbToHex(hslToRgb(h, s, newL))
}

function blend(hexA: string, hexB: string, weightA: number): string {
  const a = hexToRgb(hexA), b = hexToRgb(hexB)
  return rgbToHex({
    r: a.r * weightA + b.r * (1 - weightA),
    g: a.g * weightA + b.g * (1 - weightA),
    b: a.b * weightA + b.b * (1 - weightA),
  })
}

export function deriveCustomTheme(backgroundHex: string): CustomThemeTokens {
  const bg = hexToRgb(backgroundHex)
  const white: RGB = { r: 255, g: 255, b: 255 }
  const black: RGB = { r: 0, g: 0, b: 0 }
  const useWhiteText = contrastRatio(bg, white) >= contrastRatio(bg, black)
  const foreground = useWhiteText ? '#FFFFFF' : '#000000'

  // Darken surfaces when text is white (moves further from white, away
  // from bg — always improves white-text contrast); lighten when text is
  // black (same logic, opposite direction).
  const darken = useWhiteText

  const card = shiftLightness(backgroundHex, 6, darken)
  const popover = shiftLightness(backgroundHex, 22, darken) // deepest surface — menus/dropdowns
  const muted = shiftLightness(backgroundHex, 4, darken)
  const secondary = shiftLightness(backgroundHex, 10, darken)
  const accent = shiftLightness(backgroundHex, 8, darken)

  const mutedForeground = blend(foreground, backgroundHex, 0.72)
  const borderAlpha = useWhiteText ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)'

  return {
    background: backgroundHex,
    foreground,
    card,
    cardForeground: foreground,
    popover,
    popoverForeground: foreground,
    muted,
    mutedForeground,
    secondary,
    secondaryForeground: foreground,
    accent,
    accentForeground: foreground,
    border: borderAlpha,
    input: borderAlpha,
    ring: foreground,
  }
}

export function customThemeToCSSVars(tokens: CustomThemeTokens): React.CSSProperties {
  return {
    '--background': tokens.background,
    '--foreground': tokens.foreground,
    '--card': tokens.card,
    '--card-foreground': tokens.cardForeground,
    '--popover': tokens.popover,
    '--popover-foreground': tokens.popoverForeground,
    '--muted': tokens.muted,
    '--muted-foreground': tokens.mutedForeground,
    '--secondary': tokens.secondary,
    '--secondary-foreground': tokens.secondaryForeground,
    '--accent': tokens.accent,
    '--accent-foreground': tokens.accentForeground,
    '--border': tokens.border,
    '--input': tokens.input,
    '--ring': tokens.ring,
  } as React.CSSProperties
}
