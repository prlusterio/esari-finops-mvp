import { TRANSACTION_STATUS } from '@/lib/constants'
import {
  COMMISSION_STATUS,
  DEFAULT_PLATFORM_FEE_PERCENTAGE,
  normalizeCommissionShares,
  resolveCommissionHierarchy,
} from '@/lib/commission'
import { reconcileRevenueWallets } from '@/data/seed'
import {
  estimateDemoSaleCosts,
  matchProductServiceToPayment,
  pickRandomDemoProduct,
} from '@/lib/transactions'
import { getOperatingWallet } from '@/services/fundingActions'
import {
  getCommissionSettings,
  getOrganizations,
  getTransactions,
  getWallets,
  saveTransactions,
  saveWallets,
} from '@/services/storage'

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

function createNextTransactionId(existing) {
  const stamp = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  const id = `TX-${stamp}-${rand}`
  if ((existing || []).some((tx) => tx.id === id)) {
    return createNextTransactionId(existing)
  }
  return id
}

function randomCustomerReference() {
  const prefix = 17 + Math.floor(Math.random() * 10)
  const mid = String(100 + Math.floor(Math.random() * 900)).padStart(3, '0')
  const last = String(1000 + Math.floor(Math.random() * 9000)).slice(-4)
  return `09${prefix}-${mid}-${last}`
}

function resolveSharesForRetailer(retailer, orgById, settings) {
  const hierarchy = resolveCommissionHierarchy(retailer, orgById)
  const configured = (settings || [])
    .filter((entry) => entry.retailerOrganizationId === retailer.id)
    .sort((left, right) => {
      if (
        left.status === COMMISSION_STATUS.ACTIVE &&
        right.status !== COMMISSION_STATUS.ACTIVE
      ) {
        return -1
      }
      if (
        right.status === COMMISSION_STATUS.ACTIVE &&
        left.status !== COMMISSION_STATUS.ACTIVE
      ) {
        return 1
      }
      return 0
    })[0]

  if (configured) {
    return {
      hierarchy,
      shares: normalizeCommissionShares({
        retailerPercentage: configured.retailerPercentage,
        franchiseePercentage: hierarchy.hasFranchisee
          ? configured.franchiseePercentage
          : 0,
        companyPercentage:
          configured.companyPercentage ?? DEFAULT_PLATFORM_FEE_PERCENTAGE,
        remainderTarget: hierarchy.remainderTarget,
      }),
    }
  }

  return {
    hierarchy,
    shares: normalizeCommissionShares({
      retailerPercentage: 0,
      franchiseePercentage: 0,
      companyPercentage: DEFAULT_PLATFORM_FEE_PERCENTAGE,
      remainderTarget: hierarchy.remainderTarget,
    }),
  }
}

function buildCompletedSale({
  id,
  createdAt,
  retailer,
  hierarchy,
  shares,
  costs,
  productService,
  customerReference,
}) {
  const distributableRevenue = costs.saleMargin
  const retailerShare = roundMoney(
    (distributableRevenue * shares.retailerPercentage) / 100,
  )

  return {
    id,
    reference: id,
    createdAt,
    updatedAt: createdAt,
    retailerOrganizationId: retailer.id,
    franchiseeOrganizationId: hierarchy.franchisee?.id || '',
    subfranchiseeOrganizationId: hierarchy.subfranchisee?.id || '',
    retailerName: retailer.name,
    retailerCode: retailer.code,
    customerPayment: costs.customerPayment,
    baseCost: costs.baseCost,
    platformProcessingFee: costs.platformProcessingFee,
    walletDeduction: costs.walletDeduction,
    distributableRevenue,
    retailerShare,
    retailerPercentage: shares.retailerPercentage,
    franchiseePercentage: shares.franchiseePercentage,
    subfranchiseePercentage: shares.subfranchiseePercentage,
    companyPercentage: shares.companyPercentage,
    totalDistributed: distributableRevenue,
    productService: matchProductServiceToPayment(
      productService,
      costs.customerPayment,
    ),
    customerReference,
    status: TRANSACTION_STATUS.COMPLETED,
  }
}

/**
 * Records a completed retailer internet sale: burns Available Credits,
 * stamps commission shares, and refreshes revenue wallets for uplines.
 */
export function createRetailerDemoSale({
  organizationId,
  customerPayment,
  productService,
} = {}) {
  const payment = Number(customerPayment)
  if (!organizationId) {
    throw new Error('Retailer organization is required.')
  }
  if (!Number.isFinite(payment) || payment <= 0) {
    throw new Error('Enter an amount greater than 0.')
  }

  const organizations = getOrganizations()
  const orgById = Object.fromEntries(organizations.map((org) => [org.id, org]))
  const retailer = orgById[organizationId]
  if (!retailer || retailer.type !== 'retailer') {
    throw new Error('Only a retailer can record a demo sale.')
  }

  const costs = estimateDemoSaleCosts(payment)
  if (costs.walletDeduction <= 0) {
    throw new Error('Enter an amount greater than 0.')
  }

  const wallets = getWallets()
  const wallet = getOperatingWallet(wallets, organizationId)
  if (!wallet) {
    throw new Error('Unable to locate this retailer wallet.')
  }

  const available = roundMoney(Number(wallet.availableBalance) || 0)
  if (costs.walletDeduction > available) {
    throw new Error(
      `Not enough Available Credits. This sale needs ₱${costs.walletDeduction.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
    )
  }

  const { hierarchy, shares } = resolveSharesForRetailer(
    retailer,
    orgById,
    getCommissionSettings(),
  )
  const existing = getTransactions()
  const now = new Date().toISOString()
  const id = createNextTransactionId(existing)
  const resolvedProduct =
    String(productService || '').trim() || pickRandomDemoProduct()
  const transaction = buildCompletedSale({
    id,
    createdAt: now,
    retailer,
    hierarchy,
    shares,
    costs,
    productService: resolvedProduct,
    customerReference: randomCustomerReference(),
  })

  const remaining = roundMoney(available - costs.walletDeduction)
  saveWallets(
    wallets.map((entry) =>
      entry.id === wallet.id
        ? { ...entry, availableBalance: remaining, updatedAt: now }
        : entry,
    ),
  )
  saveTransactions([transaction, ...existing])
  reconcileRevenueWallets()

  return { transaction, remainingCredits: remaining }
}
