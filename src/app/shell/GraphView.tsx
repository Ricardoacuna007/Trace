import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { ClusterPanel } from '../../features/notes-graph/ClusterPanel'
import { buildGraphClusters, type GraphCluster } from '../../features/notes-graph/clusters'
import type { NoteGraphData, NoteGraphNode } from '../../features/notes-graph/graph'
import { buildGraphNodeVisuals, type GraphNodeVisual } from '../../features/notes-graph/visuals'
import type { TraceGraphSettings } from '../../lib/db'
import type { AppNode } from '../../types/workspace'

interface GraphViewProps {
  graph: NoteGraphData
  graphSettings: TraceGraphSettings
  workspaceNodes: AppNode[]
  selectedNoteId: string | null
  onOpenNote: (noteId: string) => void
  onUpdateGraphSettings: (patch: Partial<TraceGraphSettings>) => void
}

interface GraphNodeDatum extends d3.SimulationNodeDatum, NoteGraphNode {
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

interface GraphLinkDatum extends d3.SimulationLinkDatum<GraphNodeDatum> {
  id: string
  source: string | GraphNodeDatum
  target: string | GraphNodeDatum
  weight: number
}

function radiusFromDegree(degree: number, scale: number): number {
  return Math.max(8, Math.min(22, 8 + degree * 2.2)) * scale
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') {
    return fallback
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  if (!/^[a-f0-9]{6}$/i.test(clean)) {
    return hex
  }
  const red = Number.parseInt(clean.slice(0, 2), 16)
  const green = Number.parseInt(clean.slice(2, 4), 16)
  const blue = Number.parseInt(clean.slice(4, 6), 16)
  return `rgba(${red},${green},${blue},${alpha})`
}

function fillForVisual(
  visual: GraphNodeVisual | undefined,
  accentGlow: string,
  colors: { amber: string; red: string },
  clusterColor: string | undefined,
): string {
  if (visual?.kind === 'active') {
    return accentGlow
  }
  if (visual?.kind === 'orphan') {
    return hexToRgba(colors.red, 0.12)
  }
  if (visual?.kind === 'bridge') {
    return hexToRgba(colors.amber, 0.12)
  }
  if (clusterColor) {
    return hexToRgba(clusterColor, 0.11)
  }
  return 'rgba(255,255,255,0.04)'
}

function strokeForVisual(
  visual: GraphNodeVisual | undefined,
  colors: { accent: string; amber: string; border2: string; red: string },
  clusterColor: string | undefined,
): string {
  if (visual?.kind === 'active') {
    return colors.accent
  }
  if (visual?.kind === 'orphan') {
    return colors.red
  }
  if (visual?.kind === 'bridge') {
    return colors.amber
  }
  if (visual?.isRecent) {
    return colors.accent
  }
  if (clusterColor) {
    return clusterColor
  }
  return colors.border2
}

function labelColorForVisual(
  visual: GraphNodeVisual | undefined,
  colors: { accent: string; amber: string; red: string; t3: string },
): string {
  if (visual?.kind === 'active') {
    return colors.accent
  }
  if (visual?.kind === 'orphan') {
    return colors.red
  }
  if (visual?.kind === 'bridge') {
    return colors.amber
  }
  return colors.t3
}

function clusterHullPath(cluster: GraphCluster, nodeByGraphId: Map<string, GraphNodeDatum>): string | null {
  const points = cluster.graphNodeIds
    .map((graphNodeId) => nodeByGraphId.get(graphNodeId))
    .filter((node): node is GraphNodeDatum => typeof node?.x === 'number' && typeof node.y === 'number')
    .map((node) => [node.x ?? 0, node.y ?? 0] satisfies [number, number])

  if (points.length < 3) {
    return null
  }

  const hull = d3.polygonHull(points)
  if (!hull) {
    return null
  }

  return `M${hull.map((point) => point.join(',')).join('L')}Z`
}

export function GraphView({
  graph,
  graphSettings,
  workspaceNodes,
  selectedNoteId,
  onOpenNote,
  onUpdateGraphSettings,
}: GraphViewProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null)
  const clusters = useMemo(
    () => buildGraphClusters(
      graph,
      workspaceNodes,
      graphSettings.cluster_colors,
      graphSettings.cluster_labels,
    ),
    [graph, graphSettings.cluster_colors, graphSettings.cluster_labels, workspaceNodes],
  )
  const selectedCluster = clusters.find((cluster) => cluster.id === selectedClusterId) ?? null
  const clusterColorByNoteId = useMemo(() => {
    const colorByNoteId = new Map<string, string>()
    for (const cluster of clusters) {
      for (const noteId of cluster.noteIds) {
        colorByNoteId.set(noteId, cluster.color)
      }
    }
    return colorByNoteId
  }, [clusters])

  useEffect(() => {
    const wrapper = wrapperRef.current
    const svgElement = svgRef.current
    if (!wrapper || !svgElement) {
      return undefined
    }

    const width = wrapper.clientWidth
    const height = wrapper.clientHeight
    const accent = cssVar('--accent', '#5e8bff')
    const accentGlow = cssVar('--accent-glow', 'rgba(94,139,255,0.13)')
    const amber = graphSettings.bridge_color || cssVar('--trace-graph-bridge', '#f59e0b')
    const border = cssVar('--border', 'rgba(255,255,255,0.06)')
    const border2 = cssVar('--border2', 'rgba(255,255,255,0.11)')
    const red = graphSettings.orphan_color || cssVar('--trace-graph-orphan', '#f87171')
    const t3 = cssVar('--t3', '#555b6b')
    const nodeScale = graphSettings.node_scale
    const visuals = buildGraphNodeVisuals(graph, workspaceNodes, selectedNoteId)

    const svg = d3.select(svgElement)
    svg.selectAll('*').remove()
    d3.select(wrapper).selectAll('.trace-graph-tooltip').remove()
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('preserveAspectRatio', 'xMidYMid meet')

    const canvas = svg.append('g')
    const tooltip = d3.select(wrapper)
      .append('div')
      .attr('class', 'trace-graph-tooltip pointer-events-none absolute z-10 max-w-[240px] rounded-[var(--radius-md)] border border-[var(--border2)] bg-[var(--bg3)] px-3 py-2 text-left opacity-0 shadow-2xl transition-opacity duration-150')
    tooltip.append('p').attr('class', 'trace-graph-tooltip-title mb-1 truncate text-[12px] font-medium text-[var(--t1)]')
    tooltip.append('p').attr('class', 'trace-graph-tooltip-preview line-clamp-3 text-[11px] leading-snug text-[var(--t2)]')

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.35, 3])
      .on('zoom', (event) => {
        canvas.attr('transform', event.transform.toString())
      })

    svg.call(zoom)
    svg.on('dblclick.zoom', null)
    svg.on('dblclick', (event) => {
      event.preventDefault()
      svg.transition().duration(220).call(zoom.transform, d3.zoomIdentity)
    })

    if (graph.nodes.length === 0) {
      canvas
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', t3)
        .attr('font-size', 12)
        .attr('font-family', 'var(--mono)')
        .text('No hay notas para mostrar')
      return () => {
        svg.on('.zoom', null)
        svg.on('dblclick', null)
        tooltip.remove()
      }
    }

    const nodes: GraphNodeDatum[] = graph.nodes.map((node) => ({ ...node }))
    const nodeIds = new Set(nodes.map((node) => node.id))
    const links: GraphLinkDatum[] = graph.links
      .filter((link) => nodeIds.has(link.source) && nodeIds.has(link.target))
      .map((link) => ({ ...link }))

    const clusterPath = canvas
      .append('g')
      .attr('pointer-events', 'all')
      .selectAll('path')
      .data(clusters)
      .join('path')
      .attr('fill', (cluster) => hexToRgba(cluster.color, 0.06))
      .attr('stroke', (cluster) => hexToRgba(cluster.color, 0.38))
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '5 6')
      .style('cursor', 'pointer')
      .on('click', (event, cluster) => {
        event.stopPropagation()
        setSelectedClusterId(cluster.id)
      })

    const link = canvas
      .append('g')
      .attr('stroke-linecap', 'round')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', border)
      .attr('stroke-width', 1)

    const positionTooltip = (event: MouseEvent) => {
      const bounds = wrapper.getBoundingClientRect()
      const left = Math.min(event.clientX - bounds.left + 14, Math.max(16, bounds.width - 260))
      const top = Math.min(event.clientY - bounds.top + 14, Math.max(16, bounds.height - 98))
      tooltip
        .style('left', `${left}px`)
        .style('top', `${top}px`)
    }

    const node = canvas
      .append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', (datum) => radiusFromDegree(datum.degree, nodeScale))
      .attr('fill', (datum) => fillForVisual(
        visuals.get(datum.noteId),
        accentGlow,
        { amber, red },
        clusterColorByNoteId.get(datum.noteId),
      ))
      .attr('stroke', (datum) => strokeForVisual(
        visuals.get(datum.noteId),
        { accent, amber, border2, red },
        clusterColorByNoteId.get(datum.noteId),
      ))
      .attr('stroke-width', (datum) => {
        const visual = visuals.get(datum.noteId)
        return visual?.kind === 'active' || visual?.isRecent ? 1.8 : 1
      })
      .style('cursor', 'pointer')
      .on('mouseenter', (event, datum) => {
        const visual = visuals.get(datum.noteId)
        tooltip.select('.trace-graph-tooltip-title').text(visual?.title ?? datum.label)
        tooltip.select('.trace-graph-tooltip-preview').text(visual?.preview ?? '')
        tooltip.style('opacity', '1')
        positionTooltip(event)
      })
      .on('mousemove', (event) => positionTooltip(event))
      .on('mouseleave', () => tooltip.style('opacity', '0'))
      .on('click', (_, datum) => onOpenNote(datum.noteId))

    const label = canvas
      .append('g')
      .attr('pointer-events', 'none')
      .style('display', graphSettings.show_labels ? null : 'none')
      .selectAll('text')
      .data(nodes)
      .join('text')
      .attr('text-anchor', 'middle')
      .attr('font-family', 'var(--mono)')
      .attr('font-size', 9)
      .attr('fill', (datum) => labelColorForVisual(visuals.get(datum.noteId), { accent, amber, red, t3 }))
      .text((datum) => datum.label.slice(0, 22))

    const simulation = d3
      .forceSimulation(nodes)
      .force('link', d3.forceLink<GraphNodeDatum, GraphLinkDatum>(links).id((datum) => datum.id).distance(86))
      .force('charge', d3.forceManyBody().strength(-260))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide((datum) => radiusFromDegree((datum as GraphNodeDatum).degree, nodeScale) + 12))
      .on('tick', () => {
        const nodeByGraphId = new Map(nodes.map((datum) => [datum.id, datum]))
        clusterPath.attr('d', (cluster) => clusterHullPath(cluster, nodeByGraphId))

        link
          .attr('x1', (datum) => (datum.source as GraphNodeDatum).x ?? 0)
          .attr('y1', (datum) => (datum.source as GraphNodeDatum).y ?? 0)
          .attr('x2', (datum) => (datum.target as GraphNodeDatum).x ?? 0)
          .attr('y2', (datum) => (datum.target as GraphNodeDatum).y ?? 0)

        node.attr('cx', (datum) => datum.x ?? 0).attr('cy', (datum) => datum.y ?? 0)
        label.attr('x', (datum) => datum.x ?? 0).attr('y', (datum) => (datum.y ?? 0) + radiusFromDegree(datum.degree, nodeScale) + 11)
      })

    const drag = d3
      .drag<SVGCircleElement, GraphNodeDatum>()
      .on('start', (event, datum) => {
        if (!event.active) {
          simulation.alphaTarget(0.2).restart()
        }
        datum.fx = datum.x
        datum.fy = datum.y
      })
      .on('drag', (event, datum) => {
        datum.fx = event.x
        datum.fy = event.y
      })
      .on('end', (event, datum) => {
        if (!event.active) {
          simulation.alphaTarget(0)
        }
        datum.fx = null
        datum.fy = null
      })

    node.call(drag)

    return () => {
      simulation.stop()
      svg.on('.zoom', null)
      svg.on('dblclick', null)
      tooltip.remove()
    }
  }, [clusterColorByNoteId, clusters, graph, graphSettings, onOpenNote, selectedNoteId, workspaceNodes])

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col bg-[var(--bg)] p-4">
      <div ref={wrapperRef} className="relative min-h-0 flex-1 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg2)]">
        <svg ref={svgRef} className="h-full w-full" />
        {clusters.length > 0 ? (
          <div className="absolute left-3 top-3 z-10 flex max-w-[360px] flex-wrap gap-1.5">
            {clusters.slice(0, 6).map((cluster) => (
              <button
                key={cluster.id}
                type="button"
                aria-label={`Abrir cluster ${cluster.label}`}
                className="flex max-w-[150px] items-center gap-1.5 rounded-[var(--radius-md)] border bg-[var(--bg3)] px-2 py-1 font-mono text-[10px] text-[var(--t2)] shadow-xl transition-all hover:bg-[var(--bg4)] hover:text-[var(--t1)]"
                style={{ borderColor: hexToRgba(cluster.color, 0.38) }}
                onClick={() => setSelectedClusterId(cluster.id)}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cluster.color }} />
                <span className="truncate">{cluster.label}</span>
                <span className="text-[var(--t3)]">{cluster.notes.length}</span>
              </button>
            ))}
          </div>
        ) : null}
        {selectedCluster ? (
          <ClusterPanel
            key={selectedCluster.id}
            cluster={selectedCluster}
            onClose={() => setSelectedClusterId(null)}
            onRenameCluster={(label) => {
              const nextLabels = { ...graphSettings.cluster_labels }
              if (label) {
                nextLabels[selectedCluster.labelKey] = label
              } else {
                delete nextLabels[selectedCluster.labelKey]
              }
              onUpdateGraphSettings({ cluster_labels: nextLabels })
            }}
            onOpenNote={(noteId) => {
              setSelectedClusterId(null)
              onOpenNote(noteId)
            }}
          />
        ) : null}
      </div>
      <p className="mt-2 font-mono text-[11px] text-[var(--t3)]">
        {graph.nodes.length} notas | {graph.links.length} conexiones | huerfanas y puentes resaltados
      </p>
    </section>
  )
}
