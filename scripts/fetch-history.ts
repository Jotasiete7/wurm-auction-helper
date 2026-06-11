import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchAuctionHistory } from '../src/lib/auction-history/fetcher'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const defaultOutput = path.resolve(__dirname, '../data/auction-history.json')

interface CliOptions {
  forum: 'nfi' | 'sfi'
  fromPage: number
  toPage: number
  output: string
  concurrency: number
  delayMs: number
}

function printUsage(): void {
  console.log(`Uso: npm run fetch-history -- [opcoes]

Opcoes:
  --forum <nfi|sfi>     Forum a buscar (padrao: nfi)
  --from <numero>       Pagina inicial (padrao: 1)
  --to <numero>         Pagina final (padrao: 2)
  --pages <inicio-fim>  Atalho para --from e --to (ex: 1-2)
  --output <caminho>    Arquivo JSON de saida (padrao: data/auction-history.json)
  --concurrency <num>   Requisicoes paralelas por auction (padrao: 3)
  --delay <ms>          Pausa entre requisicoes (padrao: 400)
  --help                Mostra esta ajuda

Exemplo:
  npm run fetch-history -- --pages 1-2
  npm run fetch-history -- --forum nfi --from 1 --to 2`)
}

function parseArgs(argv: string[]): CliOptions | null {
  const options: CliOptions = {
    forum: 'nfi',
    fromPage: 1,
    toPage: 2,
    output: defaultOutput,
    concurrency: 3,
    delayMs: 400,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === '--help' || arg === '-h') {
      printUsage()
      return null
    }

    if (arg === '--forum') {
      const value = argv[++i]
      if (value !== 'nfi' && value !== 'sfi') throw new Error('--forum deve ser nfi ou sfi')
      options.forum = value
      continue
    }

    if (arg === '--from') {
      options.fromPage = Number.parseInt(argv[++i], 10)
      continue
    }

    if (arg === '--to') {
      options.toPage = Number.parseInt(argv[++i], 10)
      continue
    }

    if (arg === '--pages') {
      const range = argv[++i]
      const [from, to] = range.split('-').map((n) => Number.parseInt(n, 10))
      if (!Number.isFinite(from) || !Number.isFinite(to)) {
        throw new Error('--pages deve ser no formato inicio-fim (ex: 1-2)')
      }
      options.fromPage = from
      options.toPage = to
      continue
    }

    if (arg === '--output') {
      options.output = path.resolve(argv[++i])
      continue
    }

    if (arg === '--concurrency') {
      options.concurrency = Number.parseInt(argv[++i], 10)
      continue
    }

    if (arg === '--delay') {
      options.delayMs = Number.parseInt(argv[++i], 10)
      continue
    }

    throw new Error(`Argumento desconhecido: ${arg}`)
  }

  if (!Number.isFinite(options.fromPage) || options.fromPage < 1) {
    throw new Error('--from deve ser um numero >= 1')
  }
  if (!Number.isFinite(options.toPage) || options.toPage < options.fromPage) {
    throw new Error('--to deve ser >= --from')
  }
  if (!Number.isFinite(options.concurrency) || options.concurrency < 1) {
    throw new Error('--concurrency deve ser >= 1')
  }
  if (!Number.isFinite(options.delayMs) || options.delayMs < 0) {
    throw new Error('--delay deve ser >= 0')
  }

  return options
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  if (!options) return

  console.log(`Iniciando fetch de historico (${options.forum.toUpperCase()}, paginas ${options.fromPage}-${options.toPage})`)

  const store = await fetchAuctionHistory({
    forum: options.forum,
    fromPage: options.fromPage,
    toPage: options.toPage,
    concurrency: options.concurrency,
    delayMs: options.delayMs,
    onProgress: (message) => console.log(message),
  })

  await mkdir(path.dirname(options.output), { recursive: true })
  await writeFile(options.output, JSON.stringify(store, null, 2), 'utf8')

  console.log(`\nConcluido: ${store.auctions.length} auctions salvas em ${options.output}`)
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Erro desconhecido'
  console.error(`Erro: ${message}`)
  process.exit(1)
})
