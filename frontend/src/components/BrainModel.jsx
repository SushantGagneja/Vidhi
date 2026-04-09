import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const STRESS_COLORS = {
  Calm: 0x2ecc71,
  Moderate: 0xf39c12,
  'High Distress': 0xe74c3c,
  Withdrawn: 0x9b59b6,
}

export default function BrainModel({ stressLevel, activations }) {
  const mountRef = useRef(null)
  const sceneRef = useRef({})

  useEffect(() => {
    const el = mountRef.current
    if (!el) return
    const W = el.clientWidth || 320
    const H = 220

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(W, H)
    renderer.setClearColor(0x000000, 0)
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100)
    camera.position.set(0, 0, 3.5)

    const light1 = new THREE.DirectionalLight(0xffffff, 0.8)
    light1.position.set(1, 1, 1)
    scene.add(light1)
    scene.add(new THREE.AmbientLight(0x404040, 0.6))

    const brainGeo = new THREE.SphereGeometry(1, 32, 32)
    brainGeo.scale(1.2, 0.9, 0.85)
    const brainMat = new THREE.MeshPhongMaterial({
      color: 0x1a1a2e,
      transparent: true,
      opacity: 0.7,
    })
    const brain = new THREE.Mesh(brainGeo, brainMat)
    scene.add(brain)

    const sulcusMat = new THREE.LineBasicMaterial({ color: 0x2a2a4a })
    for (let i = 0; i < 6; i++) {
      const pts = []
      for (let t = 0; t < 20; t++) {
        const angle = (t / 20) * Math.PI - Math.PI / 2
        pts.push(
          new THREE.Vector3(
            Math.cos(angle) * (0.8 + Math.sin(i * 1.3) * 0.15),
            Math.sin(angle) * 0.7 + (i - 3) * 0.15,
            0.82,
          ),
        )
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      scene.add(new THREE.Line(geo, sulcusMat))
    }

    const hotspotData = [
      { pos: [-0.3, -0.2, 0.5], label: 'amygdala' },
      { pos: [0, 0.4, 0.6], label: 'ACC' },
      { pos: [0.5, 0, 0.4], label: 'insula' },
    ]

    const hotspots = hotspotData.map((h) => {
      const geo = new THREE.SphereGeometry(0.14, 16, 16)
      const mat = new THREE.MeshPhongMaterial({
        color: 0x2ecc71,
        transparent: true,
        opacity: 0.8,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(...h.pos)
      scene.add(mesh)
      return { mesh, mat }
    })

    sceneRef.current = { renderer, scene, camera, brain, hotspots }

    let t = 0
    const animate = () => {
      t += 0.012
      brain.rotation.y = Math.sin(t * 0.3) * 0.3
      hotspots.forEach((h, i) => {
        const pulse = 0.6 + 0.4 * Math.sin(t + i * 1.4)
        const act = activations?.[i] ?? 0.2
        h.mat.opacity = 0.4 + 0.5 * pulse * act
        const s = 1 + 0.2 * pulse * act
        h.mesh.scale.setScalar(s)
      })
      renderer.render(scene, camera)
      sceneRef.current.raf = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(sceneRef.current.raf)
      el.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  useEffect(() => {
    const { hotspots } = sceneRef.current
    if (!hotspots) return
    const color = STRESS_COLORS[stressLevel] ?? 0x2ecc71
    hotspots.forEach((h) => h.mat.color.setHex(color))
  }, [stressLevel])

  return (
    <div
      ref={mountRef}
      style={{ width: '100%', height: 220, borderRadius: 8, background: 'linear-gradient(180deg,#0d0d14,#12121a)' }}
    />
  )
}
