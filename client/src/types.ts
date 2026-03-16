export interface Reply {
  id: string
  thread_id: string
  author: string
  body: string
  created_at: string
}

export interface Thread {
  id: string
  doc_id: string
  anchor_text: string
  status: 'open' | 'resolved'
  created_at: string
  replies: Reply[]
}
