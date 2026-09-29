import React from 'react'
import type { Response } from './attempt-state'

export type { Response }

export type QType = 'single' | 'multi' | 'numeric'

export interface Question {
  id: string
  exam: string
  marks: number
  topic: string
  question: string
  options?: string[]
  correct?: number[]
  answer?: { min: number; max: number }
  image?: string
  note?: string
  type?: QType
}

export interface Paper {
  exam: string
  year: number
  questions: Question[]
}

export interface IndexQuestion {
  id: string
  topic: string
  type?: QType
}

export interface IndexYear {
  year: number
  count: number
  questions: IndexQuestion[]
}

export interface IndexExam {
  label: string
  slug: string
  years: IndexYear[]
}

export interface DataIndex {
  topics: Record<string, { label: string; topics: Record<string, string> }>
  exams: IndexExam[]
}

/**
 * Root of the built data tree, e.g. `/data/`. `npm run build:data` writes
 * `index.json`, `<exam>/<year>.json` and `<exam>/assets/<year>/...` under it.
 *
 * Built by string concatenation rather than `new URL(rel, BASE_URL)`: BASE_URL
 * is a path like `/`, not an absolute URL, so it is not a usable base.
 */
const DATA_BASE = `${import.meta.env.BASE_URL}data/`.replace(/\/{2,}/g, '/')

export async function loadIndex(): Promise<DataIndex> {
  const url = `${DATA_BASE}index.json`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to load index from ${url}: ${res.status}`)
  }
  return res.json()
}

export async function loadPaper(slug: string, year: number): Promise<Paper> {
  const url = `${DATA_BASE}${slug}/${year}.json`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to load paper ${slug}/${year} from ${url}: ${res.status}`)
  }
  return res.json()
}

/** Matches build-data.mjs, which emits assets to `<exam>/assets/<year>/`. */
export function assetBase(slug: string, year: number): string {
  return `${DATA_BASE}${slug}/assets/${year}/`
}

export function useJson<T>(
  load: () => Promise<T>,
  deps: unknown[]
): { data: T | null; error: Error | null } {
  const [result, setResult] = React.useState<{ data: T | null; error: Error | null }>({
    data: null,
    error: null,
  })

  React.useEffect(() => {
    load()
      .then((data) => setResult({ data, error: null }))
      .catch((error) => setResult({ data: null, error: error as Error }))
  }, deps)

  return result
}
