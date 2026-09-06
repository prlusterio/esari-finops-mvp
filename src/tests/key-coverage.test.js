import { describe, expect, it } from 'vitest'
import {
  ADMIN_PREFIX,
  FRANCHISEE_PREFIX,
  RETAILER_PREFIX,
  backendNamespaceForRole,
  isKnownRole,
  normalizeRole,
  resolveApiPrefix,
} from '@/lib/api/roles'
import { API_TOKEN_STORAGE_KEY } from '@/lib/api/config'
import { STORAGE_KEYS } from '@/lib/constants'

describe('spec 02 §17 key coverage: roles + storage keys', () => {
  it('normalizes the UI subfranchisee role to the subfranchisor namespace', () => {
    expect(normalizeRole('subfranchisee')).toBe('subfranchisee')
    expect(normalizeRole('subfranchisor')).toBe('subfranchisee')
    expect(backendNamespaceForRole('subfranchisee')).toBe('subfranchisor')
    expect(backendNamespaceForRole('admin')).toBe('admin')
  })

  it('resolves all four role prefixes', () => {
    expect(resolveApiPrefix('admin')).toBe(ADMIN_PREFIX)
    expect(resolveApiPrefix('franchisee')).toBe(FRANCHISEE_PREFIX)
    expect(resolveApiPrefix('retailer')).toBe(RETAILER_PREFIX)
    expect(resolveApiPrefix('subfranchisee')).toContain('/subfranchisor')
    ;['admin', 'subfranchisee', 'franchisee', 'retailer'].forEach((role) => {
      expect(isKnownRole(role)).toBe(true)
    })
  })

  it('keeps only api_token after mock retirement; every other key is esarisari_*', () => {
    expect(API_TOKEN_STORAGE_KEY).toBe('api_token')
    const values = Object.values(STORAGE_KEYS)
    expect(values.length).toBeGreaterThan(5)
    values.forEach((key) => {
      expect(key.startsWith('esarisari_')).toBe(true)
      expect(key).not.toBe('api_token')
    })
    expect(values).toContain('esarisari_users')
    expect(values).toContain('esarisari_session')
    expect(values).toContain('esarisari_organizations')
    expect(values).toContain('esarisari_wallets')
    expect(values).toContain('esarisari_funding_requests')
    expect(values).toContain('esarisari_funding_transfers')
    expect(values).toContain('esarisari_deposit_rates')
    expect(values).toContain('esarisari_commission_settings')
    expect(values).toContain('esarisari_transactions')
    expect(values).toContain('esarisari_notification_reads')
    expect(values).toContain('esarisari_registered_clients')
    expect(values).toContain('esarisari_client_status_overrides')
    expect(values).toContain('esarisari_franchise_collections')
  })
})
