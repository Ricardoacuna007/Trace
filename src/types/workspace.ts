export type NodeType = 'workspace' | 'folder' | 'note'

export interface AppNode {
  id: string
  title: string
  type: NodeType
  parentId: string | null
  content?: string
  icon?: string
  tags?: string[]
  position: number
  updatedAt: string
}

export interface TreeNode extends AppNode {
  children: TreeNode[]
}
