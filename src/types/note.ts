import type { AppNode } from './workspace'

export type Note = AppNode & {
  type: 'note'
  content: string
}
