import {
  buildForumPageUrl,
  fetchHtml,
  mapWithConcurrency,
  parseCommentPageUrls,
  parseListTopics,
  parseTopicHistory,
  parseTotalPages,
  sleep,
} from './scraper'
import type { AuctionHistoryEntry, AuctionHistoryStore } from './types'

export interface FetchHistoryOptions {
  forum: 'nfi' | 'sfi'
  fromPage: number
  toPage: number
  concurrency: number
  delayMs: number
  onProgress?: (message: string) => void
}

async function fetchTopicHistory(
  stub: ReturnType<typeof parseListTopics>[number],
  delayMs: number,
): Promise<AuctionHistoryEntry> {
  const firstPageHtml = await fetchHtml(stub.href)
  await sleep(delayMs)

  const extraPageUrls = parseCommentPageUrls(firstPageHtml, stub.href)
  const allHtml = [firstPageHtml]

  for (const pageUrl of extraPageUrls) {
    allHtml.push(await fetchHtml(pageUrl))
    await sleep(delayMs)
  }

  const mergedHtml = allHtml.join('\n')
  return parseTopicHistory(mergedHtml, stub)
}

export async function fetchAuctionHistory(options: FetchHistoryOptions): Promise<AuctionHistoryStore> {
  const { forum, fromPage, toPage, concurrency, delayMs, onProgress } = options
  const log = onProgress ?? (() => {})

  let totalPages: number | null = null
  const stubs: ReturnType<typeof parseListTopics> = []

  for (let page = fromPage; page <= toPage; page++) {
    const listUrl = buildForumPageUrl(forum, page)
    log(`Buscando listagem pagina ${page}/${toPage}...`)
    const listHtml = await fetchHtml(listUrl)
    await sleep(delayMs)

    if (totalPages === null) {
      totalPages = parseTotalPages(listHtml)
      if (totalPages) log(`Total de paginas no forum: ${totalPages}`)
    }

    const pageTopics = parseListTopics(listHtml, listUrl, page)
    log(`  ${pageTopics.length} auctions encontradas na pagina ${page}`)
    stubs.push(...pageTopics)
  }

  const uniqueStubs = [...new Map(stubs.map((s) => [s.href, s])).values()]
  log(`Buscando detalhes de ${uniqueStubs.length} auctions (concorrencia ${concurrency})...`)

  let completed = 0
  const auctions = await mapWithConcurrency(uniqueStubs, concurrency, async (stub) => {
    try {
      const entry = await fetchTopicHistory(stub, delayMs)
      completed++
      log(`  [${completed}/${uniqueStubs.length}] ${entry.title}`)
      return entry
    } catch (error) {
      completed++
      const message = error instanceof Error ? error.message : 'erro desconhecido'
      log(`  [${completed}/${uniqueStubs.length}] FALHA: ${stub.title} (${message})`)
      return {
        id: stub.href.match(/\/topic\/(\d+)/)?.[1] || stub.href,
        title: stub.title,
        author: stub.author,
        date: stub.listDate,
        href: stub.href,
        comments: [],
      }
    }
  })

  return {
    forum,
    fetchedAt: new Date().toISOString(),
    pageRange: { from: fromPage, to: toPage },
    totalPages,
    auctions,
  }
}
