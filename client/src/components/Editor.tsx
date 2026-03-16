import React, { useEffect, useRef, useCallback, useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import type { Editor as TiptapEditor } from '@tiptap/core'
import { hasTrackedChangeMark } from '../utils/markRange'
import { Insertion } from '../extensions/insertion'
import { Deletion } from '../extensions/deletion'
import { CommentHighlight } from '../extensions/commentHighlight'
import type { CommentThread } from '../extensions/commentHighlight'
import { EzraShortcuts } from '../extensions/shortcuts'
import { SuggestionMode } from '../extensions/suggestionMode'
import TrackedChange from './TrackedChange'
import LinkBubble from './LinkBubble'
import Toolbar from './Toolbar'

interface EditorProps {
  docId: string
  content: Record<string, unknown> | null
  threads: CommentThread[]
  onContentChange: () => void
  onStartComment: (anchorText: string) => void
}

export default function Editor({ docId, content, threads, onContentChange, onStartComment }: EditorProps) {
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isExternalUpdate = useRef(false)

  const saveContent = useCallback(
    async (json: Record<string, unknown>) => {
      try {
        await fetch(`/api/documents/${encodeURIComponent(docId)}/content`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: json }),
        })
        onContentChange()
      } catch (err) {
        console.error('Failed to save content:', err)
      }
    },
    [docId, onContentChange]
  )

  const saveContentRef = useRef(saveContent)
  useEffect(() => {
    saveContentRef.current = saveContent
  }, [saveContent])

  // Refs for shortcuts extension callbacks (avoid stale closures)
  const addCommentRef = useRef<() => void>(() => {})
  const addLinkRef = useRef<() => void>(() => {})

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false, strike: false, link: { openOnClick: false, autolink: true, linkOnPaste: true }, underline: false }),
      Insertion,
      Deletion,
      CommentHighlight,
      EzraShortcuts.configure({ onAddComment: () => addCommentRef.current(), onAddLink: () => addLinkRef.current() }),
      SuggestionMode,
    ],
    immediatelyRender: false,
    content: content || { type: 'doc', content: [{ type: 'paragraph' }] },
    onUpdate: ({ editor }) => {
      if (isExternalUpdate.current) return

      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      saveTimeout.current = setTimeout(() => {
        saveContentRef.current(editor.getJSON())
      }, 500)
    },
  })

  useEffect(() => {
    if (!editor || !content) return

    const currentJSON = JSON.stringify(editor.getJSON())
    const newJSON = JSON.stringify(content)
    if (currentJSON === newJSON) return

    isExternalUpdate.current = true
    const { from, to } = editor.state.selection
    editor.commands.setContent(content, { emitUpdate: false })
    const maxPos = editor.state.doc.content.size
    try {
      editor.commands.setTextSelection({ from: Math.min(from, maxPos), to: Math.min(to, maxPos) })
    } catch {
      // ignore
    }
    isExternalUpdate.current = false
  }, [content, editor])

  useEffect(() => {
    if (!editor) return
    const storage = (editor.storage as unknown as Record<string, { threads: CommentThread[] }>).commentHighlight
    storage.threads = threads
    const { tr } = editor.state
    tr.setMeta('commentHighlight', true)
    editor.view.dispatch(tr)
  }, [threads, editor])

  const handleAddComment = useCallback(() => {
    if (!editor) return
    const { from, to } = editor.state.selection
    if (from === to) return
    const text = editor.state.doc.textBetween(from, to, ' ')
    if (!text.trim()) return
    onStartComment(text)
  }, [editor, onStartComment])

  const handleAddLink = useCallback(() => {
    if (!editor) return
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run()
      return
    }
    const url = window.prompt('Enter URL')
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }, [editor])

  // Keep the refs up to date
  useEffect(() => {
    addCommentRef.current = handleAddComment
  }, [handleAddComment])

  useEffect(() => {
    addLinkRef.current = handleAddLink
  }, [handleAddLink])

  // Listen for anchor-focus events from clicking a comment thread card
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!editor) return
    const handler = (e: Event) => {
      const { threadId } = (e as CustomEvent).detail
      const el = editor.view.dom.querySelector(`[data-thread-id="${CSS.escape(threadId)}"]`) as HTMLElement | null
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('comment-anchor-focused')
        if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current)
        focusTimeoutRef.current = setTimeout(() => el.classList.remove('comment-anchor-focused'), 1500)
      }
    }
    document.addEventListener('anchor-focus', handler)
    return () => {
      document.removeEventListener('anchor-focus', handler)
      if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current)
    }
  }, [editor])

  const bubbleMenuOptions = useMemo(() => ({ strategy: 'fixed' as const, placement: 'top' as const, offset: 8 }), [])

  const shouldShowTrackedChange = useCallback(
    ({ editor: e }: { editor: TiptapEditor }) => hasTrackedChangeMark(e),
    []
  )

  const shouldShowCommentMenu = useCallback(
    ({ editor: e }: { editor: TiptapEditor }) => {
      const { from, to } = e.state.selection
      return from !== to && !hasTrackedChangeMark(e)
    },
    []
  )

  const shouldShowLinkBubble = useCallback(
    ({ editor: e }: { editor: TiptapEditor }) => {
      const { from, to } = e.state.selection
      return from === to && e.isActive('link') && !hasTrackedChangeMark(e)
    },
    []
  )

  if (!editor) return null

  return (
    <div className="editor-wrapper">
      <Toolbar editor={editor} onAddComment={handleAddComment} onAddLink={handleAddLink} />

      <div className="editor-container">
        <BubbleMenu
          pluginKey="trackedChangeBubbleMenu"
          editor={editor}
          shouldShow={shouldShowTrackedChange}
          appendTo={() => document.body}
          options={bubbleMenuOptions}
          style={{ zIndex: 50 }}
        >
          <TrackedChange editor={editor} docId={docId} onSave={onContentChange} />
        </BubbleMenu>

        <BubbleMenu
          pluginKey="commentBubbleMenu"
          editor={editor}
          shouldShow={shouldShowCommentMenu}
          appendTo={() => document.body}
          options={bubbleMenuOptions}
          style={{ zIndex: 50 }}
        >
          <div className="comment-bubble-menu">
            <button className="comment-bubble-btn" onClick={handleAddComment} title="Add comment (Cmd+Alt+M)">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 2.5A1.5 1.5 0 0 1 3.5 1h9A1.5 1.5 0 0 1 14 2.5v7A1.5 1.5 0 0 1 12.5 11H5.707l-2.854 2.854A.5.5 0 0 1 2 13.5v-11Z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </BubbleMenu>

        <BubbleMenu
          pluginKey="linkBubbleMenu"
          editor={editor}
          shouldShow={shouldShowLinkBubble}
          appendTo={() => document.body}
          options={bubbleMenuOptions}
          style={{ zIndex: 50 }}
        >
          <LinkBubble editor={editor} />
        </BubbleMenu>

        <EditorContent editor={editor} className="tiptap-editor" />
      </div>
    </div>
  )
}
