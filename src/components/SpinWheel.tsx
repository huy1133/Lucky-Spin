import { useEffect, useRef, useState } from 'react'
import '../App.css'
import { ref, onValue } from 'firebase/database'
import { db } from '../firebase'

function SpinWheel() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [luckyNumbers, setLuckyNumbers] = useState<string[]>([])
  const [isSpinning, setIsSpinning] = useState<boolean>(false)
  const rotationRef = useRef<number>(0)
  const animationFrameRef = useRef<number | undefined>(undefined)

  // Load lucky numbers from Firebase
  useEffect(() => {
    if (!db) return

    const registrationRef = ref(db, 'registration')
    
    const unsubscribe = onValue(registrationRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        const numbers = Object.keys(data).sort((a, b) => parseInt(a) - parseInt(b))
        setLuckyNumbers(numbers)
      } else {
        setLuckyNumbers([])
      }
    })

    return () => unsubscribe()
  }, [])

  // Draw wheel and lights
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || luckyNumbers.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const size = Math.min(window.innerHeight * 0.6, window.innerWidth * 0.5)
    canvas.width = size
    canvas.height = size
    const centerX = size / 2
    const centerY = size / 2
    const radius = size / 2 - 40
    const lightRadius = radius + 20

    const drawWheel = (rotation: number = 0, spinning: boolean = false) => {
      ctx.clearRect(0, 0, size, size)

      // Add empty segment if count is odd to maintain color alternation
      const displayNumbers = luckyNumbers.length % 2 === 1 
        ? [...luckyNumbers, ''] 
        : luckyNumbers
      const segmentCount = displayNumbers.length || 1
      const anglePerSegment = (2 * Math.PI) / segmentCount

      // Draw wheel segments
      for (let i = 0; i < segmentCount; i++) {
        const startAngle = i * anglePerSegment + rotation
        const endAngle = (i + 1) * anglePerSegment + rotation

        ctx.beginPath()
        ctx.moveTo(centerX, centerY)
        ctx.arc(centerX, centerY, radius, startAngle, endAngle)
        ctx.closePath()

        // Alternate colors: white and red
        ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#e53935'
        ctx.fill()

        // Draw lucky number text (only if not empty)
        if (displayNumbers[i]) {
          const textAngle = startAngle + anglePerSegment / 2
          const textX = centerX + Math.cos(textAngle) * (radius * 0.7)
          const textY = centerY + Math.sin(textAngle) * (radius * 0.7)

          ctx.save()
          ctx.translate(textX, textY)
          ctx.rotate(textAngle + Math.PI / 2)
          ctx.fillStyle = i % 2 === 0 ? '#e53935' : '#ffffff'
          ctx.font = `bold ${Math.max(16, Math.min(24, radius / 8))}px Arial`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(displayNumbers[i], 0, 0)
          ctx.restore()
        }
      }

      // Draw center circle
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius * 0.15, 0, 2 * Math.PI)
      ctx.fillStyle = '#e53935'
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3
      ctx.stroke()

      // Draw blinking lights around the wheel - yellow like electric bulb
      const lightCount = 24
      const lightAngleStep = (2 * Math.PI) / lightCount
      // Blinking speed: slow when not spinning (200ms), fast when spinning (50ms)
      const blinkSpeed = spinning ? 50 : 200
      const time = Date.now() / blinkSpeed

      for (let i = 0; i < lightCount; i++) {
        const lightAngle = i * lightAngleStep
        const lightX = centerX + Math.cos(lightAngle) * lightRadius
        const lightY = centerY + Math.sin(lightAngle) * lightRadius

        // Blinking effect - yellow light like electric bulb
        const blink = Math.sin(time + i * 0.5) * 0.5 + 0.5
        const alpha = blink * 0.8 + 0.2

        ctx.beginPath()
        ctx.arc(lightX, lightY, 8, 0, 2 * Math.PI)
        ctx.fillStyle = '#ffeb3b' // Bright yellow like electric bulb
        ctx.globalAlpha = alpha
        ctx.fill()
        
        // Glow effect
        ctx.beginPath()
        ctx.arc(lightX, lightY, 12, 0, 2 * Math.PI)
        ctx.fillStyle = '#ffeb3b'
        ctx.globalAlpha = alpha * 0.3
        ctx.fill()
        ctx.globalAlpha = 1
      }

      // Draw pointer at top
      ctx.beginPath()
      ctx.moveTo(centerX, centerY - radius - 30)
      ctx.lineTo(centerX - 15, centerY - radius - 10)
      ctx.lineTo(centerX + 15, centerY - radius - 10)
      ctx.closePath()
      ctx.fillStyle = '#ffd700'
      ctx.fill()
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 2
      ctx.stroke()
    }

    // Animation loop for continuous drawing (for blinking lights)
    const animate = () => {
      drawWheel(rotationRef.current, isSpinning)
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [luckyNumbers, isSpinning])

  const handleSpin = () => {
    if (luckyNumbers.length === 0 || isSpinning) return
    
    setIsSpinning(true)
    
    // Random spin: 5-10 full rotations + random angle (clockwise = negative)
    const spins = 5 + Math.random() * 5
    const finalRotation = rotationRef.current - (spins * 2 * Math.PI + Math.random() * 2 * Math.PI)
    
    // Animate to final position
    const startRotation = rotationRef.current
    const duration = 3000 // 3 seconds
    const startTime = Date.now()

      const animateSpin = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      
      rotationRef.current = startRotation + (finalRotation - startRotation) * easeOut
      
      const canvas = canvasRef.current
      if (!canvas) return
      
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      const size = canvas.width
      const centerX = size / 2
      const centerY = size / 2
      const radius = size / 2 - 40

      // Add empty segment if count is odd to maintain color alternation
      const displayNumbers = luckyNumbers.length % 2 === 1 
        ? [...luckyNumbers, ''] 
        : luckyNumbers
      const segmentCount = displayNumbers.length || 1
      const anglePerSegment = (2 * Math.PI) / segmentCount

      ctx.clearRect(0, 0, size, size)

      // Draw wheel segments
      for (let i = 0; i < segmentCount; i++) {
        const startAngle = i * anglePerSegment + rotationRef.current
        const endAngle = (i + 1) * anglePerSegment + rotationRef.current

        ctx.beginPath()
        ctx.moveTo(centerX, centerY)
        ctx.arc(centerX, centerY, radius, startAngle, endAngle)
        ctx.closePath()

        ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#e53935'
        ctx.fill()

        // Draw text only if not empty
        if (displayNumbers[i]) {
          const textAngle = startAngle + anglePerSegment / 2
          const textX = centerX + Math.cos(textAngle) * (radius * 0.7)
          const textY = centerY + Math.sin(textAngle) * (radius * 0.7)

          ctx.save()
          ctx.translate(textX, textY)
          ctx.rotate(textAngle + Math.PI / 2)
          ctx.fillStyle = i % 2 === 0 ? '#e53935' : '#ffffff'
          ctx.font = `bold ${Math.max(16, Math.min(24, radius / 8))}px Arial`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(displayNumbers[i], 0, 0)
          ctx.restore()
        }
      }

      // Center circle
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius * 0.15, 0, 2 * Math.PI)
      ctx.fillStyle = '#e53935'
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3
      ctx.stroke()

      // Blinking lights - yellow like electric bulb (fast when spinning)
      const lightCount = 24
      const lightAngleStep = (2 * Math.PI) / lightCount
      const lightRadius = radius + 20
      const blinkSpeed = 50 // Fast blinking when spinning
      const time = Date.now() / blinkSpeed

      for (let i = 0; i < lightCount; i++) {
        const lightAngle = i * lightAngleStep
        const lightX = centerX + Math.cos(lightAngle) * lightRadius
        const lightY = centerY + Math.sin(lightAngle) * lightRadius

        const blink = Math.sin(time + i * 0.5) * 0.5 + 0.5
        const alpha = blink * 0.8 + 0.2

        ctx.beginPath()
        ctx.arc(lightX, lightY, 8, 0, 2 * Math.PI)
        ctx.fillStyle = '#ffeb3b' // Bright yellow like electric bulb
        ctx.globalAlpha = alpha
        ctx.fill()
        
        ctx.beginPath()
        ctx.arc(lightX, lightY, 12, 0, 2 * Math.PI)
        ctx.fillStyle = '#ffeb3b'
        ctx.globalAlpha = alpha * 0.3
        ctx.fill()
        ctx.globalAlpha = 1
      }

      // Pointer
      ctx.beginPath()
      ctx.moveTo(centerX, centerY - radius - 30)
      ctx.lineTo(centerX - 15, centerY - radius - 10)
      ctx.lineTo(centerX + 15, centerY - radius - 10)
      ctx.closePath()
      ctx.fillStyle = '#ffd700'
      ctx.fill()
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 2
      ctx.stroke()

      if (progress < 1) {
        requestAnimationFrame(animateSpin)
      } else {
        setIsSpinning(false)
      }
    }

    animateSpin()
  }

  return (
    <div className="spin-wheel-section">
      <div className="spin-wheel-container">
        <canvas ref={canvasRef} className="spin-wheel-canvas" />
        {luckyNumbers.length > 0 && (
          <button
            className="spin-button"
            onClick={handleSpin}
            disabled={isSpinning}
          >
            {isSpinning ? 'Đang quay...' : 'Quay số may mắn'}
          </button>
        )}
        {luckyNumbers.length === 0 && (
          <div className="spin-wheel-empty">Chưa có số may mắn để quay</div>
        )}
      </div>
    </div>
  )
}

export default SpinWheel
