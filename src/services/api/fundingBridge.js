import { apiDelete, apiPost, apiPut } from '@/lib/api/client'
import { resolveApiPrefix } from '@/lib/api/roles'
import { subfranchisorEndpoints } from '@/lib/api/endpoints'

function scoped(pathBuilder, role) {
  const prefix = resolveApiPrefix(role)
  const sub = pathBuilder()
  const relative = sub.replace(/^\/api\/v1\/subfranchisor/, '')
  return `${prefix}${relative}`
}

/**
 * T5 IC lifecycle bridge: API-first mutations with the localStorage action
 * as fallback. REQ- ids are never sent (server ints only); 422
 * insufficient-balance surfaces as an ApiError for the page error state.
 */
export async function apiCreateFundingRequest(role, payload) {
  return apiPost(scoped(subfranchisorEndpoints.creditRequests, role), {
    amount: payload?.amount,
    notes: payload?.notes,
    proofOfPayment: payload?.proofOfPayment ?? null,
    depositRate: payload?.depositRate,
  })
}

export async function apiUpdateFundingRequest(role, request, payload) {
  return apiPut(scoped(() => subfranchisorEndpoints.creditRequest(request?.id), role), {
    amount: payload?.amount,
    notes: payload?.notes,
    proofOfPayment: payload?.proofOfPayment ?? null,
  })
}

export async function apiDeleteFundingRequest(role, request) {
  return apiDelete(scoped(() => subfranchisorEndpoints.creditRequest(request?.id), role))
}

export async function apiReleaseFundingRequest(role, request, { creditsToRelease, paymentReferenceId }) {
  return apiPost(
    scoped(() => subfranchisorEndpoints.releaseCreditRequest(request?.id), role),
    { creditsToRelease, paymentReferenceId },
  )
}

export async function apiRejectFundingRequest(role, request, { reason }) {
  return apiPost(
    scoped(() => subfranchisorEndpoints.rejectCreditRequest(request?.id), role),
    { reason },
  )
}

export async function apiDirectReleaseFunding(role, payload) {
  return apiPost(scoped(subfranchisorEndpoints.directCreditReleases, role), {
    toOrganizationId: payload?.toOrganizationId,
    amount: payload?.amount ?? payload?.creditsToRelease,
    paymentReferenceId: payload?.paymentReferenceId,
    notes: payload?.notes,
    proofOfPayment: payload?.proofOfPayment ?? null,
  })
}
