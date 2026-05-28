// lib/institutions.ts
//
// Maps Plaid institution IDs to their credit card payment page URLs.
// When a user clicks "Pay" on a card, we link them directly to their bank's
// payment page rather than a generic homepage.
//
// To find an institution's Plaid ID: dashboard.plaid.com → Search institutions
// or check the institution_id stored in your connected_accounts table.

export const INSTITUTION_PAYMENT_URLS: Record<string, string> = {
  ins_3:    'https://account.chase.com/consumer/funding',          // Chase
  ins_4:    'https://www.bankofamerica.com/credit-cards/payments', // Bank of America
  ins_5:    'https://online.citibank.com',                         // Citi
  ins_6:    'https://www.wellsfargo.com/credit-cards/payment',     // Wells Fargo
  ins_7:    'https://www.usbank.com/credit-cards',                 // US Bank
  ins_8:    'https://www.americanexpress.com/en-us/account/pay',   // Amex
  ins_9:    'https://www.capitalone.com/credit-cards/payments',    // Capital One
  ins_10:   'https://www.discover.com/credit-cards/pay-bill',      // Discover
  ins_12:   'https://www.barclaysus.com',                          // Barclays
  ins_13:   'https://www.synchronybank.com',                       // Synchrony
}

/**
 * Returns the payment URL for a given Plaid institution ID.
 * Falls back to a Google search for the institution if we don't have it mapped.
 */
export function getPaymentUrl(institutionId: string, institutionName: string): string {
  return (
    INSTITUTION_PAYMENT_URLS[institutionId] ??
    `https://www.google.com/search?q=${encodeURIComponent(institutionName + ' credit card payment')}`
  )
}
