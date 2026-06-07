import type { AppNode, TreeNode } from '../../types/workspace'

interface ParentSelectionState {
  nodes: AppNode[]
  selectedNodeId: string | null
}

function parseUpdatedAt(value: string): number {
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

function compareNodes(a: AppNode, b: AppNode): number {
  if (a.position !== b.position) {
    return a.position - b.position
  }
  return parseUpdatedAt(b.updatedAt) - parseUpdatedAt(a.updatedAt)
}

function sortNodes(nodes: AppNode[]): AppNode[] {
  return [...nodes].sort((a, b) => {
    const aParent = a.parentId ?? ''
    const bParent = b.parentId ?? ''
    if (aParent !== bParent) {
      return aParent.localeCompare(bParent)
    }
    return compareNodes(a, b)
  })
}

function buildNodeTree(nodes: AppNode[]): TreeNode[] {
  const ordered = sortNodes(nodes)
  const nodeMap = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  for (const node of ordered) {
    nodeMap.set(node.id, { ...node, children: [] })
  }

  for (const node of ordered) {
    const current = nodeMap.get(node.id)
    if (!current) {
      continue
    }

    if (node.parentId) {
      const parent = nodeMap.get(node.parentId)
      if (parent) {
        parent.children.push(current)
        continue
      }
    }

    roots.push(current)
  }

  const sortTree = (items: TreeNode[]) => {
    items.sort(compareNodes)
    for (const item of items) {
      sortTree(item.children)
    }
  }

  sortTree(roots)
  return roots
}

export function withTree(nodes: AppNode[]): { nodes: AppNode[]; nodeTree: TreeNode[] } {
  const ordered = sortNodes(nodes)
  const workspaceNodes = ordered.filter((node) => !node.inbox)
  return {
    nodes: ordered,
    nodeTree: buildNodeTree(workspaceNodes),
  }
}

export function canContainChildren(nodeType: AppNode['type']): boolean {
  return nodeType === 'workspace' || nodeType === 'folder'
}

export function findPreferredParentId(
  state: ParentSelectionState,
  explicitParentId?: string | null,
): string | null {
  if (typeof explicitParentId !== 'undefined') {
    return explicitParentId
  }

  const selected = state.nodes.find((node) => node.id === state.selectedNodeId)
  if (!selected) {
    const workspace = state.nodes.find((node) => node.type === 'workspace')
    return workspace?.id ?? null
  }

  if (canContainChildren(selected.type)) {
    return selected.id
  }

  return selected.parentId
}

export function isMoveValid(
  nodes: AppNode[],
  nodeId: string,
  newParentId: string | null,
): { ok: boolean; reason?: string } {
  if (newParentId === nodeId) {
    return { ok: false, reason: 'Un nodo no puede ser su propio padre.' }
  }

  const node = nodes.find((item) => item.id === nodeId)
  if (!node) {
    return { ok: false, reason: 'Nodo no encontrado.' }
  }

  if (newParentId === null) {
    return node.type === 'workspace'
      ? { ok: true }
      : { ok: false, reason: 'Solo un workspace puede quedar en la raiz.' }
  }

  const parent = nodes.find((item) => item.id === newParentId)
  if (!parent) {
    return { ok: false, reason: 'Padre destino no encontrado.' }
  }
  if (!canContainChildren(parent.type)) {
    return { ok: false, reason: 'El destino debe ser un workspace o carpeta.' }
  }
  if (node.type === 'workspace') {
    return { ok: false, reason: 'Un workspace no puede moverse dentro de otro nodo.' }
  }

  const byId = new Map(nodes.map((item) => [item.id, item]))
  let cursor: AppNode | undefined = parent
  while (cursor) {
    if (cursor.id === nodeId) {
      return { ok: false, reason: 'No puedes mover un nodo dentro de su propio descendiente.' }
    }
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
  }

  return { ok: true }
}
