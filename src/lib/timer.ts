import type { CheerioAPI } from 'cheerio'

/** Matches `timer_1779073148.svg` (nesgamepro) and `1779503400.svg` (wurm-countdown). */
const TIMER_PATTERN = /(?:timer_)?(\d+)\.svg/i

export function parseTimerTimestamp(value: string | undefined): number | null {
  if (!value) return null
  const match = value.match(TIMER_PATTERN)
  return match ? Number(match[1]) : null
}

function isTimerImage(alt: string | undefined, src: string | undefined): boolean {
  return parseTimerTimestamp(alt) !== null || parseTimerTimestamp(src) !== null
}

export function findTimerAlt($: CheerioAPI): string | undefined {
  const legacy = $('img.ipsImage[alt*="timer_"], img.ipsImage[src*="timer_"]').first()
  if (legacy.length) {
    return legacy.attr('alt')?.trim() || legacy.attr('src')?.trim()
  }

  let found: string | undefined
  $('img.ipsImage').each((_, el) => {
    if (found) return false
    const alt = $(el).attr('alt')
    const src = $(el).attr('src')
    if (isTimerImage(alt, src)) {
      found = alt?.trim() || src?.trim()
      return false
    }
  })

  return found
}
