import { apiGet, apiPost } from '@/lib/api/client'
import { subfranchisorEndpoints as routes } from '@/lib/api/endpoints'

/**
 * @typedef {import('./types.js').NotificationDto} NotificationDto
 */

/** @returns {Promise<NotificationDto[]>} */
export function listNotifications() {
  return apiGet(routes.notifications())
}

/** @param {{ ids: string[] }} payload */
export function markNotificationsRead(payload) {
  return apiPost(routes.markNotificationsRead(), payload)
}
