import type { AppNode } from '../../types/workspace'

export type ContainerNode = AppNode & { type: 'workspace' | 'folder' }

export function toTimestamp(value: string): number {
  const fromDate = Date.parse(value)
  if (Number.isFinite(fromDate)) {
    return fromDate
  }

  const asNumber = Number(value)
  if (Number.isFinite(asNumber)) {
    return asNumber > 1_000_000_000_000 ? asNumber : asNumber * 1000
  }

  return 0
}

export function sortByPosition(
  a: { position: number; updatedAt: string },
  b: { position: number; updatedAt: string },
) {
  if (a.position !== b.position) {
    return a.position - b.position
  }
  return toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt)
}

export function isContainerNode(node: AppNode | null | undefined): node is ContainerNode {
  return Boolean(node && (node.type === 'workspace' || node.type === 'folder'))
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  const tagName = target.tagName.toLowerCase()
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select'
}
