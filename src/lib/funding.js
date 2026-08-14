import { FUNDING_STATUS, ORG_IDS, ROLES } from '@/lib/constants'

export function sortByNewest(items) {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export function getChildOrganizations(organizations, parentId, type) {
  return organizations.filter(
    (org) => org.parentId === parentId && (!type || org.type === type),
  )
}

export function getParentOrganization(organizations, organizationId) {
  const current = organizations.find((org) => org.id === organizationId)
  if (!current?.parentId) return null
  return organizations.find((org) => org.id === current.parentId) || null
}

/**
 * Role-specific funding workspace configuration.
 */
export function getFundingWorkspaceConfig({ role, organizationId, organizations }) {
  const parent = getParentOrganization(organizations, organizationId)

  if (role === ROLES.ADMIN) {
    const recipients = getChildOrganizations(organizations, organizationId).sort(
      (a, b) => a.name.localeCompare(b.name),
    )
    return {
      title: 'Internet Credits Request',
      description:
        'Review subfranchisee deposits and release internet credits.',
      breadcrumb: 'Internet Credits Request',
      defaultTab: 'incoming',
      mode: 'internetCredits',
      showIncoming: true,
      showMine: false,
      showNewRequest: false,
      showDirectTransfer: false,
      showTransfersTab: false,
      showApprovedTab: true,
      incomingRequesterRole: ROLES.SUBFRANCHISEE,
      incomingRequesterRoles: [ROLES.SUBFRANCHISEE],
      incomingColumnLabel: 'Name',
      recipientLabel: 'Recipient',
      recipients,
      newRequestParentId: null,
      newRequestInfo:
        'Submit this form to request additional wallet funds from the Central Admin. Ensure your bank transfer is completed before submitting.',
    }
  }

  if (role === ROLES.SUBFRANCHISEE) {
    return {
      title: 'Internet Credits',
      description:
        'Request credits from Admin and release credits to your franchisees.',
      breadcrumb: 'Internet Credits',
      defaultTab: 'incoming',
      mode: 'internetCredits',
      showIncoming: true,
      showMine: true,
      showNewRequest: true,
      showDirectTransfer: false,
      showTransfersTab: false,
      showApprovedTab: true,
      incomingRequesterRole: ROLES.FRANCHISEE,
      incomingRequesterRoles: [ROLES.FRANCHISEE],
      incomingColumnLabel: 'Name',
      recipientLabel: 'Recipient Franchisee',
      recipients: getChildOrganizations(organizations, organizationId, 'franchisee'),
      newRequestParentId: parent?.id || ORG_IDS.PLATFORM,
      depositHop: 'sub_to_franchisee',
      myRequestHop: 'admin_to_sub',
      releaseSource: 'balance',
      incomingTabLabel: 'Downlines Credits Request',
      mineTabLabel: 'My Credits Request',
      newRequestInfo:
        'Submit a deposit proof to request internet credits from Admin. Credits = deposit ÷ your deposit rate.',
    }
  }

  if (role === ROLES.FRANCHISEE) {
    const buyRateLabel = 'your configured buy rate'
    const sellNote = 'configured per-retailer rates'
    return {
      title: 'Internet Credits',
      description: `Request credits from your Sub-Franchisee (${buyRateLabel}) and release credits to retailers from your Available Credits (${sellNote}). Cash + proof only — no cashless direct transfer.`,
      breadcrumb: 'Internet Credits',
      defaultTab: 'incoming',
      mode: 'internetCredits',
      showIncoming: true,
      showMine: true,
      showNewRequest: true,
      showDirectTransfer: false,
      showTransfersTab: false,
      showApprovedTab: true,
      incomingRequesterRole: ROLES.RETAILER,
      incomingRequesterRoles: [ROLES.RETAILER],
      incomingColumnLabel: 'Name',
      recipientLabel: 'Recipient Retailer',
      recipients: getChildOrganizations(organizations, organizationId, 'retailer'),
      newRequestParentId: parent?.id || ORG_IDS.SUB_001,
      depositHop: 'franchisee_to_retailer',
      myRequestHop: 'sub_to_franchisee',
      releaseSource: 'balance',
      incomingTabLabel: 'Retailers Credits Request',
      mineTabLabel: 'My Credits Request',
      newRequestInfo:
        'Submit a deposit proof to request internet credits from your Sub-Franchisee. Credits = deposit ÷ your deposit rate (see Deposit Rates / request calculator).',
    }
  }

  // Retailer — buy-only internet credits from Franchisee
  return {
    title: 'Internet Credits',
    description:
      'Request internet credits from your Franchisee at your configured deposit rate (credits = deposit ÷ rate). Releases land in your Available Credits for internet sales.',
    breadcrumb: 'Internet Credits',
    defaultTab: 'mine',
    mode: 'internetCredits',
    showIncoming: false,
    showMine: true,
    showNewRequest: true,
    showDirectTransfer: false,
    showTransfersTab: false,
    showApprovedTab: true,
    incomingRequesterRole: null,
    incomingColumnLabel: 'Requesting Organization',
    recipientLabel: 'Recipient',
    recipients: [],
    newRequestParentId: parent?.id || ORG_IDS.FRANCHISE_001,
    myRequestHop: 'franchisee_to_retailer',
    releaseSource: 'balance',
    mineTabLabel: 'My Credits Request',
    newRequestInfo:
      'Submit a deposit proof to request internet credits from your Franchisee. Credits = deposit ÷ your deposit rate (shown in the calculator).',
  }
}

export function getFundingDatasets({
  role,
  organizationId,
  requests,
  transfers,
  config,
}) {
  const allowedRequesterRoles = Array.isArray(config.incomingRequesterRoles)
    ? config.incomingRequesterRoles
    : config.incomingRequesterRole
      ? [config.incomingRequesterRole]
      : []

  const incoming = config.showIncoming
    ? sortByNewest(
        requests.filter(
          (request) =>
            request.parentOrganizationId === organizationId &&
            (allowedRequesterRoles.length === 0 ||
              allowedRequesterRoles.includes(request.requesterRole)) &&
            request.status === FUNDING_STATUS.PENDING,
        ),
      )
    : []

  const mine = sortByNewest(
    requests.filter((request) => request.organizationId === organizationId),
  )

  const approved = sortByNewest(
    requests.filter((request) => {
      const related =
        request.parentOrganizationId === organizationId ||
        request.organizationId === organizationId
      const done =
        request.status === FUNDING_STATUS.APPROVED ||
        request.status === FUNDING_STATUS.COMPLETED ||
        request.status === FUNDING_STATUS.RELEASED ||
        request.status === FUNDING_STATUS.REVERSED ||
        request.status === FUNDING_STATUS.REJECTED
      return related && done
    }),
  )

  const relatedTransfers = sortByNewest(
    transfers.filter(
      (transfer) =>
        transfer.fromOrganizationId === organizationId ||
        transfer.toOrganizationId === organizationId,
    ),
  )

  // Admin sees platform-wide transfer history involving the platform org
  if (role === ROLES.ADMIN) {
    return {
      incoming,
      mine,
      approved: sortByNewest(
        requests.filter(
          (request) =>
            (request.parentOrganizationId === organizationId ||
              request.organizationId === organizationId) &&
            (request.status === FUNDING_STATUS.APPROVED ||
              request.status === FUNDING_STATUS.COMPLETED ||
              request.status === FUNDING_STATUS.RELEASED ||
              request.status === FUNDING_STATUS.REVERSED ||
              request.status === FUNDING_STATUS.REJECTED),
        ),
      ),
      transfers: relatedTransfers,
    }
  }

  return { incoming, mine, approved, transfers: relatedTransfers }
}
