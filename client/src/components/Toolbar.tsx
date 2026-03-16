import React from 'react'
import { useEditorState } from '@tiptap/react'
import type { Editor } from '@tiptap/react'

interface ToolbarProps {
  editor: Editor
  onAddComment: () => void
  onAddLink: () => void
}

export default function Toolbar({ editor, onAddComment, onAddLink }: ToolbarProps) {
  // Only re-render when toolbar-relevant state changes
  const state = useEditorState({
    editor,
    selector: ({ editor: e }: { editor: Editor }) => ({
      isBold: e.isActive('bold'),
      isItalic: e.isActive('italic'),
      isCode: e.isActive('code'),
      isLink: e.isActive('link'),
      isH1: e.isActive('heading', { level: 1 }),
      isH2: e.isActive('heading', { level: 2 }),
      isH3: e.isActive('heading', { level: 3 }),
      isBulletList: e.isActive('bulletList'),
      isOrderedList: e.isActive('orderedList'),
      isBlockquote: e.isActive('blockquote'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      hasSelection: !e.state.selection.empty,
      isSuggestionMode: (e.storage as any).suggestionMode?.enabled ?? false,
    }),
  })

  const cmd = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault()
    fn()
  }

  return (
    <div className="editor-toolbar">
      {/* Undo / Redo */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${!state.canUndo ? 'toolbar-btn-disabled' : ''}`}
          onMouseDown={cmd(() => editor.chain().focus().undo().run())}
          disabled={!state.canUndo}
          title="Undo (Cmd+Z)"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6.69 3L3 13"/></svg>
        </button>
        <button
          className={`toolbar-btn ${!state.canRedo ? 'toolbar-btn-disabled' : ''}`}
          onMouseDown={cmd(() => editor.chain().focus().redo().run())}
          disabled={!state.canRedo}
          title="Redo (Cmd+Shift+Z)"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 019-9 9 9 0 016.69 3L21 13"/></svg>
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Block type */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${state.isH1 ? 'toolbar-btn-active' : ''}`}
          onMouseDown={cmd(() => editor.chain().focus().toggleHeading({ level: 1 }).run())}
          title="Heading 1"
        >
          H1
        </button>
        <button
          className={`toolbar-btn ${state.isH2 ? 'toolbar-btn-active' : ''}`}
          onMouseDown={cmd(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}
          title="Heading 2"
        >
          H2
        </button>
        <button
          className={`toolbar-btn ${state.isH3 ? 'toolbar-btn-active' : ''}`}
          onMouseDown={cmd(() => editor.chain().focus().toggleHeading({ level: 3 }).run())}
          title="Heading 3"
        >
          H3
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Inline formatting */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn toolbar-btn-bold ${state.isBold ? 'toolbar-btn-active' : ''}`}
          onMouseDown={cmd(() => editor.chain().focus().toggleBold().run())}
          title="Bold (Cmd+B)"
        >
          B
        </button>
        <button
          className={`toolbar-btn toolbar-btn-italic ${state.isItalic ? 'toolbar-btn-active' : ''}`}
          onMouseDown={cmd(() => editor.chain().focus().toggleItalic().run())}
          title="Italic (Cmd+I)"
        >
          I
        </button>
        <button
          className={`toolbar-btn toolbar-btn-code ${state.isCode ? 'toolbar-btn-active' : ''}`}
          onMouseDown={cmd(() => editor.chain().focus().toggleCode().run())}
          title="Inline code (Cmd+E)"
        >
          {'<>'}
        </button>
        <button
          className={`toolbar-btn ${state.isLink ? 'toolbar-btn-active' : ''}`}
          onMouseDown={cmd(onAddLink)}
          title="Link (Cmd+K)"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Lists & blocks */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${state.isBulletList ? 'toolbar-btn-active' : ''}`}
          onMouseDown={cmd(() => editor.chain().focus().toggleBulletList().run())}
          title="Bullet list"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
        </button>
        <button
          className={`toolbar-btn ${state.isOrderedList ? 'toolbar-btn-active' : ''}`}
          onMouseDown={cmd(() => editor.chain().focus().toggleOrderedList().run())}
          title="Ordered list"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/><text x="2.5" y="8" fontSize="8" fill="currentColor" stroke="none" fontFamily="sans-serif" fontWeight="600">1</text><text x="2.5" y="14" fontSize="8" fill="currentColor" stroke="none" fontFamily="sans-serif" fontWeight="600">2</text><text x="2.5" y="20" fontSize="8" fill="currentColor" stroke="none" fontFamily="sans-serif" fontWeight="600">3</text></svg>
        </button>
        <button
          className={`toolbar-btn ${state.isBlockquote ? 'toolbar-btn-active' : ''}`}
          onMouseDown={cmd(() => editor.chain().focus().toggleBlockquote().run())}
          title="Quote"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z"/></svg>
        </button>
        <button
          className="toolbar-btn"
          onMouseDown={cmd(() => editor.chain().focus().setHorizontalRule().run())}
          title="Horizontal rule"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12"/></svg>
        </button>
      </div>

      <div className="toolbar-spacer" />

      {/* Suggestion Mode */}
      <button
        className={`toolbar-btn toolbar-btn-suggest ${state.isSuggestionMode ? 'toolbar-btn-suggest-active' : ''}`}
        onMouseDown={cmd(() => editor.commands.toggleSuggestionMode())}
        title="Toggle suggestion mode (Cmd+Shift+S)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
        Suggesting
      </button>

      {/* Comment */}
      <button
        className={`toolbar-btn toolbar-btn-comment ${state.hasSelection ? '' : 'toolbar-btn-disabled'}`}
        onMouseDown={cmd(onAddComment)}
        disabled={!state.hasSelection}
        title="Add comment on selection"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        Comment
      </button>
    </div>
  )
}
