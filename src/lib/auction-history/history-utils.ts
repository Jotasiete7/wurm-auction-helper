import type { AuctionHistoryIndex, AuctionHistoryIndexEntry } from './types'

export const HISTORY_PAGE_SIZE = 25

export function parseHistoryDate(value: string): Date | null {
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed)
}

export function formatHistoryDate(value: string, locale: string): string {
  const date = parseHistoryDate(value)
  if (!date) return value
  return date.toLocaleString(locale === 'pt' ? 'pt-BR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function filterHistoryEntries(
  entries: AuctionHistoryIndexEntry[],
  searchQuery: string,
  dateFrom: string,
  dateTo: string,
): AuctionHistoryIndexEntry[] {
  const normalizedSearch = searchQuery.trim().toLowerCase()
  const from = dateFrom ? parseHistoryDate(`${dateFrom}T00:00:00`) : null
  const to = dateTo ? parseHistoryDate(`${dateTo}T23:59:59.999`) : null

  return entries.filter((entry) => {
    if (normalizedSearch) {
      const matchesSearch =
        entry.title.toLowerCase().includes(normalizedSearch) ||
        entry.author.toLowerCase().includes(normalizedSearch)
      if (!matchesSearch) return false
    }

    const entryDate = parseHistoryDate(entry.date)
    if (!entryDate) return true
    if (from && entryDate < from) return false
    if (to && entryDate > to) return false
    return true
  })
}

export function sortHistoryEntries(entries: AuctionHistoryIndexEntry[]): AuctionHistoryIndexEntry[] {
  return [...entries].sort((a, b) => {
    const dateA = parseHistoryDate(a.date)?.getTime() ?? 0
    const dateB = parseHistoryDate(b.date)?.getTime() ?? 0
    return dateB - dateA
  })
}

export function paginateHistoryEntries<T>(entries: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize
  return entries.slice(start, start + pageSize)
}

export function getHistoryPageCount(totalEntries: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalEntries / pageSize))
}

export async function loadHistoryIndex(forum: 'nfi' | 'sfi'): Promise<AuctionHistoryIndex> {
  const response = await fetch(`/data/auction-history-${forum}-index.json`)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return (await response.json()) as AuctionHistoryIndex
}
