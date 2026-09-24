export type Response = number[] | number | null

export type BubbleState = 'unvisited' | 'visited' | 'answered' | 'marked' | 'answered-marked'

export function isAnswered(response: Response): boolean {
  if (response === null || response === undefined) {
    return false
  }
  if (Array.isArray(response)) {
    return response.length > 0
  }
  return true
}

export function bubbleState(response: Response, marked: boolean, visited: boolean): BubbleState {
  if (marked) {
    return isAnswered(response) ? 'answered-marked' : 'marked'
  }
  if (isAnswered(response)) {
    return 'answered'
  }
  if (visited) {
    return 'visited'
  }
  return 'unvisited'
}
