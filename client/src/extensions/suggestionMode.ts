import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection, type Transaction } from '@tiptap/pm/state'
import { ReplaceStep } from '@tiptap/pm/transform'
import { Slice, Fragment, type MarkType, type Node as PmNode } from '@tiptap/pm/model'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    suggestionMode: {
      toggleSuggestionMode: () => ReturnType
    }
  }
}

export const suggestionModeKey = new PluginKey('suggestionMode')

export const SuggestionMode = Extension.create({
  name: 'suggestionMode',

  addStorage() {
    return { enabled: false }
  },

  addCommands() {
    return {
      toggleSuggestionMode:
        () =>
        ({ tr, dispatch }) => {
          this.storage.enabled = !this.storage.enabled
          if (dispatch) dispatch(tr)
          return true
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-s': () => {
        this.editor.commands.toggleSuggestionMode()
        return true
      },
    }
  },

  addProseMirrorPlugins() {
    const extension = this

    return [
      new Plugin({
        key: suggestionModeKey,

        appendTransaction(transactions: readonly Transaction[], oldState, newState) {
          if (!extension.storage.enabled) return null

          // Find the first user-initiated doc-changing transaction
          const userTr = transactions.find(
            (tr) =>
              tr.docChanged &&
              !tr.getMeta('suggestionModeBypass') &&
              !tr.getMeta('history$'),
          )
          if (!userTr) return null

          const schema = newState.schema
          const insertionMarkType: MarkType = schema.marks.insertion
          const deletionMarkType: MarkType = schema.marks.deletion
          if (!insertionMarkType || !deletionMarkType) return null

          const insertionMark = insertionMarkType.create()
          const deletionMark = deletionMarkType.create()

          // Build a corrective transaction that undoes the raw edit and re-applies with marks
          let corrTr = newState.tr
          corrTr.setMeta('suggestionModeBypass', true)
          let hasCorrections = false

          for (const step of userTr.steps) {
            if (!(step instanceof ReplaceStep)) continue

            const { from, to } = step
            const slice = step.slice
            const isInsertion = slice.size > 0
            const isDeletion = from !== to

            if (isDeletion) {
              // Use oldState.doc to recover the deleted content
              const deletedSlice = oldState.doc.slice(from, to)
              const fragments: PmNode[] = []

              deletedSlice.content.forEach((node) => {
                if (node.isText) {
                  const hasInsertionMark = node.marks.some((m) => m.type === insertionMarkType)
                  if (!hasInsertionMark) {
                    const newMarks = node.marks
                      .filter((m) => m.type !== deletionMarkType)
                      .concat(deletionMark)
                    fragments.push(node.mark(newMarks))
                  }
                  // Content with insertion mark: truly delete (don't re-add)
                } else {
                  fragments.push(node)
                }
              })

              if (fragments.length > 0) {
                // Undo the deletion: replace the post-transaction range with recovered content
                // In newState, the deletion already happened, so `from` to `from` is where content was removed
                // But if there was also an insertion, the new content sits at `from`
                const reInsertSlice = new Slice(Fragment.from(fragments), 0, 0)

                if (isInsertion) {
                  // Replace: deleted content was replaced with new content
                  // In newState, from..from+slice.size contains the new content
                  // We want: [deleted-with-marks][new-with-insertion-mark]
                  const newContentEnd = from + slice.size

                  // Insert the recovered deleted content before the new content
                  corrTr.replace(from, from, reInsertSlice)

                  // The new content shifted right by reInsertSlice.size
                  const shiftedStart = from + reInsertSlice.size
                  const shiftedEnd = shiftedStart + slice.size
                  corrTr.addMark(shiftedStart, shiftedEnd, insertionMark)
                } else {
                  // Pure deletion: re-insert the deleted content at `from`
                  corrTr.replace(from, from, reInsertSlice)
                  // Keep cursor before the deleted content, not after
                  corrTr.setSelection(TextSelection.create(corrTr.doc, from))
                }

                hasCorrections = true
              } else if (isInsertion) {
                // All deleted content had insertion marks (truly deleted)
                // But there's new content — mark it as insertion
                const insertEnd = from + slice.size
                corrTr.addMark(from, insertEnd, insertionMark)
                hasCorrections = true
              }
              // else: pure deletion of insertion-only content — original transaction is correct
            } else if (isInsertion) {
              // Pure insertion — add insertion mark to new content
              const insertEnd = from + slice.size
              corrTr.addMark(from, insertEnd, insertionMark)
              hasCorrections = true
            }
          }

          return hasCorrections ? corrTr : null
        },
      }),
    ]
  },
})
