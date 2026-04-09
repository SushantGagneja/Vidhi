import { forwardRef, useEffect, useRef } from 'react'
import { drawFaceMeshOverlay, foreheadScreenPoint } from '../services/facemesh.js'

/**
 * Video + canvas wireframe overlay + floating score HUD at forehead.
 * Video ref forwarded for MediaPipe Camera + getUserMedia.
 */
const FaceMeshViewport = forwardRef(function FaceMeshViewport({ landmarksRef, scoresRef, ausRef, active }, videoRef) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    const video = videoRef?.current
    const wrap = wrapRef.current
    if (!canvas || !video || !wrap) return

    let raf
    const tick = () => {
      const lm = landmarksRef?.current
      const w = wrap.clientWidth
      const h = Math.round((w * 3) / 4)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, w, h)
      if (lm && video.readyState >= 2) {
        drawFaceMeshOverlay(ctx, lm, video, { meshColor: 'rgba(255, 255, 255, 0.45)' })
        const pt = foreheadScreenPoint(lm, video, canvas)
        const scores = scoresRef?.current
        const aus = ausRef?.current
        if (pt && scores) {
          const t = performance.now() * 0.001
          const { voice = 0, words = 0, face = 0, possibility: p = 0 } = scores
          const au6 = Number(aus?.AU6 || 0)
          const brow = Number(aus?.brow || 0)
          const ear = Number(aus?.EAR || 0)
          const jaw = Number(aus?.AU12 || 0)
          const lines = [
            `TRIBE·voice ${(voice * 100).toFixed(0)}%`,
            `NLP·words ${(words * 100).toFixed(0)}%`,
            `Face·mesh ${(face * 100).toFixed(0)}%`,
            `P ${(p * 100).toFixed(0)}%`,
          ]
          ctx.save()
          const bw = 176
          const bh = 72
          let x = pt.x - bw / 2
          let y = pt.y - bh - 8
          x = Math.max(8, Math.min(x, w - bw - 8))
          y = Math.max(8, y)
          const grd = ctx.createLinearGradient(x, y, x + bw, y + bh)
          grd.addColorStop(0, 'rgba(8, 8, 8, 0.92)')
          grd.addColorStop(1, 'rgba(22, 22, 22, 0.92)')
          ctx.fillStyle = grd
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, y, bw, bh, 10)
          } else {
            ctx.rect(x, y, bw, bh)
          }
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = '#f2f2f2'
          ctx.font = '600 10px JetBrains Mono, monospace'
          lines.forEach((line, i) => {
            ctx.fillText(line, x + 10, y + 16 + i * 14)
          })
          ctx.shadowColor = 'rgba(255,255,255,0.35)'
          ctx.shadowBlur = 12
          ctx.strokeStyle = 'rgba(255,255,255,0.25)'
          ctx.beginPath()
          ctx.moveTo(pt.x, pt.y + 24)
          ctx.lineTo(x + bw / 2, y + bh)
          ctx.stroke()

          const labels = [
            { k: 61, txt: `AU6 ${au6.toFixed(2)}`, val: au6 },
            { k: 10, txt: `BROW ${brow.toFixed(2)}`, val: brow },
            { k: 159, txt: `EYE ${ear.toFixed(2)}`, val: ear },
            { k: 291, txt: `JAW ${jaw.toFixed(2)}`, val: jaw },
          ]
          labels.forEach((l, i) => {
            const p0 = lm[l.k]
            if (!p0) return
            const lx = p0.x * video.videoWidth * (Math.min(w / video.videoWidth, h / video.videoHeight)) + (w - video.videoWidth * Math.min(w / video.videoWidth, h / video.videoHeight)) / 2
            const ly = p0.y * video.videoHeight * (Math.min(w / video.videoWidth, h / video.videoHeight)) + (h - video.videoHeight * Math.min(w / video.videoWidth, h / video.videoHeight)) / 2
            const wob = Math.sin(t * 2.2 + i) * 4
            drawFloatingLabel(ctx, lx + 9, ly - 11 + wob, l.txt, l.val)
          })
          ctx.restore()
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, videoRef, landmarksRef, scoresRef, ausRef])

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 480,
        borderRadius: 3,
        overflow: 'hidden',
        background: '#050508',
        border: '1px solid var(--border)',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.5), inset 0 0 40px rgba(255,255,255,0.04)',
      }}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        style={{
          display: 'block',
          width: '100%',
          aspectRatio: '4/3',
          objectFit: 'cover',
          transform: 'scaleX(-1)',
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          transform: 'scaleX(-1)',
        }}
      />
      {!active && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)',
            color: 'var(--muted)',
            fontSize: '0.85rem',
          }}
        >
          Enable camera for live mesh + score HUD
        </div>
      )}
    </div>
  )
})

export default FaceMeshViewport

function drawFloatingLabel(ctx, x, y, text, val) {
  const w = Math.max(62, 8 + text.length * 6)
  const h = 16
  const sev = Math.max(0, Math.min(1, val))
  const c = sev > 0.66 ? 'rgba(255,255,255,0.96)' : sev > 0.4 ? 'rgba(216,216,216,0.95)' : 'rgba(170,170,170,0.95)'
  ctx.save()
  ctx.fillStyle = 'rgba(7,13,18,0.85)'
  ctx.strokeStyle = c
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = c
  ctx.font = '600 9px JetBrains Mono, monospace'
  ctx.fillText(text, x + 4, y + 11)
  ctx.restore()
}
