/**
 * Sub-Franchisee API DTOs.
 * Field names match the current localStorage records so a later swap
 * can reuse page/lib code with minimal mapping.
 *
 * Backend path prefix is `/api/v1/subfranchisor` (admin-v3).
 * The MVP role string stays `subfranchisee`.
 */

/**
 * @typedef {Object} ApiEnvelope
 * @property {boolean} success
 * @property {string} message
 * @property {unknown} [data]
 * @property {Record<string, string[]>} [errors]
 */

/**
 * @typedef {Object} DateRangeQuery
 * @property {string} [dateRange] this_month | last_month | this_year | last_year | all | custom
 * @property {string} [from] ISO date when dateRange=custom
 * @property {string} [to]
 * @property {string} [franchiseeId]
 * @property {string} [retailerId]
 * @property {string} [search]
 * @property {number} [page]
 * @property {number} [perPage]
 */

/**
 * @typedef {Object} SessionUserDto
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {'subfranchisee'} role
 * @property {string} organizationId
 * @property {string} [status]
 */

/**
 * @typedef {Object} OrganizationDto
 * @property {string} id
 * @property {string} name
 * @property {string} [code]
 * @property {'platform'|'subfranchisee'|'franchisee'|'retailer'} type
 * @property {string|null} parentId
 * @property {string} [status]
 */

/**
 * @typedef {Object} WalletDto
 * @property {string} id
 * @property {string} organizationId
 * @property {'operating'|'master'|'revenue'} walletType
 * @property {number} availableBalance
 * @property {number} [openingBalance]
 * @property {number} [minimumBalance]
 * @property {string} [status]
 */

/**
 * @typedef {Object} CreditRequestDto
 * @property {string} id
 * @property {string} organizationId
 * @property {string} requesterRole
 * @property {string} parentOrganizationId
 * @property {number} amount
 * @property {number} [depositAmount]
 * @property {number} [depositRate]
 * @property {number} [suggestedCredits]
 * @property {number} [creditsReleased]
 * @property {'pending'|'released'|'rejected'|'reversed'} status
 * @property {string} [notes]
 * @property {object|null} [proofOfPayment]
 * @property {boolean} [directTransfer]
 * @property {string} [paymentReferenceId]
 * @property {'mint'|'balance'} [releaseSource]
 * @property {string} [rejectionReason]
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} CreditTransferDto
 * @property {string} id
 * @property {string} [fromOrganizationId]
 * @property {string} toOrganizationId
 * @property {number} amount
 * @property {string} status
 * @property {string} [fundingRequestId]
 * @property {string} [notes]
 * @property {string} [paymentReferenceId]
 * @property {string} [transferKind]
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} DepositRateDto
 * @property {string} id
 * @property {string} organizationId
 * @property {string} parentOrganizationId
 * @property {'admin_to_sub'|'sub_to_franchisee'|'franchisee_to_retailer'} hop
 * @property {number} depositRate
 * @property {string} [reason]
 * @property {string} [updatedAt]
 * @property {string} [updatedByUserId]
 */

/**
 * @typedef {Object} CommissionSettingDto
 * @property {string} id
 * @property {string} retailerOrganizationId
 * @property {string} [franchiseeOrganizationId]
 * @property {string} [subfranchiseeOrganizationId]
 * @property {number} retailerPercentage
 * @property {number} franchiseePercentage
 * @property {number} subfranchiseePercentage
 * @property {number} companyPercentage
 * @property {string} [effectiveDate]
 * @property {'active'|'inactive'} status
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} SaleTransactionDto
 * @property {string} id
 * @property {string} [reference]
 * @property {string} retailerOrganizationId
 * @property {string} [franchiseeOrganizationId]
 * @property {string} [subfranchiseeOrganizationId]
 * @property {string} [retailerName]
 * @property {string} [retailerCode]
 * @property {number} customerPayment
 * @property {number} [baseCost]
 * @property {number} [platformProcessingFee] live sales stamp 0; not a credit burn
 * @property {number} [walletDeduction]
 * @property {number} [distributableRevenue]
 * @property {number} [retailerPercentage]
 * @property {number} [franchiseePercentage]
 * @property {number} [subfranchiseePercentage]
 * @property {number} [companyPercentage]
 * @property {string} [productService]
 * @property {string} [customerReference]
 * @property {string} status
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} NotificationDto
 * @property {string} id
 * @property {'low_balance'|'credit_request'} kind
 * @property {string} title
 * @property {string} body
 * @property {string} [href]
 * @property {boolean} unread
 * @property {string} createdAt
 */

export {}
