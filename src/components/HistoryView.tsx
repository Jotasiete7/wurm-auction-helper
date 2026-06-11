import { ChevronLeft, ChevronRight, ExternalLink, Search, User } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import {
  filterHistoryEntries,
  formatHistoryDate,
  getHistoryPageCount,
  HISTORY_PAGE_SIZE,
  loadHistoryIndex,
  paginateHistoryEntries,
  sortHistoryEntries,
} from '../lib/auction-history/history-utils'
import type { AuctionHistoryIndex, AuctionHistoryIndexEntry } from '../lib/auction-history/types'

const HISTORY_FORUM_STORAGE_KEY = 'wurm-auction-helper-history-forum'

type HistoryForum = 'nfi' | 'sfi'

function loadHistoryForum(): HistoryForum {
  try {
    const raw = localStorage.getItem(HISTORY_FORUM_STORAGE_KEY)
    if (raw === 'sfi' || raw === 'nfi') return raw
  } catch {
    /* ignore */
  }
  return 'nfi'
}

function CommentBlock({
  heading,
  comment,
  locale,
  byAuthorLabel,
}: {
  heading: string
  comment: AuctionHistoryIndexEntry['lastComment']
  locale: string
  byAuthorLabel: (name: string) => string
}) {
  if (!comment) {
    return (
      <div>
        <p className="text-sm text-wurm-text mb-2">{heading}</p>
        <p className="text-sm text-wurm-muted">—</p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm text-wurm-text mb-2">{heading}</p>
      <p className="text-xs text-wurm-muted mb-1">{byAuthorLabel(comment.author)}</p>
      <p className="text-xs text-wurm-muted mb-2">{formatHistoryDate(comment.timestamp, locale)}</p>
      <p className="text-sm text-wurm-muted whitespace-pre-wrap break-words">{comment.message}</p>
    </div>
  )
}

export function HistoryView() {
  const { t, language } = useLanguage()
  const [forum, setForum] = useState<HistoryForum>(loadHistoryForum)
  const [index, setIndex] = useState<AuctionHistoryIndex | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setIndex(null)
    setPage(1)

    void loadHistoryIndex(forum)
      .then((data) => {
        if (!cancelled) setIndex(data)
      })
      .catch(() => {
        if (!cancelled) setError(t('historyLoadFailed'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [forum, t])

  useEffect(() => {
    setPage(1)
  }, [searchQuery, dateFrom, dateTo, forum])

  const filteredEntries = useMemo(() => {
    if (!index) return []
    return sortHistoryEntries(filterHistoryEntries(index.entries, searchQuery, dateFrom, dateTo))
  }, [index, searchQuery, dateFrom, dateTo])

  const totalPages = getHistoryPageCount(filteredEntries.length, HISTORY_PAGE_SIZE)
  const currentPage = Math.min(page, totalPages)
  const pageEntries = paginateHistoryEntries(filteredEntries, currentPage, HISTORY_PAGE_SIZE)

  const statusText = useMemo(() => {
    if (loading) return forum === 'sfi' ? t('historyLoadingSfi') : t('historyLoadingNfi')
    if (error) return error
    if (!index || index.entries.length === 0) return t('historyEmpty')
    const scope = forum === 'sfi' ? t('scopeSfi') : t('scopeNfi')
    if (searchQuery.trim() || dateFrom || dateTo) {
      return t('historyCountFiltered', {
        shown: filteredEntries.length,
        total: index.entries.length,
        scope,
      })
    }
    return t('historyCount', { count: index.entries.length, scope })
  }, [loading, error, index, forum, searchQuery, dateFrom, dateTo, filteredEntries.length, t])

  const fetchedAtDisplay = useMemo(() => {
    if (!index?.fetchedAt) return null
    return formatHistoryDate(index.fetchedAt, language)
  }, [index?.fetchedAt, language])

  const handleForumChange = (next: HistoryForum) => {
    setForum(next)
    try {
      localStorage.setItem(HISTORY_FORUM_STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <section className="bg-wurm-panel border border-wurm-border rounded-xl p-5 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="relative w-full">
              <label className="sr-only" htmlFor="history-search">
                {t('searchLabel')}
              </label>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-wurm-muted"
                aria-hidden
              />
              <input
                id="history-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-full rounded-lg border border-wurm-border bg-wurm-bg py-2 pl-9 pr-3 text-sm text-wurm-text placeholder:text-wurm-muted hover:border-wurm-accent focus:outline-none focus:ring-1 focus:ring-wurm-accent"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="history-date-from" className="text-xs text-wurm-muted">
                  {t('historyDateFrom')}
                </label>
                <input
                  id="history-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="rounded-lg border border-wurm-border bg-wurm-bg px-3 py-2 text-sm text-wurm-text hover:border-wurm-accent focus:outline-none focus:ring-1 focus:ring-wurm-accent"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="history-date-to" className="text-xs text-wurm-muted">
                  {t('historyDateTo')}
                </label>
                <input
                  id="history-date-to"
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="rounded-lg border border-wurm-border bg-wurm-bg px-3 py-2 text-sm text-wurm-text hover:border-wurm-accent focus:outline-none focus:ring-1 focus:ring-wurm-accent"
                />
              </div>
            </div>

            <p className={`text-base ${error ? 'text-red-400' : 'text-wurm-muted'}`}>
              {statusText}
              {fetchedAtDisplay && (
                <>
                  {' '}
                  {t('historyFetchedAt')} {fetchedAtDisplay}
                </>
              )}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="history-forum">
              {t('forumSourceLabel')}
            </label>
            <select
              id="history-forum"
              value={forum}
              onChange={(event) => handleForumChange(event.target.value as HistoryForum)}
              className="rounded-lg border border-wurm-border bg-wurm-bg px-3 py-2 text-sm text-wurm-text hover:border-wurm-accent focus:outline-none focus:ring-1 focus:ring-wurm-accent"
            >
              <option value="nfi">{t('optionNfi')}</option>
              <option value="sfi">{t('optionSfi')}</option>
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {!loading && !error && filteredEntries.length === 0 && (
          <p className="text-center text-sm text-wurm-muted py-8">
            {index && index.entries.length > 0 ? t('searchNoResults') : t('historyEmpty')}
          </p>
        )}

        {pageEntries.map((entry) => (
          <article
            key={entry.id}
            className="bg-wurm-panel border border-wurm-border rounded-xl hover:border-wurm-accentDim transition-colors overflow-hidden"
          >
            <div className="grid md:grid-cols-[8px_1fr_1fr]">
              <div className="min-h-full bg-wurm-border/40" />
              <div className="p-4">
                <h2 className="font-serif text-xl mb-2">
                  <a
                    href={entry.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-wurm-accent transition-colors"
                  >
                    {entry.title}
                  </a>
                </h2>
                <div className="flex flex-wrap gap-4 text-sm text-wurm-muted">
                  <span className="inline-flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {entry.author}
                  </span>
                  <span>{formatHistoryDate(entry.date, language)}</span>
                </div>
              </div>
              <div className="border-t md:border-t-0 md:border-l border-wurm-border p-4 space-y-4">
                <div className="flex items-center justify-end">
                  <a
                    href={entry.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-wurm-muted hover:text-wurm-accent transition-colors"
                    aria-label={t('openAuctionForum')}
                    title={t('openAuctionForum')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                <CommentBlock
                  heading={t('lastUpdateHeading')}
                  comment={entry.lastComment}
                  locale={language}
                  byAuthorLabel={(name) => t('byAuthor', { name })}
                />
                <CommentBlock
                  heading={t('historyPreviousUpdateHeading')}
                  comment={entry.secondLastComment}
                  locale={language}
                  byAuthorLabel={(name) => t('byAuthor', { name })}
                />
              </div>
            </div>
          </article>
        ))}
      </section>

      {!loading && !error && filteredEntries.length > 0 && (
        <nav
          className="mt-6 flex flex-wrap items-center justify-center gap-3"
          aria-label={t('historyPaginationLabel')}
        >
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={currentPage <= 1}
            className="inline-flex items-center gap-1 rounded-lg border border-wurm-border px-3 py-2 text-sm text-wurm-muted hover:border-wurm-accent hover:text-wurm-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
            {t('historyPrevPage')}
          </button>
          <span className="text-sm text-wurm-muted">
            {t('historyPageStatus', { page: currentPage, total: totalPages })}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={currentPage >= totalPages}
            className="inline-flex items-center gap-1 rounded-lg border border-wurm-border px-3 py-2 text-sm text-wurm-muted hover:border-wurm-accent hover:text-wurm-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('historyNextPage')}
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      )}
    </>
  )
}
