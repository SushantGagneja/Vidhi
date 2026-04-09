import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const STRESS_HEX = {
  Calm: 0x1d9e75,
  Moderate: 0xf39c12,
  'High Distress': 0xe74c3c,
  Withdrawn: 0x9b59b6,
}

const brainVertexShader = `
varying vec3 vNormal;
varying vec3 vPosition;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const brainFragmentShader = `
uniform float uTime;
uniform float uStimulus;
uniform vec3 uAccent;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  float waves = sin(vPosition.y * 14.0 - uTime * 3.2) * 0.5 + 0.5;
  float scan = sin(vPosition.x * 10.0 + vPosition.z * 8.0 + uTime * 2.4) * 0.5 + 0.5;
  vec3 teal = vec3(0.08, 0.92, 0.62);
  vec3 magenta = vec3(0.95, 0.15, 0.72);
  vec3 pulse = mix(teal, magenta, waves * uStimulus);
  vec3 base = vec3(0.05, 0.06, 0.12);
  vec3 color = mix(base, pulse, (0.35 + 0.65 * uStimulus) * (0.4 + 0.6 * scan));
  color = mix(color, uAccent / 255.0, 0.22 * uStimulus);
  float fresnel = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.5);
  color += fresnel * vec3(0.35, 0.55, 1.0) * (0.35 + uStimulus);
  gl_FragColor = vec4(color, 0.88);
}
`

const glowVertexShader = `
varying vec3 vPos;
void main() {
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const glowFragmentShader = `
uniform float uTime;
uniform float uIntensity;
uniform vec3 uColor;
varying vec3 vPos;
void main() {
  float r = length(vPos);
  float a = smoothstep(0.35, 0.0, r) * (0.45 + 0.55 * sin(uTime * 3.0 + r * 6.0));
  gl_FragColor = vec4(uColor, a * uIntensity * 0.75);
}
`

export default function BrainStimulus({ stressLevel, stimulus01, activations }) {
  const mountRef = useRef(null)
  const refs = useRef({ targetStim: 0.45 })

  const stim = Math.max(0.15, Math.min(1, stimulus01 ?? 0.45))
  refs.current.targetStim = stim

  useEffect(() => {
    const el = mountRef.current
    if (!el) return
    const W = el.clientWidth || 400
    const H = 280

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W, H)
    renderer.setClearColor(0x000000, 0)
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(48, W / H, 0.1, 100)
    camera.position.set(0, 0, 3.6)

    scene.add(new THREE.AmbientLight(0x404060, 0.5))
    const dir = new THREE.DirectionalLight(0xffffff, 0.35)
    dir.position.set(2, 2, 3)
    scene.add(dir)

    const brainGeo = new THREE.SphereGeometry(1, 48, 48)
    brainGeo.scale(1.22, 0.92, 0.86)
    const accent = new THREE.Color(STRESS_HEX[stressLevel] ?? STRESS_HEX.Moderate)
    const brainMat = new THREE.ShaderMaterial({
      vertexShader: brainVertexShader,
      fragmentShader: brainFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uStimulus: { value: stim },
        uAccent: { value: new THREE.Vector3(accent.r * 255, accent.g * 255, accent.b * 255) },
      },
      transparent: true,
    })
    const brain = new THREE.Mesh(brainGeo, brainMat)
    scene.add(brain)

    const wireGeo = new THREE.SphereGeometry(1.02, 32, 32)
    wireGeo.scale(1.22, 0.92, 0.86)
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x1a3a35,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
    })
    const wire = new THREE.Mesh(wireGeo, wireMat)
    scene.add(wire)

    const hotspotData = [
      { pos: [-0.32, -0.18, 0.52], label: 'amygdala' },
      { pos: [0.02, 0.42, 0.58], label: 'ACC' },
      { pos: [0.48, 0.02, 0.42], label: 'insula' },
    ]

    const hotspots = hotspotData.map((h, i) => {
      const glowGeo = new THREE.SphereGeometry(0.22, 24, 24)
      const glowMat = new THREE.ShaderMaterial({
        vertexShader: glowVertexShader,
        fragmentShader: glowFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uIntensity: { value: 0.5 },
          uColor: { value: new THREE.Vector3(0.2, 0.95, 0.75) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const mesh = new THREE.Mesh(glowGeo, glowMat)
      mesh.position.set(...h.pos)
      scene.add(mesh)
      const coreGeo = new THREE.SphereGeometry(0.1, 16, 16)
      const coreMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.85 })
      const core = new THREE.Mesh(coreGeo, coreMat)
      core.position.set(...h.pos)
      scene.add(core)
      return { mesh, mat: glowMat, core, coreMat, i }
    })

    refs.current = { renderer, scene, camera, brain, brainMat, wire, hotspots }

    let t = 0
    const animate = () => {
      t += 0.016
      brainMat.uniforms.uTime.value = t
      const tgt = refs.current.targetStim ?? stim
      brainMat.uniforms.uStimulus.value = THREE.MathUtils.lerp(
        brainMat.uniforms.uStimulus.value,
        tgt,
        0.06,
      )
      brain.rotation.y = Math.sin(t * 0.35) * 0.28
      wire.rotation.copy(brain.rotation)

      hotspots.forEach((h, i) => {
        h.mat.uniforms.uTime.value = t
        const act = activations?.[i] ?? 0.25
        const pulse = 0.55 + 0.45 * Math.sin(t * 2.2 + i * 1.3)
        h.mat.uniforms.uIntensity.value = (0.35 + stim * 0.55) * act * pulse
        const s = 1 + 0.35 * pulse * act * stim
        h.mesh.scale.setScalar(s)
        h.core.scale.setScalar(0.85 + 0.25 * pulse * act)
      })

      renderer.render(scene, camera)
      refs.current.raf = requestAnimationFrame(animate)
    }
    animate()

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth || W
      const h = 280
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      cancelAnimationFrame(refs.current.raf)
      el.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  useEffect(() => {
    const { brainMat, hotspots } = refs.current
    if (!brainMat) return
    const accent = new THREE.Color(STRESS_HEX[stressLevel] ?? STRESS_HEX.Moderate)
    brainMat.uniforms.uAccent.value.set(accent.r * 255, accent.g * 255, accent.b * 255)
    if (hotspots) {
      hotspots.forEach((h) => {
        h.coreMat.color.setHex(STRESS_HEX[stressLevel] ?? 0x00ffcc)
      })
    }
  }, [stressLevel])

  return (
    <div
      ref={mountRef}
      style={{
        width: '100%',
        height: 280,
        borderRadius: 12,
        overflow: 'hidden',
        background: 'radial-gradient(ellipse 80% 70% at 50% 30%, #1a1030 0%, #0a0a10 55%, #050508 100%)',
        border: '1px solid rgba(29, 158, 117, 0.25)',
        boxShadow: '0 0 40px rgba(29, 158, 117, 0.08), inset 0 0 60px rgba(120, 60, 200, 0.06)',
      }}
    />
  )
}
