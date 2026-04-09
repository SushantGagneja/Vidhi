/**
 * MediaPipe FaceMesh — landmarks + AU proxies for overlay and scoring.
 */
let faceMesh = null
let camera = null
export let lastAUs = { AU6: 1.0, AU12: 1.0, brow: 0.0, EAR: 0.3 }
export let lastLandmarks = null

/** Face oval connections (subset) for wireframe — indices from MediaPipe FaceMesh */
const OVAL = [
  [10, 338], [338, 297], [297, 332], [332, 284], [284, 251], [251, 389], [389, 356], [356, 454],
  [454, 323], [323, 361], [361, 288], [288, 397], [397, 365], [365, 379], [379, 378], [378, 400],
  [400, 377], [377, 152], [152, 148], [148, 176], [176, 149], [149, 150], [150, 136], [136, 172],
  [172, 58], [58, 132], [132, 93], [93, 234], [234, 127], [127, 162], [162, 21], [21, 54], [54, 103],
  [103, 67], [67, 109], [109, 10],
]

export async function initFaceMesh(videoElement, onFrame) {
  const faceMeshMod = await import(
    /* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js'
  )
  const camMod = await import(
    /* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js'
  )
  const FaceMesh = faceMeshMod.FaceMesh
  const Camera = camMod.Camera

  faceMesh = new FaceMesh({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  })

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  })

  faceMesh.onResults((results) => {
    if (!results.multiFaceLandmarks?.[0]) {
      lastLandmarks = null
      onFrame?.({ aus: lastAUs, landmarks: null })
      return
    }
    const lm = results.multiFaceLandmarks[0]
    lastLandmarks = lm
    const aus = computeAUs(lm)
    lastAUs = aus
    onFrame?.({ aus, landmarks: lm })
  })

  camera = new Camera(videoElement, {
    onFrame: async () => {
      await faceMesh.send({ image: videoElement })
    },
    width: 640,
    height: 480,
  })
  camera.start()
  return () => {
    try {
      camera?.stop?.()
    } catch {
      /* ignore */
    }
    faceMesh?.close?.()
    faceMesh = null
    camera = null
    lastLandmarks = null
  }
}

function computeAUs(lm) {
  const AU6 = Math.abs(lm[116].y - lm[50].y) * 10
  const AU12 = Math.abs(lm[61].x - lm[291].x) * 8
  const browDist = Math.abs(lm[107].x - lm[336].x)
  const brow = Math.max(0, 0.08 - browDist) * 40
  const eyeH = Math.abs(lm[159].y - lm[145].y)
  const eyeW = Math.abs(lm[133].x - lm[33].x)
  const EAR = eyeH / (eyeW + 0.001)
  return { AU6, AU12, brow, EAR }
}

export function computeFaceStressScore(aus) {
  const score =
    (1 - Math.min(aus.AU6, 1)) * 0.3 +
    (1 - Math.min(aus.AU12, 1)) * 0.3 +
    Math.min(aus.brow, 1) * 0.25 +
    (1 - Math.min(aus.EAR / 0.3, 1)) * 0.15
  return Math.min(Math.max(score, 0), 1)
}

export function drawFaceMeshOverlay(ctx, landmarks, video, options = {}) {
  if (!landmarks || !video?.videoWidth) return
  const { width, height } = ctx.canvas
  const vw = video.videoWidth
  const vh = video.videoHeight
  const scale = Math.min(width / vw, height / vh)
  const ox = (width - vw * scale) / 2
  const oy = (height - vh * scale) / 2

  const proj = (p) => ({
    x: p.x * vw * scale + ox,
    y: p.y * vh * scale + oy,
  })

  ctx.save()
  ctx.strokeStyle = options.meshColor || 'rgba(0, 255, 200, 0.45)'
  ctx.lineWidth = 1.25
  ctx.shadowColor = 'rgba(0, 255, 220, 0.6)'
  ctx.shadowBlur = 6
  for (const [a, b] of OVAL) {
    const pa = proj(landmarks[a])
    const pb = proj(landmarks[b])
    ctx.beginPath()
    ctx.moveTo(pa.x, pa.y)
    ctx.lineTo(pb.x, pb.y)
    ctx.stroke()
  }
  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(0, 240, 200, 0.35)'
  for (let i = 0; i < landmarks.length; i += 6) {
    const p = proj(landmarks[i])
    ctx.beginPath()
    ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** Forehead anchor for HUD (approx) */
export function foreheadScreenPoint(landmarks, video, canvas) {
  if (!landmarks?.[10] || !video?.videoWidth) return null
  const { width, height } = canvas
  const vw = video.videoWidth
  const vh = video.videoHeight
  const scale = Math.min(width / vw, height / vh)
  const ox = (width - vw * scale) / 2
  const oy = (height - vh * scale) / 2
  const p = landmarks[10]
  return {
    x: p.x * vw * scale + ox,
    y: p.y * vh * scale + oy - 28,
  }
}
