import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

const STRESS_FILL = {
  Calm: '#2ECC7188',
  Moderate: '#F39C1288',
  'High Distress': '#E74C3C88',
  Withdrawn: '#9B59B688',
}

const STRESS_STROKE = {
  Calm: '#2ECC71',
  Moderate: '#F39C12',
  'High Distress': '#E74C3C',
  Withdrawn: '#9B59B6',
}

export default function ConversationGraph({ graph, width = 400, height = 300 }) {
  const svgRef = useRef(null)
  const nodes = graph?.nodes || []
  const edges = graph?.edges || []

  useEffect(() => {
    if (!nodes.length) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const nodeById = new Map(nodes.map((n) => [n.id, { ...n }]))
    const links = edges
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
          .distance((d) => 40 + (1 - (d.weight || 0.5)) * 60),
      )
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(20))

    const link = svg
      .append('g')
      .attr('stroke', '#3a3a50')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', (d) => 0.5 + (d.weight || 0) * 2)

    const node = svg
      .append('g')
      .selectAll('circle')
      .data(simNodes)
      .join('circle')
      .attr('r', 14)
      .attr('fill', (d) => STRESS_FILL[d.stress_label] || STRESS_FILL.Moderate)
      .attr('stroke', (d) => STRESS_STROKE[d.stress_label] || STRESS_STROKE.Moderate)
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
      .attr('font-size', 7)
      .attr('fill', '#aaa')
      .attr('text-anchor', 'middle')
      .text((d) => d.id)

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y)
      node.attr('cx', (d) => d.x).attr('cy', (d) => d.y)
      label.attr('x', (d) => d.x).attr('y', (d) => d.y + 24)
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
