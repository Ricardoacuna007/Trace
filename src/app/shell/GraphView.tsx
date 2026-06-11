import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { NoteGraphData, NoteGraphNode } from '../../features/notes-graph/graph'
import { buildGraphNodeVisuals, type GraphNodeVisual } from '../../features/notes-graph/visuals'
import type { AppNode } from '../../types/workspace'

interface GraphViewProps {
  graph: NoteGraphData
  workspaceNodes: AppNode[]
  selectedNoteId: string | null
  onOpenNote: (noteId: string) => void
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

function radiusFromDegree(degree: number): number {
  return Math.max(8, Math.min(22, 8 + degree * 2.2))
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') {
    return fallback
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function fillForVisual(visual: GraphNodeVisual | undefined, accentGlow: string): string {
  if (visual?.kind === 'active') {
    return accentGlow
  }
  if (visual?.kind === 'orphan') {
    return 'rgba(248,113,113,0.10)'
  }
  if (visual?.kind === 'bridge') {
    return 'rgba(245,158,11,0.11)'
  }
  return 'rgba(255,255,255,0.04)'
}

function strokeForVisual(
  visual: GraphNodeVisual | undefined,
  colors: { accent: string; amber: string; border2: string; red: string },
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

export function GraphView({ graph, workspaceNodes, selectedNoteId, onOpenNote }: GraphViewProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

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
    const amber = cssVar('--amber', '#f59e0b')
    const border = cssVar('--border', 'rgba(255,255,255,0.06)')
    const border2 = cssVar('--border2', 'rgba(255,255,255,0.11)')
    const red = cssVar('--red', '#f87171')
    const t3 = cssVar('--t3', '#555b6b')
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
      .attr('r', (datum) => radiusFromDegree(datum.degree))
      .attr('fill', (datum) => fillForVisual(visuals.get(datum.noteId), accentGlow))
      .attr('stroke', (datum) => strokeForVisual(visuals.get(datum.noteId), { accent, amber, border2, red }))
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
      .force('collide', d3.forceCollide((datum) => radiusFromDegree((datum as GraphNodeDatum).degree) + 12))
      .on('tick', () => {
        link
          .attr('x1', (datum) => (datum.source as GraphNodeDatum).x ?? 0)
          .attr('y1', (datum) => (datum.source as GraphNodeDatum).y ?? 0)
          .attr('x2', (datum) => (datum.target as GraphNodeDatum).x ?? 0)
          .attr('y2', (datum) => (datum.target as GraphNodeDatum).y ?? 0)

        node.attr('cx', (datum) => datum.x ?? 0).attr('cy', (datum) => datum.y ?? 0)
        label.attr('x', (datum) => datum.x ?? 0).attr('y', (datum) => (datum.y ?? 0) + radiusFromDegree(datum.degree) + 11)
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
  }, [graph, onOpenNote, selectedNoteId, workspaceNodes])

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col bg-[var(--bg)] p-4">
      <div ref={wrapperRef} className="relative min-h-0 flex-1 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg2)]">
        <svg ref={svgRef} className="h-full w-full" />
      </div>
      <p className="mt-2 font-mono text-[11px] text-[var(--t3)]">
        {graph.nodes.length} notas | {graph.links.length} conexiones | huerfanas y puentes resaltados
      </p>
    </section>
  )
}
