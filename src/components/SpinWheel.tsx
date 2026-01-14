import { useEffect, useRef, useState, useCallback } from 'react'
import '../App.css'
import { ref, onValue, get, set } from 'firebase/database'
import { db } from '../firebase'
import Confetti from './Confetti'

// Constants
const DEFAULT_SPIN_TURNS = 15
const BASE_SPEED_PER_TURN = 1000
const DECELERATION_TURNS = 2
const PRIZE_ORDER = ['consolation', 'third', 'second', 'first', 'special'] as const
const EMPTY_PRIZE_WINNERS = {
  special: [],
  first: [],
  second: [],
  third: [],
  consolation: []
}
const TWO_PI = 2 * Math.PI
const POINTER_ANGLE = (3 * Math.PI) / 2
const LOCK_PATH = new Path2D('M18,8h-1V6c0-2.76-2.24-5-5-5S7,3.24,7,6v2H6c-1.1,0-2,0.9-2,2v10c0,1.1,0.9,2,2,2h12c1.1,0,2-0.9,2-2V10C20,8.9,19.1,8,18,8z M12,17c-1.1,0-2-0.9-2-2s0.9-2,2-2s2,0.9,2,2S13.1,17,12,17z M15.1,8H8.9V6c0-1.71,1.39-3.1,3.1-3.1s3.1,1.39,3.1,3.1V8z')

// Easing function: easeOutQuart - 1 - (1-t)^4
const easeOutQuart = (t: number): number => 1 - Math.pow(1 - t, 4)

interface NextSpinInfo {
  prize: string | null
  index: number | null
  number: string
}

interface SpinWheelProps {
  nextSpin: NextSpinInfo
  setNextSpin: (info: NextSpinInfo) => void
  setIsSpinning: (spinning: boolean) => void
}

function SpinWheel({ setNextSpin, setIsSpinning: setParentIsSpinning }: SpinWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [luckyNumbers, setLuckyNumbers] = useState<string[]>([])
  const [shuffledNumbers, setShuffledNumbers] = useState<string[]>([])
  const [isSpinning, setIsSpinning] = useState<boolean>(false)
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null)
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState<boolean>(false)
  const [spinConfig, setSpinConfig] = useState<Record<string, { turns: number }>>({})
  const [prizeWinners, setPrizeWinners] = useState<typeof EMPTY_PRIZE_WINNERS>(EMPTY_PRIZE_WINNERS)
  
  const rotationRef = useRef<number>(0)
  const animationFrameRef = useRef<number | undefined>(undefined)
  const prizeWinnersRef = useRef<typeof EMPTY_PRIZE_WINNERS | null>(null)
  const spinAnimationRef = useRef<{
    startRotation: number
    finalRotation: number
    startTime: number
    duration: number
  } | null>(null)
  const gradientCacheRef = useRef<CanvasGradient | null>(null)
  const canvasSizeRef = useRef<number>(0)
  const winnerCalculatedRef = useRef<boolean>(false)
  const centerCircleRef = useRef<{ x: number; y: number; radius: number } | null>(null)

  const getWonNumbers = useCallback((prizeWinnersData: typeof EMPTY_PRIZE_WINNERS | null): Set<string> => {
    if (!prizeWinnersData) return new Set()
    
    const wonNumbers = new Set<string>()
    PRIZE_ORDER.forEach((prizeKey) => {
      const winners = prizeWinnersData[prizeKey] || []
      winners.forEach((number: string | null) => {
        if (number) wonNumbers.add(number)
      })
    })
    return wonNumbers
  }, [])

  const findNextSlot = useCallback((prizeCounts: Record<string, number>, prizeWinnersData: typeof EMPTY_PRIZE_WINNERS) => {
    for (const prizeKey of PRIZE_ORDER) {
      const count = prizeCounts[prizeKey] || 0
      if (count === 0) continue

      const winners = prizeWinnersData[prizeKey] || []
      for (let i = 0; i < count; i++) {
        if (!winners[i]) {
          return { prize: prizeKey, index: i }
        }
      }
    }
    return null
  }, [])

  // Start next spin animation
  const startNextSpinAnimation = useCallback(async () => {
    if (!db) return

    const prizeCountsRef = ref(db, 'settings/prizeCounts')
    const prizeWinnersDbRef = ref(db, 'settings/prizeWinners')
    
    const [countsSnapshot, winnersSnapshot] = await Promise.all([
      get(prizeCountsRef),
      get(prizeWinnersDbRef)
    ])

    if (!countsSnapshot.exists()) {
      setNextSpin({ prize: null, index: null, number: '' })
      return
    }

    const prizeCounts = countsSnapshot.val()
    const prizeWinnersData = winnersSnapshot.exists() ? winnersSnapshot.val() : EMPTY_PRIZE_WINNERS
    prizeWinnersRef.current = prizeWinnersData

    const nextSlot = findNextSlot(prizeCounts, prizeWinnersData)
    setNextSpin(nextSlot 
      ? { prize: nextSlot.prize, index: nextSlot.index, number: '' }
      : { prize: null, index: null, number: '' }
    )
  }, [db, setNextSpin, findNextSlot])

  const updatePrizeWithNumber = useCallback(async (number: string) => {
    if (!db) return

    try {
      const prizeCountsRef = ref(db, 'settings/prizeCounts')
      const prizeWinnersDbRef = ref(db, 'settings/prizeWinners')
      
      const [countsSnapshot, winnersSnapshot] = await Promise.all([
        get(prizeCountsRef),
        get(prizeWinnersDbRef)
      ])

      if (!countsSnapshot.exists()) return

      const prizeCounts = countsSnapshot.val()
      const prizeWinners = winnersSnapshot.exists() ? winnersSnapshot.val() : { ...EMPTY_PRIZE_WINNERS }
      const nextSlot = findNextSlot(prizeCounts, prizeWinners)

      if (!nextSlot) {
        console.log('Không còn vị trí trống trong các giải thưởng')
        return
      }

      const winners = prizeWinners[nextSlot.prize] || []
      const newWinners = [...winners]
      while (newWinners.length <= nextSlot.index) {
        newWinners.push(null)
      }
      newWinners[nextSlot.index] = number
      
      prizeWinners[nextSlot.prize] = newWinners
      prizeWinnersRef.current = prizeWinners
      setPrizeWinners(prizeWinners)
      
      await set(prizeWinnersDbRef, prizeWinners)
    } catch (error) {
      console.error('Error updating prize with number:', error)
    }
  }, [db, findNextSlot])

  const calculateWinner = useCallback(() => {
    const displayNumbers = shuffledNumbers.length % 2 === 1 
      ? [...shuffledNumbers, ''] 
      : shuffledNumbers
    const segmentCount = displayNumbers.length || 1
    const anglePerSegment = TWO_PI / segmentCount
    
    let normalizedRotation = rotationRef.current % TWO_PI
    if (normalizedRotation < 0) {
      normalizedRotation += TWO_PI
    }
    
    let selectedIndex = 0
    let minDiff = Infinity
    
    for (let i = 0; i < segmentCount; i++) {
      const segmentCenterAngle = (i * anglePerSegment + anglePerSegment / 2 + normalizedRotation) % TWO_PI
      let diff = Math.abs(segmentCenterAngle - POINTER_ANGLE)
      diff = Math.min(diff, TWO_PI - diff)
      
      if (diff < minDiff) {
        minDiff = diff
        selectedIndex = i
      }
    }
    
    const winner = displayNumbers[selectedIndex]
    if (!winner) return
    
    setSelectedNumber(winner)
    setShowConfetti(true)
    
    if (db) {
      const registrationRef = ref(db, `registration/${winner}`)
      get(registrationRef)
        .then((snapshot) => {
          setSelectedEmail(snapshot.exists() ? snapshot.val().email || null : null)
        })
        .catch((error) => {
          console.error('Error fetching winner email:', error)
          setSelectedEmail(null)
        })
    }
    
    updatePrizeWithNumber(winner).then(() => {
      setTimeout(() => startNextSpinAnimation(), 500)
    })
    
    setTimeout(() => setShowConfetti(false), 3000)
  }, [shuffledNumbers, db, updatePrizeWithNumber, startNextSpinAnimation])

  // Load lucky numbers from Firebase
  useEffect(() => {
    if (!db) return

    const registrationRef = ref(db, 'registration')
    return onValue(registrationRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        const numbers = Object.keys(data).sort((a, b) => parseInt(a) - parseInt(b))
        setLuckyNumbers(numbers)
      } else {
        setLuckyNumbers([])
        setShuffledNumbers([])
        setNextSpin({ prize: null, index: null, number: '' })
      }
    })
  }, [setNextSpin])

  // Tự động bắt đầu animation khi có số may mắn và không đang quay
  useEffect(() => {
    if (!db || !isSpinning || luckyNumbers.length === 0) return
    startNextSpinAnimation()
  }, [luckyNumbers, isSpinning, db, startNextSpinAnimation])

  // Cập nhật animation khi shuffledNumbers thay đổi (ví dụ: khi undo một số)
  useEffect(() => {
    if (!db || isSpinning || shuffledNumbers.length === 0) return
    startNextSpinAnimation()
  }, [shuffledNumbers, isSpinning, db, startNextSpinAnimation])

  // Single Render Loop - hợp nhất tất cả animation vào một vòng lặp duy nhất
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || shuffledNumbers.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const size = Math.min(window.innerHeight * 0.85, window.innerWidth * 0.8, 800)
    canvas.width = size
    canvas.height = size
    canvasSizeRef.current = size
    
    const centerX = size / 2
    const centerY = size / 2
    const radius = size / 2 - 40
    const lightRadius = radius + 20
    const pointerY = centerY - radius - 8
    const arrowWidth = 28
    const arrowHeight = 28
    
    if (!gradientCacheRef.current || canvasSizeRef.current !== size) {
      gradientCacheRef.current = ctx.createLinearGradient(
        centerX, 
        pointerY - arrowHeight / 2, 
        centerX, 
        pointerY + arrowHeight / 2
      )
      gradientCacheRef.current.addColorStop(0, '#fdd835')
      gradientCacheRef.current.addColorStop(1, '#fbc02d')
    }

    const drawWheel = () => {
      ctx.clearRect(0, 0, size, size)

      let currentRotation = rotationRef.current
      if (spinAnimationRef.current && isSpinning) {
        const anim = spinAnimationRef.current
        const elapsed = Date.now() - anim.startTime
        const progress = Math.min(elapsed / anim.duration, 1)
        
        if (progress >= 1) {
          currentRotation = anim.finalRotation
          rotationRef.current = currentRotation
          spinAnimationRef.current = null
          setIsSpinning(false)
          setParentIsSpinning(false)
          
          if (!winnerCalculatedRef.current) {
            winnerCalculatedRef.current = true
            calculateWinner()
          }
        } else {
          winnerCalculatedRef.current = false
          const easedProgress = easeOutQuart(progress)
          currentRotation = anim.startRotation + (anim.finalRotation - anim.startRotation) * easedProgress
          rotationRef.current = currentRotation
        }
      } else {
        winnerCalculatedRef.current = false
      }

      const displayNumbers = shuffledNumbers.length % 2 === 1 
        ? [...shuffledNumbers, ''] 
        : shuffledNumbers
      const segmentCount = displayNumbers.length || 1
      const anglePerSegment = TWO_PI / segmentCount

      // Draw wheel segments
      for (let i = 0; i < segmentCount; i++) {
        const startAngle = i * anglePerSegment + currentRotation
        const endAngle = (i + 1) * anglePerSegment + currentRotation

        ctx.beginPath()
        ctx.moveTo(centerX, centerY)
        ctx.arc(centerX, centerY, radius, startAngle, endAngle)
        ctx.closePath()

        // Alternate colors: white and red
        ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#e53935'
        ctx.fill()

        // Draw lucky number text or lock icon
        const textAngle = startAngle + anglePerSegment / 2
        const textX = centerX + Math.cos(textAngle) * (radius * 0.7)
        const textY = centerY + Math.sin(textAngle) * (radius * 0.7)

        ctx.save()
        ctx.translate(textX, textY)
        ctx.rotate(textAngle + Math.PI / 2)
        
        if (displayNumbers[i]) {
          ctx.fillStyle = i % 2 === 0 ? '#e53935' : '#ffffff'
          ctx.font = `bold ${Math.max(18, Math.min(28, radius / 7))}px Arial`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(displayNumbers[i], 0, 0)
        } else {
          const iconSize = Math.max(28, Math.min(45, radius / 6))
          const lockColor = i % 2 === 0 ? '#e53935' : '#ffffff'
          const scale = iconSize / 24
          
          ctx.save()
          ctx.scale(scale, scale)
          ctx.translate(-12, -12)
          ctx.fillStyle = lockColor
          ctx.strokeStyle = lockColor
          ctx.lineWidth = 1.5 / scale
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.fill(LOCK_PATH)
          ctx.stroke(LOCK_PATH)
          ctx.restore()
        }
        
        ctx.restore()
      }

      // Draw center circle
      const centerRadius = radius * 0.15
      centerCircleRef.current = { x: centerX, y: centerY, radius: centerRadius }
      ctx.beginPath()
      ctx.arc(centerX, centerY, centerRadius, 0, TWO_PI)
      ctx.fillStyle = '#e53935'
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3
      ctx.stroke()

      // Draw blinking lights around the wheel
      const lightCount = 24
      const lightAngleStep = TWO_PI / lightCount
      const blinkSpeed = isSpinning ? 50 : 200
      const time = Date.now() / blinkSpeed

      for (let i = 0; i < lightCount; i++) {
        const lightAngle = i * lightAngleStep
        const lightX = centerX + Math.cos(lightAngle) * lightRadius
        const lightY = centerY + Math.sin(lightAngle) * lightRadius
        const blink = Math.sin(time + i * 0.5) * 0.5 + 0.5
        const alpha = blink * 0.8 + 0.2

        ctx.beginPath()
        ctx.arc(lightX, lightY, 8, 0, TWO_PI)
        ctx.fillStyle = '#ffeb3b'
        ctx.globalAlpha = alpha
        ctx.fill()
        
        ctx.beginPath()
        ctx.arc(lightX, lightY, 12, 0, TWO_PI)
        ctx.fillStyle = '#ffeb3b'
        ctx.globalAlpha = alpha * 0.3
        ctx.fill()
        ctx.globalAlpha = 1
      }

      // Draw golden arrow pointer
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)'
      ctx.shadowBlur = 8
      ctx.shadowOffsetY = 2

      ctx.beginPath()
      ctx.moveTo(centerX, pointerY + arrowHeight / 2)
      ctx.lineTo(centerX - arrowWidth / 2, pointerY - arrowHeight / 2)
      ctx.lineTo(centerX + arrowWidth / 2, pointerY - arrowHeight / 2)
      ctx.closePath()

      ctx.fillStyle = gradientCacheRef.current!
      ctx.fill()
      ctx.strokeStyle = '#8d6e63'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.restore()
    }

    const animate = () => {
      drawWheel()
      animationFrameRef.current = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [shuffledNumbers, isSpinning, calculateWinner, setParentIsSpinning])
  
  // Load prizeWinners để cập nhật ref và state
  useEffect(() => {
    if (!db) return

    const prizeWinnersDbRef = ref(db, 'settings/prizeWinners')
    return onValue(prizeWinnersDbRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        prizeWinnersRef.current = data
        setPrizeWinners(data)
      } else {
        prizeWinnersRef.current = EMPTY_PRIZE_WINNERS
        setPrizeWinners(EMPTY_PRIZE_WINNERS)
      }
    })
  }, [])

  // Cập nhật shuffledNumbers: lọc bỏ các số đã trúng
  useEffect(() => {
    if (luckyNumbers.length === 0) {
      setShuffledNumbers([])
      return
    }

    const wonNumbers = getWonNumbers(prizeWinners)
    const availableNumbers = luckyNumbers.filter(number => !wonNumbers.has(number))
    
    setShuffledNumbers(prev => {
      if (prev.length === availableNumbers.length && 
          prev.every((num, idx) => num === availableNumbers[idx])) {
        return prev
      }
      return availableNumbers
    })
  }, [luckyNumbers, prizeWinners, getWonNumbers])

  // Load spinConfig từ Firebase
  useEffect(() => {
    if (!db) return

    const spinConfigRef = ref(db, 'settings/spinConfig')
    return onValue(spinConfigRef, (snapshot) => {
      setSpinConfig(snapshot.exists() ? snapshot.val() : {})
    })
  }, [])

  const handleSpin = useCallback(async () => {
    if (luckyNumbers.length === 0 || isSpinning || !db) return
    
    setNextSpin({ prize: null, index: null, number: '' })
    
    const prizeCountsRef = ref(db, 'settings/prizeCounts')
    const prizeWinnersDbRef = ref(db, 'settings/prizeWinners')
    
    const [countsSnapshot, winnersSnapshot] = await Promise.all([
      get(prizeCountsRef),
      get(prizeWinnersDbRef)
    ])

    if (!countsSnapshot.exists()) return

    const prizeCounts = countsSnapshot.val()
    const prizeWinnersData = winnersSnapshot.exists() ? winnersSnapshot.val() : EMPTY_PRIZE_WINNERS
    const nextSlot = findNextSlot(prizeCounts, prizeWinnersData)
    const currentPrize = nextSlot?.prize || null
    const currentConfig = currentPrize && spinConfig[currentPrize] 
      ? spinConfig[currentPrize]
      : { turns: DEFAULT_SPIN_TURNS }
    
    const totalTurns = currentConfig.turns
    const baseTurns = Math.max(0, totalTurns - DECELERATION_TURNS)
    const decelerationTurns = Math.min(DECELERATION_TURNS, totalTurns)
    
    const randomOffset = Math.random() * TWO_PI
    const startRotation = rotationRef.current
    const finalRotation = startRotation - (totalTurns * TWO_PI) - randomOffset
    
    const baseDuration = baseTurns * BASE_SPEED_PER_TURN
    const decelerationDuration = decelerationTurns * (BASE_SPEED_PER_TURN * 2)
    const totalDuration = baseDuration + decelerationDuration
    
    winnerCalculatedRef.current = false
    spinAnimationRef.current = {
      startRotation,
      finalRotation,
      startTime: Date.now(),
      duration: totalDuration
    }
    
    setIsSpinning(true)
    setParentIsSpinning(true)
  }, [luckyNumbers, isSpinning, db, setNextSpin, findNextSlot, spinConfig, setParentIsSpinning])

  const handleClosePopup = useCallback(() => {
    setSelectedNumber(null)
    setSelectedEmail(null)
  }, [])

  const handleShuffle = useCallback(() => {
    if (shuffledNumbers.length === 0) return
    
    const shuffled = [...shuffledNumbers]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    
    rotationRef.current = 0
    setShuffledNumbers(shuffled)
  }, [shuffledNumbers])

  // Handle click on center circle
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleCanvasClick = (e: MouseEvent) => {
      if (isSpinning || shuffledNumbers.length === 0) return

      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const x = (e.clientX - rect.left) * scaleX
      const y = (e.clientY - rect.top) * scaleY

      if (centerCircleRef.current) {
        const { x: centerX, y: centerY, radius } = centerCircleRef.current
        const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2))
        
        if (distance <= radius) {
          handleSpin()
        }
      }
    }

    canvas.addEventListener('click', handleCanvasClick)
    return () => {
      canvas.removeEventListener('click', handleCanvasClick)
    }
  }, [isSpinning, shuffledNumbers, handleSpin])

  return (
    <>
      <Confetti active={showConfetti} />
      <div className="spin-wheel-section">
        <div className="spin-wheel-container">
          <canvas ref={canvasRef} className="spin-wheel-canvas" />
          {luckyNumbers.length > 0 && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                className="spin-button"
                onClick={handleSpin}
                disabled={isSpinning}
              >
                {isSpinning ? 'Đang quay...' : 'Quay số may mắn'}
              </button>
              <button
                className="spin-button"
                onClick={handleShuffle}
                disabled={isSpinning}
              >
                Xáo số
              </button>
            </div>
          )}
          {luckyNumbers.length === 0 && (
            <div className="spin-wheel-empty">Chưa có số may mắn để quay</div>
          )}
        </div>
      </div>
      
      {selectedNumber && (
        <div className="winner-popup-overlay" onClick={handleClosePopup}>
          <div className="winner-popup" onClick={(e) => e.stopPropagation()}>
            <div className="winner-popup-content">
              <div className="winner-popup-title">🎉 Chúc mừng! 🎉</div>
              <div className="winner-popup-number">Số may mắn: {selectedNumber}</div>
              {selectedEmail && (
                <div className="winner-popup-email">Người dùng: {selectedEmail}</div>
              )}
              <button className="winner-popup-close" onClick={handleClosePopup}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default SpinWheel
