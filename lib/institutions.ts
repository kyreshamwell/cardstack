// lib/institutions.ts
//
// Maps bank names → their real login homepage.
//
// Earlier versions of this file guessed at specific "payment" deep-paths
// (e.g. chase.com/consumer/funding) and custom app URL schemes
// (e.g. chase://). Both were live-tested and nearly all of them were wrong —
// 404s, redirects to error pages, or app schemes that don't actually exist.
//
// The reliable alternative: link to the bank's plain homepage. It always
// exists, always has a visible sign-in, and — for banks that support Apple's
// Universal Links (which most large banks do) — iOS will automatically offer
// to open the bank's app instead of Safari if it's installed. No guessing
// required; this is the same mechanism the OS uses for any other https link.

interface InstitutionInfo {
  webUrl: string
}

const NAME_PATTERNS: Array<{ pattern: RegExp } & InstitutionInfo> = [
  { pattern: /american express|amex/i, webUrl: 'https://www.americanexpress.com' },
  { pattern: /chase/i, webUrl: 'https://www.chase.com' },
  { pattern: /bank of america|bofa/i, webUrl: 'https://www.bankofamerica.com' },
  { pattern: /citi/i, webUrl: 'https://www.citi.com' },
  { pattern: /wells fargo/i, webUrl: 'https://www.wellsfargo.com' },
  { pattern: /us bank/i, webUrl: 'https://www.usbank.com' },
  { pattern: /capital one/i, webUrl: 'https://www.capitalone.com' },
  { pattern: /discover/i, webUrl: 'https://www.discover.com' },
  { pattern: /barclays/i, webUrl: 'https://www.barclaycardus.com' },
  { pattern: /synchrony/i, webUrl: 'https://www.mysynchrony.com' },
]

/**
 * Returns the bank's homepage URL for the given institution name.
 * Returns null if the bank isn't in our list (button won't be shown).
 */
export function getInstitutionInfo(institutionName: string): InstitutionInfo | null {
  for (const entry of NAME_PATTERNS) {
    if (entry.pattern.test(institutionName)) {
      return { webUrl: entry.webUrl }
    }
  }
  return null
}
