import { Extension } from '@tiptap/core'
import { Node } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface CommentThread {
  id: string
  anchor_text: string
  status: string
}

const commentHighlightKey = new PluginKey('commentHighlight')

export const CommentHighlight = Extension.create({
  name: 'commentHighlight',

  addStorage() {
    return {
      threads: [] as CommentThread[],
    }
  },

  addProseMirrorPlugins() {
    const extension = this

    return [
      new Plugin({
        key: commentHighlightKey,
        state: {
          init(_, { doc }) {
            return buildDecorations(doc, extension.storage.threads)
          },
          apply(tr, oldDecorations) {
            if (tr.getMeta(commentHighlightKey) || tr.getMeta('commentHighlight')) {
              return buildDecorations(tr.doc, extension.storage.threads)
            }
            if (tr.docChanged) {
              return oldDecorations.map(tr.mapping, tr.doc)
            }
            return oldDecorations
          },
        },
        props: {
          decorations(state) {
            return this.getState(state) ?? DecorationSet.empty
          },
          handleClick(_view, _pos, event) {
            const target = event.target as HTMLElement
            const anchor = target.closest?.('[data-thread-id]') as HTMLElement | null
            if (anchor) {
              const threadId = anchor.getAttribute('data-thread-id')
              if (threadId) {
                document.dispatchEvent(new CustomEvent('comment-focus', { detail: { threadId } }))
                return true
              }
            }
            return false
          },
        },
      }),
    ]
  },
})

function buildFlatText(doc: Node): { flat: string; posMap: number[] } {
  const flatChars: string[] = []
  const posMap: number[] = []
  let needsSep = false

  doc.descendants((node: Node, pos: number) => {
    if (node.isTextblock) {
      if (needsSep) {
        flatChars.push(' ')
        posMap.push(-1)
      }
      const text = node.textContent
      for (let i = 0; i < text.length; i++) {
        flatChars.push(text[i])
        posMap.push(pos + 1 + i)
      }
      needsSep = true
      return false
    }
  })

  return { flat: flatChars.join(''), posMap }
}

function searchFlatText(
  flat: string,
  posMap: number[],
  searchText: string
): { from: number; to: number }[] {
  const normalized = searchText.replace(/\s+/g, ' ').trim()
  if (!normalized) return []

  const results: { from: number; to: number }[] = []
  let idx = 0
  while (true) {
    const found = flat.indexOf(normalized, idx)
    if (found === -1) break
    const from = posMap[found]
    const lastPos = posMap[found + normalized.length - 1]
    if (from !== -1 && lastPos !== -1) {
      results.push({ from, to: lastPos + 1 })
    }
    idx = found + 1
  }
  return results
}

export function findTextPositions(
  doc: Node,
  searchText: string
): { from: number; to: number }[] {
  const { flat, posMap } = buildFlatText(doc)
  return searchFlatText(flat, posMap, searchText)
}

function buildDecorations(doc: Node, threads: CommentThread[]): DecorationSet {
  const decorations: Decoration[] = []

  if (!threads || threads.length === 0) {
    return DecorationSet.empty
  }

  const { flat, posMap } = buildFlatText(doc)

  for (const thread of threads) {
    if (thread.status !== 'open') continue
    if (!thread.anchor_text) continue

    const positions = searchFlatText(flat, posMap, thread.anchor_text)
    for (const { from, to } of positions) {
      decorations.push(
        Decoration.inline(from, to, {
          class: 'comment-anchor comment-anchor-open',
          'data-thread-id': thread.id,
        })
      )
    }
  }

  return DecorationSet.create(doc, decorations)
}
