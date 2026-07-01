// lib/institutions.ts
//
// Maps bank names → payment destinations.
//
// Two mechanisms exist for opening a bank's mobile app from a link:
//   1. Universal Links — a normal https:// URL that iOS intercepts if the
//      path is listed in the bank's public /.well-known/apple-app-site-association
//      file. Verifiable by fetching that file directly — no guessing.
//   2. Custom URL schemes (bankname://) — undocumented and NOT guessable.
//      Only include one here if it's been empirically confirmed to open the
//      real app on a real device. A guessed scheme that doesn't exist just
//      silently fails or shows an OS error — worse than no attempt at all.
//
// Do not add an appScheme for a bank without a confirmed, working test.
// Do not assume a bank's homepage is Universal-Link-eligible — check its
// apple-app-site-association file first.

interface InstitutionInfo {
  webUrl: string
  appScheme?: string // only set when confirmed working on a real device
}

const NAME_PATTERNS: Array<{ pattern: RegExp } & InstitutionInfo> = [
  {
    pattern: /american express|amex/i,
    webUrl: 'https://www.americanexpress.com',
    // No working app-open path exists: Amex's AASA file only covers /go/*
    // short-links, not account/bill-pay, and the amex:// scheme does not exist.
  },
  {
    pattern: /capital one/i,
    webUrl: 'https://www.capitalone.com',
    appScheme: 'capitalone://', // confirmed opening the app on a real device
  },
  {
    pattern: /chase/i,
    // This exact path is listed in Chase's public apple-app-site-association
    // file, so iOS will offer to open the Chase app automatically — no
    // custom scheme needed.
    webUrl: 'https://www.chase.com/digital/mobile-banking',
  },
  { pattern: /bank of america|bofa/i, webUrl: 'https://www.bankofamerica.com' },
  { pattern: /citi/i, webUrl: 'https://www.citi.com' },
  { pattern: /wells fargo/i, webUrl: 'https://www.wellsfargo.com' },
  { pattern: /us bank/i, webUrl: 'https://www.usbank.com' },
  { pattern: /discover/i, webUrl: 'https://www.discover.com' },
  { pattern: /barclays/i, webUrl: 'https://www.barclaycardus.com' },
  { pattern: /synchrony/i, webUrl: 'https://www.mysynchrony.com' },
]

/**
 * Returns payment destination info for the given institution name.
 * Returns null if the bank isn't in our list (button won't be shown).
 */
export function getInstitutionInfo(institutionName: string): InstitutionInfo | null {
  for (const entry of NAME_PATTERNS) {
    if (entry.pattern.test(institutionName)) {
      return { webUrl: entry.webUrl, appScheme: entry.appScheme }
    }
  }
  return null
}
