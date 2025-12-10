import { useEffect, useRef } from 'react'
import '../App.css'

interface ConfettiProps {
  active: boolean
  duration?: number
}

interface ConfettiParticle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  rotation: number
  rotationSpeed: number
}

function Confetti({ active, duration = 3000 }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | undefined>(undefined)
  const particlesRef = useRef<ConfettiParticle[]>([])
  const startTimeRef = useRef<number>(0)

  const colors = ['#e53935', '#ffeb3b', '#4caf50', '#2196f3', '#ff9800', '#9c27b0', '#00bcd4']

  useEffect(() => {
    if (!active) {
      particlesRef.current = []
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Create particles
    const particleCount = 150
    particlesRef.current = []
    startTimeRef.current = Date.now()

    for (let i = 0; i < particleCount; i++) {
      particlesRef.current.push({
        x: Math.random() * canvas.width,
        y: -10 - Math.random() * 100, // Start above viewport
        vx: (Math.random() - 0.5) * 2,
        vy: 2 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 8 + Math.random() * 6,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
      })
    }

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current
      if (elapsed > duration) {
        particlesRef.current = []
        return
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particlesRef.current = particlesRef.current.filter((particle) => {
        // Update position
        particle.x += particle.vx
        particle.y += particle.vy
        particle.rotation += particle.rotationSpeed

        // Add gravity
        particle.vy += 0.1

        // Draw particle
        ctx.save()
        ctx.translate(particle.x, particle.y)
        ctx.rotate(particle.rotation)
        ctx.fillStyle = particle.color
        ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size)
        ctx.restore()

        // Keep particles that are still on screen
        return particle.y < canvas.height + 50 && particle.x > -50 && particle.x < canvas.width + 50
      })

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [active, duration])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      className="confetti-canvas"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10001,
      }}
    />
  )
}

export default Confetti

