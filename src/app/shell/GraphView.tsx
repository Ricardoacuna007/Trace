import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { NoteGraphData, NoteGraphNode } from '../../features/notes-graph/graph'

interface GraphViewProps {
  graph: NoteGraphData
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

export function GraphView({ graph, selectedNoteId, onOpenNote }: GraphViewProps) {
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
    const border = cssVar('--border', 'rgba(255,255,255,0.06)')
    const border2 = cssVar('--border2', 'rgba(255,255,255,0.11)')
    const t3 = cssVar('--t3', '#555b6b')

    const svg = d3.select(svgElement)
    svg.selectAll('*').remove()
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('preserveAspectRatio', 'xMidYMid meet')

    const canvas = svg.append('g')
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.35, 3])
      .on('zoom', (event) => {
        canvas.attr('transform', event.transform.toString())
      })

    svg.call(zoom)

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

    const node = canvas
      .append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', (datum) => radiusFromDegree(datum.degree))
      .attr('fill', (datum) => (datum.noteId === selectedNoteId ? accentGlow : 'rgba(255,255,255,0.04)'))
      .attr('stroke', (datum) => (datum.noteId === selectedNoteId ? accent : border2))
      .attr('stroke-width', (datum) => (datum.noteId === selectedNoteId ? 1.5 : 1))
      .style('cursor', 'pointer')
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
      .attr('fill', (datum) => (datum.noteId === selectedNoteId ? accent : t3))
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
    }
  }, [graph, onOpenNote, selectedNoteId])

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col bg-[var(--bg)] p-4">
      <div ref={wrapperRef} className="min-h-0 flex-1 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg2)]">
        <svg ref={svgRef} className="h-full w-full" />
      </div>
      <p className="mt-2 font-mono text-[11px] text-[var(--t3)]">
        {graph.nodes.length} notas · {graph.links.length} conexiones · zoom con scroll
      </p>
    </section>
  )
}
