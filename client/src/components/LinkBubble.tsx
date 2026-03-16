import React from 'react'
import type { Editor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'

interface LinkBubbleProps {
  editor: Editor
}

export default function LinkBubble({ editor }: LinkBubbleProps) {
  const { href } = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const attrs = e.getAttributes('link')
      return { href: (attrs.href as string) || '' }
    },
  })

  const truncated = href.length > 40 ? href.slice(0, 37) + '...' : href

  const handleOpen = () => {
    window.open(href, '_blank', 'noopener')
  }

  const handleEdit = () => {
    const url = window.prompt('Edit URL', href)
    if (url !== null) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
  }

  const handleRemove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
  }

  return (
    <div className="link-bubble-menu">
      <span className="link-bubble-url" title={href}>{truncated}</span>
      <button className="tc-btn" onClick={handleOpen} title="Open link">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </button>
      <button className="tc-btn" onClick={handleEdit} title="Edit link">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button className="tc-btn tc-reject" onClick={handleRemove} title="Remove link">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  )
}
