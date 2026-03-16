import { Extension } from '@tiptap/core'
import { findMarkRange } from '../utils/markRange'

export interface EzraShortcutsOptions {
  onAddComment: () => void
  onAddLink: () => void
}

export const EzraShortcuts = Extension.create<EzraShortcutsOptions>({
  name: 'ezraShortcuts',

  addOptions() {
    return {
      onAddComment: () => {},
      onAddLink: () => {},
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Alt-m': () => {
        this.options.onAddComment()
        return true
      },
      'Mod-k': () => {
        this.options.onAddLink()
        return true
      },
      'Mod-Enter': () => {
        const { from } = this.editor.state.selection
        const resolvedPos = this.editor.state.doc.resolve(from)
        const marks = resolvedPos.marks()

        const insertion = marks.find((m) => m.type.name === 'insertion')
        if (insertion) {
          const range = findMarkRange(this.editor, 'insertion')
          this.editor.chain().focus().setTextSelection(range).unsetMark('insertion').run()
          return true
        }

        const deletion = marks.find((m) => m.type.name === 'deletion')
        if (deletion) {
          const range = findMarkRange(this.editor, 'deletion')
          const { tr } = this.editor.state
          tr.setMeta('suggestionModeBypass', true)
          tr.delete(range.from, range.to)
          this.editor.view.dispatch(tr)
          this.editor.commands.focus()
          return true
        }

        return false
      },
      'Mod-Backspace': () => {
        const { from } = this.editor.state.selection
        const resolvedPos = this.editor.state.doc.resolve(from)
        const marks = resolvedPos.marks()

        const insertion = marks.find((m) => m.type.name === 'insertion')
        if (insertion) {
          const range = findMarkRange(this.editor, 'insertion')
          const { tr } = this.editor.state
          tr.setMeta('suggestionModeBypass', true)
          tr.delete(range.from, range.to)
          this.editor.view.dispatch(tr)
          this.editor.commands.focus()
          return true
        }

        const deletion = marks.find((m) => m.type.name === 'deletion')
        if (deletion) {
          const range = findMarkRange(this.editor, 'deletion')
          this.editor.chain().focus().setTextSelection(range).unsetMark('deletion').run()
          return true
        }

        return false
      },
    }
  },
})
