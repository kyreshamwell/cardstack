import { describe, expect, it } from 'vitest'
import { getInstitutionInfo } from '@/lib/institutions'

describe('getInstitutionInfo', () => {
  it('matches a bank by name', () => {
    expect(getInstitutionInfo('Chase')?.webUrl).toContain('chase.com')
  })

  it('matches regardless of case or surrounding words', () => {
    // Plaid returns names like "Chase Bank" or "CAPITAL ONE".
    expect(getInstitutionInfo('CAPITAL ONE')?.webUrl).toContain('capitalone.com')
    expect(getInstitutionInfo('Chase Bank')?.webUrl).toContain('chase.com')
  })

  it('matches Amex under either name Plaid might return', () => {
    const full = getInstitutionInfo('American Express')
    const short = getInstitutionInfo('Amex')
    expect(full?.webUrl).toContain('americanexpress.com')
    expect(short?.webUrl).toBe(full?.webUrl)
  })

  it('returns null for an unmapped bank so no button is rendered', () => {
    // Better a missing button than a link to a guessed URL that 404s.
    expect(getInstitutionInfo('Some Credit Union')).toBeNull()
    expect(getInstitutionInfo('')).toBeNull()
  })

  it('exposes an app scheme only where one is confirmed to work', () => {
    // Capital One's scheme was verified on a real device; Amex has none that
    // exists, so it must stay undefined rather than shipping a dead link.
    expect(getInstitutionInfo('Capital One')?.appScheme).toBe('capitalone://')
    expect(getInstitutionInfo('American Express')?.appScheme).toBeUndefined()
  })

  it('points Chase at the path listed in its Universal Links file', () => {
    // Only this path opens the Chase app; the bare domain does not.
    expect(getInstitutionInfo('Chase')?.webUrl).toContain('/digital/mobile-banking')
  })

  it('always returns an https url when it returns anything', () => {
    for (const name of ['Chase', 'Amex', 'Discover', 'Citi', 'Wells Fargo']) {
      expect(getInstitutionInfo(name)?.webUrl.startsWith('https://')).toBe(true)
    }
  })
})
