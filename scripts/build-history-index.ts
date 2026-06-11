import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AuctionHistoryEntry, AuctionHistoryIndex, AuctionHistoryStore } from '../src/lib/auction-history/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MAX_MESSAGE_LENGTH = 500

const sources: { forum: 'nfi' | 'sfi'; input: string; output: string }[] = [
  {
    forum: 'nfi',
    input: path.resolve(__dirname, '../data/auction-history.json'),
    output: path.resolve(__dirname, '../public/data/auction-history-nfi-index.json'),
  },
  {
    forum: 'sfi',
    input: path.resolve(__dirname, '../data/auction-history-sfi.json'),
    output: path.resolve(__dirname, '../public/data/auction-history-sfi-index.json'),
  },
]

function truncateMessage(message: string): string {
  if (message.length <= MAX_MESSAGE_LENGTH) return message
  return `${message.slice(0, MAX_MESSAGE_LENGTH)}…`
}

function toIndexEntry(entry: AuctionHistoryEntry): AuctionHistoryIndex['entries'][number] {
  const comments = entry.comments
  const last = comments.at(-1)
  const secondLast = comments.length > 1 ? comments.at(-2) : undefined

  return {
    id: entry.id,
    title: entry.title,
    author: entry.author,
    date: entry.date,
    href: entry.href,
    lastComment: last
      ? {
          author: last.author,
          timestamp: last.timestamp,
          message: truncateMessage(last.message),
        }
      : undefined,
    secondLastComment: secondLast
      ? {
          author: secondLast.author,
          timestamp: secondLast.timestamp,
          message: truncateMessage(secondLast.message),
        }
      : undefined,
  }
}

async function buildIndex(source: (typeof sources)[number]): Promise<void> {
  const raw = await readFile(source.input, 'utf8')
  const store = JSON.parse(raw) as AuctionHistoryStore
  const index: AuctionHistoryIndex = {
    forum: source.forum,
    fetchedAt: store.fetchedAt,
    entries: store.auctions.map(toIndexEntry),
  }

  await mkdir(path.dirname(source.output), { recursive: true })
  await writeFile(source.output, JSON.stringify(index))
  console.log(`${source.forum.toUpperCase()}: ${index.entries.length} entradas → ${source.output}`)
}

async function main(): Promise<void> {
  for (const source of sources) {
    await buildIndex(source)
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Erro desconhecido'
  console.error(`Erro: ${message}`)
  process.exit(1)
})
