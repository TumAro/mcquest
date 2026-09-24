export type Response = number[] | number | null

export function isAnswered(response: Response): boolean {
  if (response === null || response === undefined) {
    return false
  }
  if (Array.isArray(response)) {
    return response.length > 0
  }
  return true
}
