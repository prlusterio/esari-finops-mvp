export class ApiError extends Error {
  /**
   * @param {{
   *   message?: string,
   *   status?: number,
   *   code?: string,
   *   data?: unknown,
   *   errors?: Record<string, string[]>,
   * }} [options]
   */
  constructor({
    message = 'Request failed.',
    status = 0,
    code = 'API_ERROR',
    data = null,
    errors = null,
  } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.data = data
    this.errors = errors
  }
}

export function isApiNotWiredError(error) {
  return error instanceof ApiError && error.code === 'API_NOT_WIRED'
}
