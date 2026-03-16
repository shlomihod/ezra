import type { Editor } from '@tiptap/core'

function findChildIndex(
  node: { childCount: number; child: (i: number) => { nodeSize: number } },
  offset: number
): number {
  let pos = 0
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (pos + child.nodeSize > offset) return i
    pos += child.nodeSize
  }
  return node.childCount - 1
}

export function findMarkRange(editor: Editor, markType: string): { from: number; to: number } {
  const { from } = editor.state.selection
  const $pos = editor.state.doc.resolve(from)
  const { parent, parentOffset } = $pos
  let start = parentOffset
  let end = parentOffset

  while (start > 0) {
    const idx = findChildIndex(parent, start - 1)
    if (parent.child(idx).marks.some((m) => m.type.name === markType)) {
      start -= parent.child(idx).nodeSize
    } else break
  }

  while (end < parent.content.size) {
    const idx = findChildIndex(parent, end)
    if (parent.child(idx).marks.some((m) => m.type.name === markType)) {
      end += parent.child(idx).nodeSize
    } else break
  }

  const base = $pos.start()
  return { from: base + start, to: base + end }
}

export function hasTrackedChangeMark(editor: Editor): boolean {
  const { from } = editor.state.selection
  const marks = editor.state.doc.resolve(from).marks()
  return marks.some((m) => m.type.name === 'insertion' || m.type.name === 'deletion')
}
