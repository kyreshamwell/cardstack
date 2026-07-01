// lib/institutions.ts
//
// Maps bank names → payment URLs and mobile app deep links.
// Name-pattern matching is used instead of Plaid institution IDs because
// Plaid's internal IDs are not stable across environments and I don't have a
// reliable ID→bank mapping. Regex on the institution_name string is more robust.

interface InstitutionInfo {
  webUrl: string
  appLink: string | null  // iOS/Android custom URL scheme, null if unknown
}

const NAME_PATTERNS: Array<{ pattern: RegExp } & InstitutionInfo> = [
  {
    pattern: /american express|amex/i,
    webUrl: 'https://www.americanexpress.com/en-us/account/pay',
    appLink: 'amex://',
  },
  {
    pattern: /chase/i,
    webUrl: 'https://account.chase.com/consumer/funding',
    appLink: 'chase://',
  },
  {
    pattern: /bank of america|bofa/i,
    webUrl: 'https://www.bankofamerica.com/credit-cards/payments',
    appLink: 'bofa://',
  },
  {
    pattern: /citi/i,
    webUrl: 'https://online.citibank.com',
    appLink: 'citi://',
  },
  {
    pattern: /wells fargo/i,
    webUrl: 'https://www.wellsfargo.com/credit-cards/payment',
    appLink: 'wellsfargo://',
  },
  {
    pattern: /us bank/i,
    webUrl: 'https://www.usbank.com/credit-cards',
    appLink: 'usbank://',
  },
  {
    pattern: /capital one/i,
    webUrl: 'https://www.capitalone.com/credit-cards/payments',
    appLink: 'capitalone://',
  },
  {
    pattern: /discover/i,
    webUrl: 'https://www.discover.com/credit-cards/pay-bill',
    appLink: 'discover://',
  },
  {
    pattern: /barclays/i,
    webUrl: 'https://www.barclaysus.com',
    appLink: null,
  },
  {
    pattern: /synchrony/i,
    webUrl: 'https://www.synchronybank.com',
    appLink: null,
  },
]

/**
 * Returns the payment URL and mobile app deep link for the given institution name.
 * Returns null if the bank isn't in our list (button won't be shown).
 */
export function getInstitutionInfo(institutionName: string): InstitutionInfo | null {
  for (const entry of NAME_PATTERNS) {
    if (entry.pattern.test(institutionName)) {
      return { webUrl: entry.webUrl, appLink: entry.appLink }
    }
  }
  return null
}
