import {
  Bookmark,
  FileText,
  FolderClosed,
  FolderOpen,
  Hash,
  Layers3,
  NotebookText,
  Star,
  StickyNote,
  Tag,
} from 'lucide-react'
import { getNodeTypeIconColor, resolveNodeIconKey } from '../../lib/node-icons'
import type { NodeType } from '../../types/workspace'

interface NodeTypeIconProps {
  nodeType: NodeType
  storedIcon?: string | null
  isOpen?: boolean
  className?: string
}

export function NodeTypeIcon({ nodeType, storedIcon, isOpen = false, className }: NodeTypeIconProps) {
  const iconKey = resolveNodeIconKey(nodeType, storedIcon)
  const classes = `${getNodeTypeIconColor(nodeType)} ${className ?? ''}`.trim()

  if (iconKey === 'workspace') {
    return <Layers3 className={classes} aria-hidden="true" />
  }
  if (iconKey === 'folder') {
    return isOpen
      ? <FolderOpen className={classes} aria-hidden="true" />
      : <FolderClosed className={classes} aria-hidden="true" />
  }
  if (iconKey === 'note') {
    return <FileText className={classes} aria-hidden="true" />
  }
  if (iconKey === 'sticky-note') {
    return <StickyNote className={classes} aria-hidden="true" />
  }
  if (iconKey === 'notebook') {
    return <NotebookText className={classes} aria-hidden="true" />
  }
  if (iconKey === 'bookmark') {
    return <Bookmark className={classes} aria-hidden="true" />
  }
  if (iconKey === 'tag') {
    return <Tag className={classes} aria-hidden="true" />
  }
  if (iconKey === 'star') {
    return <Star className={classes} aria-hidden="true" />
  }
  return <Hash className={classes} aria-hidden="true" />
}
