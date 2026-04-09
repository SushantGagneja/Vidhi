import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

/** Per-event modality bars + possibility marker */
export default function EventPossibilityChart({ events, width = 560, height = 220 }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!events?.length) return
    const el = ref.current
    if (!el) return
    const svg = d3.select(el)
    svg.selectAll('*').remove()

    const margin = { top: 22, right: 16, bottom: 28, left: 36 }
    const w = width - margin.left - margin.right
    const h = height - margin.top - margin.bottom
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const keys = ['voice', 'words', 'facial']
    const color = d3.scaleOrdinal().domain(keys).range(['#1d9e75', '#3498db', '#e67e22'])

    const x0 = d3
      .scaleBand()
      .domain(events.map((d) => d.id))
      .rangeRound([0, w])
      .paddingInner(0.22)

    const x1 = d3.scaleBand().domain(keys).rangeRound([0, x0.bandwidth()]).padding(0.12)

    const y = d3.scaleLinear().domain([0, 1]).nice().rangeRound([h, 0])

    const rows = []
    events.forEach((ev) => {
      keys.forEach((key) => {
        rows.push({ ev, key, val: Number(ev[key] ?? 0) })
      })
    })

    g.append('g')
      .attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(x0).tickFormat((d) => (String(d).length > 5 ? `${String(d).slice(0, 4)}…` : d)))
      .selectAll('text')
      .attr('fill', '#888')
      .attr('font-size', 9)

    g.append('g')
      .call(d3.axisLeft(y).ticks(4).tickFormat((d) => `${(Number(d) * 100).toFixed(0)}%`))
      .selectAll('text')
      .attr('fill', '#666')
      .attr('font-size', 9)
    g.selectAll('.domain, .tick line').attr('stroke', '#333')

    g.selectAll('rect.mod')
      .data(rows)
      .join('rect')
      .attr('class', 'mod')
      .attr('x', (d) => x0(d.ev.id) + x1(d.key))
      .attr('y', (d) => y(d.val))
      .attr('width', x1.bandwidth())
      .attr('height', (d) => h - y(d.val))
      .attr('fill', (d) => color(d.key))
      .attr('rx', 3)
      .attr('opacity', 0.9)

    g.selectAll('circle.p')
      .data(events)
      .join('circle')
      .attr('class', 'p')
      .attr('cx', (d) => x0(d.id) + x0.bandwidth() / 2)
      .attr('cy', (d) => y(Number(d.possibility ?? 0)) - 5)
      .attr('r', 5)
      .attr('fill', '#e056fd')
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.8)

    svg
      .append('text')
      .attr('x', margin.left)
      .attr('y', 14)
      .attr('fill', '#aaa')
      .attr('font-size', 11)
      .text('Per-event modalities · magenta = P')
  }, [events, width, height])

  return <svg ref={ref} width={width} height={height} style={{ maxWidth: '100%' }} />
}
