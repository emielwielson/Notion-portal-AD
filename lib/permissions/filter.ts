/**
 * Role-based column filtering per PRD FR-13 / FR-14
 * Customer: Status, Adres 1, Adres 2, Contract ondertekend, Factuur betaald
 * Contractor: Status, Adres 1, Adres 2, Type, Meeting
 */

export const CUSTOMER_COLUMNS = [
  'title',
  'status',
  'adres1',
  'adres2',
  'contractOndertekend',
  'factuurBetaald',
] as const

export const CONTRACTOR_COLUMNS = [
  'title',
  'status',
  'adres1',
  'adres2',
  'type',
  'meeting',
] as const

export function filterProjectProperties(
  properties: Record<string, unknown>,
  contactType: 'customer' | 'contractor'
): Record<string, unknown> {
  const allowed =
    contactType === 'customer' ? CUSTOMER_COLUMNS : CONTRACTOR_COLUMNS
  const out: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in properties) {
      out[key] = properties[key]
    }
  }
  return out
}
