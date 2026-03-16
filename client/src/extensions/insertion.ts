import { Mark } from '@tiptap/core'

export const Insertion = Mark.create({
  name: 'insertion',

  parseHTML() {
    return [{ tag: 'ins' }]
  },

  renderHTML() {
    return ['ins', { class: 'tracked-insertion' }, 0]
  },
})
