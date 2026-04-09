import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

const TYPE_COLORS = {
  person: '#1D9E75',
  location: '#E67E22',
  organization: '#9B59B6',
  date: '#3498DB',
}

export default function KnowledgeGraph({ nodes, edges, width = 400, height = 300 }) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!nodes?.length) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const nodeById = new Map(nodes.map((n) => [n.id, { ...n }]))
    const links = (edges || [])
      .map((e) => ({
        ...e,
        source: nodeById.get(e.source) || e.source,
        target: nodeById.get(e.target) || e.target,
      }))
      .filter((l) => l.source && l.target && typeof l.source === 'object' && typeof l.target === 'object')

    const simNodes = Array.from(nodeById.values())
    const simulation = d3
      .forceSimulation(simNodes)
      .force(
        'link',
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance(80),
      )
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(24))

    const link = svg
      .append('g')
      .attr('stroke', '#444')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', 1)

    const linkLabel = svg
      .append('g')
      .selectAll('text')
      .data(links)
      .join('text')
      .attr('font-size', 8)
      .attr('fill', '#888')
      .attr('text-anchor', 'middle')
      .text((d) => d.relationship || '')

    const node = svg
      .append('g')
      .selectAll('circle')
      .data(simNodes)
      .join('circle')
      .attr('r', 16)
      .attr('fill', (d) => (TYPE_COLORS[d.type] || '#888') + 'cc')
      .attr('stroke', (d) => TYPE_COLORS[d.type] || '#888')
      .attr('stroke-width', 1.5)
      .call(
        d3
          .drag()
          .on('start', (ev, d) => {
            if (!ev.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on('drag', (ev, d) => {
            d.fx = ev.x
            d.fy = ev.y
          })
          .on('end', (ev, d) => {
            if (!ev.active) simulation.alphaTarget(0)
            d.fx = null
            d.fy = null
          }),
      )

    const label = svg
      .append('g')
      .selectAll('text')
      .data(simNodes)
      .join('text')
      .attr('font-size', 9)
      .attr('fill', '#ccc')
      .attr('text-anchor', 'middle')
      .text((d) => {
        const s = d.label || d.id || ''
        return s.length > 12 ? `${s.slice(0, 11)}…` : s
      })

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y)
      linkLabel
        .attr('x', (d) => (d.source.x + d.target.x) / 2)
        .attr('y', (d) => (d.source.y + d.target.y) / 2 - 4)
      node.attr('cx', (d) => d.x).attr('cy', (d) => d.y)
      label.attr('x', (d) => d.x).attr('y', (d) => d.y + 28)
    })

    return () => simulation.stop()
  }, [nodes, edges, width, height])

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{ background: '#0d0d0d', borderRadius: 8, width: '100%', maxHeight: height }}
    />
  )
}
