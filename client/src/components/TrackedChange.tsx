import React from 'react'
import type { Editor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'
import { findMarkRange } from '../utils/markRange'

interface TrackedChangeProps {
  editor: Editor
  docId: string
  onSave: () => void
}

export default function TrackedChange({ editor, docId, onSave }: TrackedChangeProps) {
  const { insertionMark, deletionMark } = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const { from } = e.state.selection
      const resolvedPos = e.state.doc.resolve(from)
      const marks = resolvedPos.marks()
      return {
        insertionMark: marks.find((m) => m.type.name === 'insertion'),
        deletionMark: marks.find((m) => m.type.name === 'deletion'),
      }
    },
  })

  const saveContent = async () => {
    try {
      await fetch(`/api/documents/${encodeURIComponent(docId)}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editor.getJSON() }),
      })
      onSave()
    } catch (err) {
      console.error('Failed to save after tracked change action:', err)
    }
  }

  const handleAcceptInsertion = async () => {
    const range = findMarkRange(editor, 'insertion')
    editor.chain().focus().setTextSelection(range).unsetMark('insertion').run()
    await saveContent()
  }

  const handleRejectInsertion = async () => {
    const range = findMarkRange(editor, 'insertion')
    const { tr } = editor.state
    tr.setMeta('suggestionModeBypass', true)
    tr.delete(range.from, range.to)
    editor.view.dispatch(tr)
    editor.commands.focus()
    await saveContent()
  }

  const handleAcceptDeletion = async () => {
    const range = findMarkRange(editor, 'deletion')
    const { tr } = editor.state
    tr.setMeta('suggestionModeBypass', true)
    tr.delete(range.from, range.to)
    editor.view.dispatch(tr)
    editor.commands.focus()
    await saveContent()
  }

  const handleRejectDeletion = async () => {
    const range = findMarkRange(editor, 'deletion')
    editor.chain().focus().setTextSelection(range).unsetMark('deletion').run()
    await saveContent()
  }

  return (
    <div className="tracked-change-menu">
      {insertionMark && (
        <>
          <span className="tc-label tc-label-insertion">Insertion</span>
          <button className="tc-btn tc-accept" onClick={handleAcceptInsertion}>
            Accept
          </button>
          <button className="tc-btn tc-reject" onClick={handleRejectInsertion}>
            Reject
          </button>
        </>
      )}
      {deletionMark && (
        <>
          <span className="tc-label tc-label-deletion">Deletion</span>
          <button className="tc-btn tc-accept" onClick={handleAcceptDeletion}>
            Accept
          </button>
          <button className="tc-btn tc-reject" onClick={handleRejectDeletion}>
            Reject
          </button>
        </>
      )}
    </div>
  )
}
