import {
  clearSession,
  getSession,
  getUsers,
  saveSession,
} from '@/services/storage'

/**
 * Authenticate against mock users in localStorage.
 * @param {string} email
 * @param {string} password
 * @returns {{ success: boolean, user?: object, error?: string }}
 */
export function login(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const users = getUsers()
  const user = users.find(
    (entry) => String(entry.email).toLowerCase() === normalizedEmail,
  )

  if (!user || user.password !== password) {
    return { success: false, error: 'Invalid email or password.' }
  }

  const session = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
  }

  saveSession(session)
  return { success: true, user: session }
}

export function logout() {
  clearSession()
}

/**
 * Returns the current session if valid and the user still exists.
 * Clears invalid sessions automatically.
 */
export function getCurrentUser() {
  const session = getSession()
  if (!session || !session.userId) {
    return null
  }

  const users = getUsers()
  const user = users.find((entry) => entry.id === session.userId)

  if (!user) {
    clearSession()
    return null
  }

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
  }
}

export function isAuthenticated() {
  return getCurrentUser() !== null
}
