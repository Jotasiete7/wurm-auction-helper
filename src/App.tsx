import { ExternalLink, RefreshCcw, ScrollText, Star, User } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LanguageSelector } from './components/LanguageSelector'
import { LanguageProvider, useLanguage } from './i18n/LanguageContext'
import type { TranslationKey } from './i18n/translations'

interface AuctionTopic {
  id: string
  title: string
  author: string
  lastCommentTime: string
  href: string
  startingBid?: string
  timerAlt?: string
  lastCommentMessage?: string
  lastCommentAuthor?: string
}

const FAVORITES_STORAGE_KEY = 'wurm-auction-helper-favorites'
const FORUM_SOURCE_STORAGE_KEY = 'wurm-auction-helper-forum-source'

type AuctionSource = 'nfi' | 'sfi' | 'favorites'

type TFn = (key: TranslationKey, params?: Record<string, string | number>) => string

function loadForumSource(): AuctionSource {
  try {
    const raw = localStorage.getItem(FORUM_SOURCE_STORAGE_KEY)
    if (raw === 'sfi' || raw === 'favorites' || raw === 'nfi') return raw
  } catch {
    /* ignore */
  }
  return 'nfi'
}

function loadFavoriteHrefs(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((item): item is string => typeof item === 'string'))
  } catch {
    return new Set()
  }
}

function saveFavoriteHrefs(hrefs: Set<string>) {
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...hrefs]))
}

function getTimerInfo(timerAlt: string | undefined, t: TFn) {
  if (!timerAlt) {
    return {
      statusText: `${t('timerNotFound')} — ${t('timerNoTimestamp')}`,
      isActive: false,
      activeTimeHighlight: false,
    }
  }

  const timestampMatch = timerAlt.match(/timer_(\d+)\.svg/i)
  if (!timestampMatch) {
    return {
      statusText: t('timerInvalidFormat'),
      isActive: false,
      activeTimeHighlight: false,
    }
  }

  const timerTimestamp = Number(timestampMatch[1])
  const nowTimestamp = Math.floor(Date.now() / 1000)
  const diffSeconds = timerTimestamp - nowTimestamp
  const absSeconds = Math.abs(diffSeconds)

  const days = Math.floor(absSeconds / 86400)
  const hours = Math.floor((absSeconds % 86400) / 3600)
  const minutes = Math.floor((absSeconds % 3600) / 60)

  const timeParts: string[] = []
  if (days > 0) timeParts.push(`${days}d`)
  if (hours > 0) timeParts.push(`${hours}h`)
  timeParts.push(`${minutes}m`)
  const humanDiff = timeParts.join(' ')

  const isActive = diffSeconds >= 0
  const activeTimeHighlight = isActive && diffSeconds < 86400

  return {
    statusText: isActive
      ? t('timerActive', { time: humanDiff })
      : t('timerEnded', { time: humanDiff }),
    isActive,
    activeTimeHighlight,
    activeHumanDiff: isActive ? humanDiff : undefined,
  }
}

function AuctionApp() {
  const { t, language } = useLanguage()
  const tRef = useRef(t)
  tRef.current = t

  const [topics, setTopics] = useState<AuctionTopic[]>([])
  const [favoriteHrefs, setFavoriteHrefs] = useState<Set<string>>(loadFavoriteHrefs)
  const [source, setSourceState] = useState<AuctionSource>(loadForumSource)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)

  const setSource = useCallback((next: AuctionSource) => {
    setSourceState(next)
    try {
      localStorage.setItem(FORUM_SOURCE_STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  const sourceRef = useRef(source)
  const favoriteHrefsRef = useRef(favoriteHrefs)
  sourceRef.current = source
  favoriteHrefsRef.current = favoriteHrefs

  const toggleFavorite = useCallback((href: string) => {
    setFavoriteHrefs((prev) => {
      const next = new Set(prev)
      if (next.has(href)) next.delete(href)
      else next.add(href)
      saveFavoriteHrefs(next)
      return next
    })
  }, [])

  const sortedTopics = useMemo(() => {
    const favorites: AuctionTopic[] = []
    const others: AuctionTopic[] = []
    for (const topic of topics) {
      if (favoriteHrefs.has(topic.href)) favorites.push(topic)
      else others.push(topic)
    }
    return [...favorites, ...others]
  }, [topics, favoriteHrefs])

  const loadAuctions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const currentSource = sourceRef.current
      const currentFavorites = favoriteHrefsRef.current

      let response: Response
      if (currentSource === 'favorites') {
        const hrefs = [...currentFavorites]
        response = await fetch('/api/auctions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forum: 'favorites', hrefs }),
        })
      } else {
        response = await fetch(`/api/auctions?forum=${currentSource}`)
      }

      if (!response.ok) {
        throw new Error(tRef.current('fetchFailed', { status: response.status }))
      }

      const data = (await response.json()) as { topics?: AuctionTopic[]; error?: string }
      if (data.error) {
        throw new Error(data.error)
      }

      setTopics(data.topics || [])
      setLastUpdatedAt(Date.now())
    } catch (err) {
      const message = err instanceof Error ? err.message : tRef.current('loadFailedGeneric')
      setError(`${message}${tRef.current('tryAgainSuffix')}`)
      setTopics([])
    } finally {
      setLoading(false)
    }
  }, [])

  const favoritesKey = useMemo(() => [...favoriteHrefs].sort().join('|'), [favoriteHrefs])
  const dataSourceKey = source === 'favorites' ? favoritesKey : source

  useEffect(() => {
    void loadAuctions()
  }, [dataSourceKey, loadAuctions])

  const lastUpdatedDisplay = useMemo(() => {
    if (lastUpdatedAt == null) return null
    return new Date(lastUpdatedAt).toLocaleString(language === 'pt' ? 'pt-BR' : 'en-US')
  }, [lastUpdatedAt, language])

  const subtitle = useMemo(() => {
    if (source === 'favorites') return t('subtitleFavorites')
    if (source === 'sfi') return t('subtitleSfi')
    return t('subtitleNfi')
  }, [source, language, t])

  const statusText = useMemo(() => {
    if (loading) {
      if (source === 'sfi') return t('statusLoadingSfi')
      if (source === 'favorites') return t('statusLoadingFavorites')
      return t('statusLoadingNfi')
    }
    if (error) return error
    if (topics.length === 0) {
      return source === 'favorites' ? t('statusEmptyFavorites') : t('statusEmptyPage')
    }
    const scopeTranslation: TranslationKey =
      source === 'sfi' ? 'scopeSfi' : source === 'nfi' ? 'scopeNfi' : 'scopeFavorites'
    return t('statusCount', { count: topics.length, scope: t(scopeTranslation) })
  }, [error, language, loading, source, t, topics.length])

  return (
    <div className="min-h-screen bg-wurm-bg font-sans text-wurm-text">
      <LanguageSelector />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <ScrollText className="w-10 h-10 text-wurm-accent" />
            <h1 className="font-serif text-4xl font-bold">{t('title')}</h1>
          </div>
          <p className="text-wurm-muted text-lg">{subtitle}</p>
        </header>

        <section className="bg-wurm-panel border border-wurm-border rounded-xl p-5 mb-6">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="space-y-1">
              <p className={`text-sm ${error ? 'text-red-400' : 'text-wurm-muted'}`}>{statusText}</p>
              {lastUpdatedDisplay && (
                <p className="text-xs text-wurm-muted">
                  {t('lastUpdatedLabel')} {lastUpdatedDisplay}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="forum-source">
                {t('forumSourceLabel')}
              </label>
              <select
                id="forum-source"
                value={source}
                onChange={(event) => setSource(event.target.value as AuctionSource)}
                className="rounded-lg border border-wurm-border bg-wurm-bg px-3 py-2 text-sm text-wurm-text hover:border-wurm-accent focus:outline-none focus:ring-1 focus:ring-wurm-accent"
              >
                <option value="nfi">{t('optionNfi')}</option>
                <option value="sfi">{t('optionSfi')}</option>
                <option value="favorites">{t('optionFavorites')}</option>
              </select>
              <button
                type="button"
                onClick={() => void loadAuctions()}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-wurm-border hover:border-wurm-accent text-wurm-muted hover:text-wurm-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCcw className="w-4 h-4" />
                {t('refresh')}
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          {sortedTopics.map((topic) => {
            const isFavorite = favoriteHrefs.has(topic.href)
            const timer = getTimerInfo(topic.timerAlt, t)
            return (
              <article
                key={topic.id}
                className="bg-wurm-panel border border-wurm-border rounded-xl hover:border-wurm-accentDim transition-colors overflow-hidden"
              >
                <div className="grid md:grid-cols-[8px_1fr_1fr]">
                  <div
                    className={`min-h-full ${
                      timer.isActive ? 'bg-green-500/70' : 'bg-transparent'
                    }`}
                  />
                  <div className="p-4">
                    <div className="flex items-start gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => toggleFavorite(topic.href)}
                        className="mt-1 shrink-0 text-wurm-muted hover:text-wurm-accent transition-colors"
                        aria-label={isFavorite ? t('removeFavorite') : t('addFavorite')}
                        aria-pressed={isFavorite}
                        title={isFavorite ? t('removeFavorite') : t('addFavorite')}
                      >
                        <Star
                          className={`w-5 h-5 ${isFavorite ? 'fill-wurm-accent text-wurm-accent' : ''}`}
                          strokeWidth={isFavorite ? 0 : 2}
                        />
                      </button>
                      <h2 className="font-serif text-xl flex-1 min-w-0">
                        <a
                          href={topic.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-wurm-accent transition-colors"
                        >
                          {topic.title}
                        </a>
                      </h2>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-wurm-muted">
                      <span className="inline-flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {topic.author}
                      </span>
                      <span>{topic.lastCommentTime}</span>
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-wurm-muted">
                      <p>
                        <span className="text-wurm-text">{t('startingBidLabel')}</span>{' '}
                        {topic.startingBid || t('notCollectedYet')}
                      </p>
                      <p>
                        <span className="text-wurm-text">{t('statusLabel')}</span>{' '}
                        {timer.activeTimeHighlight && timer.activeHumanDiff != null ? (
                          <>
                            {t('timerActiveLead')}
                            <span className="text-green-500 font-medium">{timer.activeHumanDiff}</span>
                            {t('timerActiveTrail')}
                          </>
                        ) : (
                          timer.statusText
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="border-t md:border-t-0 md:border-l border-wurm-border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-wurm-text">{t('lastUpdateHeading')}</p>
                      <a
                        href={topic.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-wurm-muted hover:text-wurm-accent transition-colors"
                        aria-label={t('openAuctionForum')}
                        title={t('openAuctionForum')}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                    {topic.lastCommentAuthor && (
                      <p className="text-xs text-wurm-muted mb-2">
                        {t('byAuthor', { name: topic.lastCommentAuthor })}
                      </p>
                    )}
                    <p className="text-sm text-wurm-muted whitespace-pre-wrap break-words">
                      {topic.lastCommentMessage || ''}
                    </p>
                  </div>
                </div>
              </article>
            )
          })}
        </section>

        <footer className="text-center mt-12 text-wurm-muted text-sm space-y-1">
          <p>
            {t('footer').split('{link}')[0]}
            <a
              href="https://forum.wurmonline.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-wurm-accent hover:underline"
            >
              {t('forumLink')}
            </a>
            {t('footer').split('{link}')[1]}
          </p>
          <p>
            {t('developedBy')}{' '}
            <a
              href="https://wurm-aguild-site.pages.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-wurm-accent hover:underline"
            >
              A Guilda
            </a>
          </p>
        </footer>
      </div>
    </div>
  )
}

function App() {
  return (
    <LanguageProvider>
      <AuctionApp />
    </LanguageProvider>
  )
}

export default App
