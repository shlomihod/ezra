import { Mark } from '@tiptap/core'

export const Deletion = Mark.create({
  name: 'deletion',

  parseHTML() {
    return [{ tag: 'del' }]
  },

  renderHTML() {
    return ['del', { class: 'tracked-deletion' }, 0]
  },
})
