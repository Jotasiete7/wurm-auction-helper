import { load, type CheerioAPI } from 'cheerio'
import type { AuctionComment, AuctionHistoryEntry, ListTopicStub } from './types'

const baseForumOrigin = 'https://forum.wurmonline.com'

export const forumUrls = {
  nfi: 'https://forum.wurmonline.com/index.php?/forum/399-auctions-nfi/',
  sfi: 'https://forum.wurmonline.com/index.php?/forum/63-auctions-sfi/',
} as const

export const requestHeaders = {
  'user-agent': 'Mozilla/5.0 (compatible; WurmAuctionHelper/1.0)',
}

export function buildForumPageUrl(forum: keyof typeof forumUrls, page: number): string {
  if (page <= 1) return forumUrls[forum]
  return `${forumUrls[forum]}page/${page}/`
}

export function parseTotalPages(html: string): number | null {
  const $ = load(html)
  const pageText = $('.ipsPagination').text()
  const match = pageText.match(/Page\s+\d+\s+of\s+(\d+)/i)
  return match ? Number.parseInt(match[1], 10) : null
}

export function parseListTopics(html: string, listPageUrl: string, page: number): ListTopicStub[] {
  const $ = load(html)
  const topics: ListTopicStub[] = []

  $('li.ipsDataItem').each((index, el) => {
    const titleLink = $(el).find('h4.ipsDataItem_title a').first()
    const title = titleLink.text().trim()
    if (!title) return

    const author = $(el).find('.ipsDataItem_meta a, .ipsType_light a').first().text().trim() || 'Desconhecido'
    const timeNode = $(el).find('time, .ipsDataItem_stats time, .ipsDataItem_lastPoster time').first()
    const listDate =
      timeNode.attr('datetime')?.trim() ||
      timeNode.attr('title')?.trim() ||
      timeNode.text().trim() ||
      'Sem informacao'
    const hrefValue = titleLink.attr('href') || listPageUrl
    const href = hrefValue.startsWith('http') ? hrefValue : new URL(hrefValue, baseForumOrigin).toString()
    if (!href.includes('/topic/')) return

    topics.push({ title, author, href, listDate })
  })

  const skipPinned = page === 1 ? 2 : 0
  return topics.slice(skipPinned)
}

function extractTimestamp($: CheerioAPI, article: ReturnType<CheerioAPI>): string {
  const timeNode = article.find('time').first()
  return (
    timeNode.attr('datetime')?.trim() ||
    timeNode.attr('title')?.trim() ||
    timeNode.text().trim() ||
    'Sem informacao'
  )
}

export function parseTopicComments(html: string): AuctionComment[] {
  const $ = load(html)
  const comments: AuctionComment[] = []

  $("div[data-role='commentContent']").each((_, el) => {
    const contentNode = $(el)
    const article = contentNode.closest('article')
    const author = article.find('aside h3 strong').first().text().trim() || 'Desconhecido'
    const timestamp = extractTimestamp($, article)
    const message = contentNode.text().replace(/\s+/g, ' ').trim()

    if (!message) return

    comments.push({ author, timestamp, message })
  })

  return comments
}

export function parseTopicHistory(html: string, stub: ListTopicStub): AuctionHistoryEntry {
  const $ = load(html)
  const title =
    $('h1.ipsType_pageTitle').first().text().trim() ||
    $('.ipsType_pageTitle').first().text().trim() ||
    stub.title

  const comments = parseTopicComments(html)
  const firstComment = comments[0]
  const author = firstComment?.author || stub.author
  const date = firstComment?.timestamp || stub.listDate
  const idMatch = stub.href.match(/\/topic\/(\d+)/)
  const id = idMatch?.[1] || stub.href

  return {
    id,
    title,
    author,
    date,
    href: stub.href,
    comments,
  }
}

export function parseCommentPageUrls(html: string, topicHref: string): string[] {
  const $ = load(html)
  const topicPath = new URL(topicHref).pathname
  const urls = new Set<string>()

  $('a[href*="page"]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return

    const absolute = href.startsWith('http') ? href : new URL(href, baseForumOrigin).toString()
    const path = new URL(absolute).pathname
    if (path.startsWith(topicPath) && path !== topicPath) {
      urls.add(absolute)
    }
  })

  return [...urls]
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let currentIndex = 0

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (currentIndex < items.length) {
      const index = currentIndex++
      results[index] = await mapper(items[index], index)
    }
  })

  await Promise.all(workers)
  return results
}

export async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, { headers: requestHeaders })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ao buscar ${url}`)
  }
  return response.text()
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
