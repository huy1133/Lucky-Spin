import { useEffect, useRef } from 'react'
import '../App.css'

interface Node {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
}

function AnimatedNodeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesRef = useRef<Node[]>([])
  const animationFrameRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Get scale multiplier for large screens (width > 3000px)
    const getScaleMultiplier = () => {
      return window.innerWidth > 3000 ? 5 : 1
    }

    const getDensityMultiplier = () => {
      return window.innerWidth > 3000 ? 20 : 1
    }

    const getDistanceMultiplier = () => {
      return window.innerWidth > 3000 ? 4 : 1
    }

    // Calculate node count based on screen size
    // Density: approximately 1 node per 8000 pixels (adjustable)
    const calculateNodeCount = (width: number, height: number): number => {
      const area = width * height
      const density = 8000 * getDensityMultiplier() // pixels per node
      const nodeCount = Math.floor(area / density)
      // Set min and max limits for performance
      return Math.max(30, Math.min(150, nodeCount))
    }

    // Set canvas size
    const resizeCanvas = () => {
      const oldWidth = canvas.width
      const oldHeight = canvas.height
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      
      // Adjust node positions when resizing
      if (oldWidth > 0 && oldHeight > 0) {
        const scaleX = canvas.width / oldWidth
        const scaleY = canvas.height / oldHeight
        nodesRef.current.forEach((node) => {
          node.x *= scaleX
          node.y *= scaleY
          // Keep nodes in bounds
          node.x = Math.max(0, Math.min(canvas.width, node.x))
          node.y = Math.max(0, Math.min(canvas.height, node.y))
        })
      }
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Create nodes based on screen size
    const nodeCount = calculateNodeCount(canvas.width, canvas.height)
    const nodes: Node[] = []
    const scaleMultiplier = getScaleMultiplier()
    
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5 * scaleMultiplier,
        vy: (Math.random() - 0.5) * 0.5 * scaleMultiplier,
        radius: (Math.random() * 2 + 1) * scaleMultiplier,
      })
    }
    nodesRef.current = nodes

    // Animation loop
    const animate = () => {
      if (!ctx || !canvas) return
      
      // Clear canvas completely to maintain consistent background color
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const nodes = nodesRef.current

      // Update and draw nodes
      nodes.forEach((node) => {
        // Update position
        node.x += node.vx
        node.y += node.vy

        // Bounce off edges
        if (node.x < 0 || node.x > canvas.width) node.vx *= -1
        if (node.y < 0 || node.y > canvas.height) node.vy *= -1

        // Keep nodes in bounds
        node.x = Math.max(0, Math.min(canvas.width, node.x))
        node.y = Math.max(0, Math.min(canvas.height, node.y))

        // Draw node
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
        ctx.fill()

        // Draw glow effect
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius * 2, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
        ctx.fill()
      })

      // Draw connections between nearby nodes
      const scaleMultiplier = getScaleMultiplier()
      const maxDistance = 150 * getDistanceMultiplier();
      nodes.forEach((node, i) => {
        nodes.slice(i + 1).forEach((otherNode) => {
          const dx = node.x - otherNode.x
          const dy = node.y - otherNode.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < maxDistance) {
            const opacity = 1 - distance / maxDistance
            ctx.beginPath()
            ctx.moveTo(node.x, node.y)
            ctx.lineTo(otherNode.x, otherNode.y)
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.5})`
            ctx.lineWidth = 0.7 * scaleMultiplier
            ctx.stroke()
          }
        })
      })

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="animated-node-background"
    />
  )
}

export default AnimatedNodeBackground
