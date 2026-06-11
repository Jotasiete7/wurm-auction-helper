export interface AuctionComment {
  author: string
  timestamp: string
  message: string
}

export interface AuctionHistoryEntry {
  id: string
  title: string
  author: string
  date: string
  href: string
  comments: AuctionComment[]
}

export interface AuctionHistoryStore {
  forum: 'nfi' | 'sfi'
  fetchedAt: string
  pageRange: { from: number; to: number }
  totalPages: number | null
  auctions: AuctionHistoryEntry[]
}

export interface ListTopicStub {
  title: string
  author: string
  href: string
  listDate: string
}

export interface AuctionHistoryCommentPreview {
  author: string
  timestamp: string
  message: string
}

export interface AuctionHistoryIndexEntry {
  id: string
  title: string
  author: string
  date: string
  href: string
  lastComment?: AuctionHistoryCommentPreview
  secondLastComment?: AuctionHistoryCommentPreview
}

export interface AuctionHistoryIndex {
  forum: 'nfi' | 'sfi'
  fetchedAt: string
  entries: AuctionHistoryIndexEntry[]
}
