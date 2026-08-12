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
      title: 'Token Credits Requests & Transfers',
      description: 'Manage inbound funding requests and execute outbound transfers.',
      breadcrumb: 'Token Credits Requests & Transfers',
      defaultTab: 'incoming',
      showIncoming: true,
      showMine: false,
      showNewRequest: false,
      showDirectTransfer: true,
      incomingRequesterRole: ROLES.SUBFRANCHISEE,
      incomingRequesterRoles: [
        ROLES.SUBFRANCHISEE,
        ROLES.FRANCHISEE,
        ROLES.RETAILER,
      ],
      incomingColumnLabel: 'Requesting Organization',
      recipientLabel: 'Recipient',
      recipients,
      newRequestParentId: null,
      newRequestInfo:
        'Submit this form to request additional wallet funds from the Central Admin. Ensure your bank transfer is completed before submitting.',
    }
  }

  if (role === ROLES.SUBFRANCHISEE) {
    return {
      title: 'Token Credits Requests & Transfers',
      description: 'Manage inbound funding requests and execute outbound transfers.',
      breadcrumb: 'Token Credits Requests & Transfers',
      defaultTab: 'incoming',
      showIncoming: true,
      showMine: true,
      showNewRequest: true,
      showDirectTransfer: true,
      incomingRequesterRole: ROLES.FRANCHISEE,
      incomingColumnLabel: 'Requesting Franchisee',
      recipientLabel: 'Recipient Franchisee',
      recipients: getChildOrganizations(organizations, organizationId, 'franchisee'),
      newRequestParentId: parent?.id || ORG_IDS.PLATFORM,
      newRequestInfo:
        'Submit this form to request additional wallet funds from the Central Admin. Ensure your bank transfer is completed before submitting.',
    }
  }

  if (role === ROLES.FRANCHISEE) {
    return {
      title: 'Token Credits Requests & Transfers',
      description: 'Manage inbound funding requests and execute outbound transfers.',
      breadcrumb: 'Token Credits Requests & Transfers',
      defaultTab: 'incoming',
      showIncoming: true,
      showMine: true,
      showNewRequest: true,
      showDirectTransfer: true,
      incomingRequesterRole: ROLES.RETAILER,
      incomingColumnLabel: 'Requesting Retailer',
      recipientLabel: 'Recipient Retailer',
      recipients: getChildOrganizations(organizations, organizationId, 'retailer'),
      newRequestParentId: parent?.id || ORG_IDS.SUB_001,
      newRequestInfo:
        'Submit this form to request additional wallet funds from your Sub-Franchisee. Ensure your bank transfer is completed before submitting.',
    }
  }

  // Retailer — no incoming requests, no direct transfer
  return {
    title: 'Token Credits Requests & Transfers',
    description: 'Submit funding requests and track transfers for your retailer wallet.',
    breadcrumb: 'Token Credits Requests & Transfers',
    defaultTab: 'mine',
    showIncoming: false,
    showMine: true,
    showNewRequest: true,
    showDirectTransfer: false,
    incomingRequesterRole: null,
    incomingColumnLabel: 'Requesting Organization',
    recipientLabel: 'Recipient',
    recipients: [],
    newRequestParentId: parent?.id || ORG_IDS.FRANCHISE_001,
    newRequestInfo:
      'Submit this form to request additional wallet funds from your Franchisee. Ensure your bank transfer is completed before submitting.',
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
        request.status === FUNDING_STATUS.COMPLETED
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
              request.status === FUNDING_STATUS.COMPLETED),
        ),
      ),
      transfers: relatedTransfers,
    }
  }

  return { incoming, mine, approved, transfers: relatedTransfers }
}
