import { load } from 'cheerio'
import { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

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

const forumUrlNfi = 'https://forum.wurmonline.com/index.php?/forum/399-auctions-nfi/'
const forumUrlSfi = 'https://forum.wurmonline.com/index.php?/forum/63-auctions-sfi/'
const baseForumOrigin = 'https://forum.wurmonline.com'
const detailConcurrency = 4
const requestHeaders = {
  'user-agent': 'Mozilla/5.0 (compatible; WurmAuctionHelper/1.0)',
}

function parseTopics(html: string, listPageUrl: string): AuctionTopic[] {
  const $ = load(html)
  const topics: AuctionTopic[] = []

  $('li.ipsDataItem').each((index, el) => {
    const titleLink = $(el).find('h4.ipsDataItem_title a').first()
    const title = titleLink.text().trim()
    if (!title) return

    const author = $(el).find('.ipsDataItem_meta a, .ipsType_light a').first().text().trim() || 'Desconhecido'
    const timeNode = $(el).find('time, .ipsDataItem_stats time, .ipsDataItem_lastPoster time').first()
    const lastCommentTime =
      timeNode.attr('title')?.trim() ||
      timeNode.attr('datetime')?.trim() ||
      timeNode.text().trim() ||
      'Sem informacao'
    const hrefValue = titleLink.attr('href') || listPageUrl
    const href = hrefValue.startsWith('http') ? hrefValue : new URL(hrefValue, baseForumOrigin).toString()

    topics.push({
      id: `${title}-${index}`,
      title,
      author,
      lastCommentTime,
      href,
    })
  })

  return topics.slice(2)
}

function parseTopicDetails(
  html: string,
): Pick<AuctionTopic, 'startingBid' | 'timerAlt' | 'lastCommentMessage' | 'lastCommentAuthor'> {
  const $ = load(html)
  const bodyText = $('body').text()
  const startingBidMatch = bodyText.match(/Starting bid:\s*([^\n\r]+)/i)
  const timerImage = $('img.ipsImage[alt*="timer_"], img.ipsImage[src*="timer_"]').first()
  const commentNodes = $("div[data-role='commentContent']")
  const hasReplies = commentNodes.length > 1

  let lastCommentMessage: string | undefined
  let lastCommentAuthor: string | undefined

  if (hasReplies) {
    const lastCommentNode = commentNodes.last()
    const lastCommentRaw = lastCommentNode.text()
    const normalizedMessage = lastCommentRaw.replace(/\s+/g, ' ').trim()
    lastCommentMessage = normalizedMessage || undefined

    const authorCandidate = lastCommentNode
      .closest('article')
      .find('aside h3 strong')
      .first()
      .text()
      .trim()

    lastCommentAuthor = authorCandidate || undefined
  }

  return {
    startingBid: startingBidMatch?.[1]?.trim(),
    timerAlt: timerImage.attr('alt')?.trim(),
    lastCommentMessage,
    lastCommentAuthor,
  }
}

function parseFullTopicFromPage(html: string, href: string, index: number): AuctionTopic {
  const $ = load(html)
  const title =
    $('h1.ipsType_pageTitle').first().text().trim() ||
    $('.ipsType_pageTitle').first().text().trim() ||
    $('h1').first().text().trim() ||
    'Auction'

  const firstContent = $("div[data-role='commentContent']").first()
  const author =
    firstContent.closest('article').find('aside h3 strong').first().text().trim() || 'Desconhecido'

  const lastContent = $("div[data-role='commentContent']").last()
  const lastArticle = lastContent.closest('article')
  const timeNode = lastArticle.find('time').first()
  const lastCommentTime =
    timeNode.attr('title')?.trim() ||
    timeNode.attr('datetime')?.trim() ||
    timeNode.text().trim() ||
    'Sem informacao'

  return {
    id: `fav-${index}-${href}`,
    title,
    author,
    lastCommentTime,
    href,
    ...parseTopicDetails(html),
  }
}

function minimalTopicFromHref(href: string, index: number): AuctionTopic {
  return {
    id: `fav-${index}-${href}`,
    title: 'Nao foi possivel carregar',
    author: '—',
    lastCommentTime: '—',
    href,
  }
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => {
      data += chunk
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

async function mapWithConcurrency<T, R>(
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

function scraperApiPlugin(): Plugin {
  const handler = async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (req.method === 'POST') {
        const rawBody = await readRequestBody(req)
        const body = JSON.parse(rawBody || '{}') as { forum?: string; hrefs?: unknown }
        if (body.forum !== 'favorites' || !Array.isArray(body.hrefs)) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'Body invalido: esperado { forum: "favorites", hrefs: string[] }' }))
          return
        }

        const hrefs = body.hrefs
          .filter(
            (h): h is string =>
              typeof h === 'string' && h.startsWith('http') && h.includes('forum.wurmonline.com'),
          )
          .slice(0, 80)

        if (hrefs.length === 0) {
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ topics: [] }))
          return
        }

        const topics = await mapWithConcurrency(hrefs, detailConcurrency, async (href, index) => {
          try {
            const detailResponse = await fetch(href, { headers: requestHeaders })
            if (!detailResponse.ok) return minimalTopicFromHref(href, index)

            const detailHtml = await detailResponse.text()
            return parseFullTopicFromPage(detailHtml, href, index)
          } catch {
            return minimalTopicFromHref(href, index)
          }
        })

        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ topics }))
        return
      }

      if (req.method !== 'GET') {
        res.statusCode = 405
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ error: 'Metodo nao permitido' }))
        return
      }

      const requestUrl = new URL(req.url || '/api/auctions', 'http://local')
      const forumParam = requestUrl.searchParams.get('forum') || 'nfi'
      const listUrl = forumParam === 'sfi' ? forumUrlSfi : forumUrlNfi

      const listResponse = await fetch(listUrl, { headers: requestHeaders })
      if (!listResponse.ok) {
        throw new Error(`Forum status ${listResponse.status}`)
      }

      const listHtml = await listResponse.text()
      const topics = parseTopics(listHtml, listUrl)

      const enrichedTopics = await mapWithConcurrency(topics, detailConcurrency, async (topic) => {
        try {
          const detailResponse = await fetch(topic.href, { headers: requestHeaders })
          if (!detailResponse.ok) return topic

          const detailHtml = await detailResponse.text()
          return { ...topic, ...parseTopicDetails(detailHtml) }
        } catch {
          return topic
        }
      })

      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ topics: enrichedTopics }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: `Falha no scraper: ${message}` }))
    }
  }

  return {
    name: 'wurm-auction-scraper-api',
    configureServer(server) {
      server.middlewares.use('/api/auctions', handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/auctions', handler)
    },
  }
}

export default defineConfig({
  plugins: [react(), scraperApiPlugin()],
  resolve: {
    alias: {
      '@ecossistema-guilda': path.resolve(__dirname, './src/ecossistema-guilda'),
      'lucide-react': path.resolve(__dirname, 'node_modules/lucide-react'),
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom')
    }
  },
  server: {
    fs: {
      allow: ['..']
    }
  }
})
