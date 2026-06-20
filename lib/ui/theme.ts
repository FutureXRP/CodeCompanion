/**
 * CodeCompanion design tokens — "Sage" palette on Inter type.
 *
 * Warm, human, premium: a sage-green primary on a warm off-white canvas, with
 * clay + gold accents. Inter throughout (set globally in globals.css). Pages use
 * these values so the whole platform reads as one finished product. Import these
 * rather than hardcoding hexes.
 */
export const COLORS = {
  ink: '#1f2d27', // primary text — warm near-black
  sub: '#65726b', // secondary text
  faint: '#9aa69f', // tertiary / labels
  line: '#ece7dd', // hairlines / borders
  bg: '#f7f5f0', // app canvas (also set in globals)
  panel: '#ffffff', // cards
  panelWarm: '#fffefb', // subtly warm card variant

  sage: '#3f7d6a', // primary accent (links, active nav, section labels)
  sage2: '#57997f', // lighter sage (gradients)
  sageDeep: '#34685a', // deep sage (hero gradient end)
  clay: '#c9744b', // warm highlight (greetings, accents)
  gold: '#b8862a', // amber / "to collect" / warnings
  green: '#2f8a5b', // positive / collected / good
  red: '#cf5547', // denials / errors / bad
} as const

/** Soft tonal backgrounds for chips/badges, keyed to a status tone. */
export const TONE = {
  neutral: { fg: COLORS.sage, bg: '#e7f0eb' },
  good: { fg: COLORS.green, bg: '#e6f4ec' },
  warn: { fg: COLORS.gold, bg: '#f6efdd' },
  bad: { fg: COLORS.red, bg: '#fae9e6' },
} as const

export const RADIUS = { card: 16, control: 10, pill: 999 } as const
export const SHADOW = '0 1px 2px rgba(31,45,39,.04), 0 10px 28px rgba(31,45,39,.055)' as const

/** The sage hero gradient used for the headline money figure. */
export const HERO_GRADIENT = `linear-gradient(140deg, ${COLORS.sageDeep} 0%, ${COLORS.sage} 60%, ${COLORS.sage2} 100%)`
/** The primary button gradient. */
export const BUTTON_GRADIENT = `linear-gradient(135deg, ${COLORS.sage2} 0%, ${COLORS.sageDeep} 100%)`
