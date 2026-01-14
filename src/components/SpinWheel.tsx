import { useEffect, useRef, useState } from 'react'
import '../App.css'
import { ref, onValue, get, set } from 'firebase/database'
import { db } from '../firebase'
import Confetti from './Confetti'

// Giá trị mặc định (sẽ được cập nhật từ Firebase)
const DEFAULT_SPIN_TURNS = 15

// Cấu hình tốc độ quay (ms/vòng)
const BASE_SPEED_PER_TURN = 1000 // Tốc độ cơ bản: 1 giây/vòng
const DECELERATION_TURNS = 2 // Số vòng cuối để giảm tốc mượt

// Easing function: easeOutQuart - 1 - (1-t)^4
// Tạo hiệu ứng giảm tốc mượt mà như ma sát vật lý
const easeOutQuart = (t: number): number => {
  return 1 - Math.pow(1 - t, 4)
}

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
  const [shuffledNumbers, setShuffledNumbers] = useState<string[]>([]) // Thứ tự hiển thị trên bánh xe (có thể xáo trộn)
  const [isSpinning, setIsSpinning] = useState<boolean>(false)
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null)
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState<boolean>(false)
  const [spinConfig, setSpinConfig] = useState<Record<string, { turns: number }>>({})
  const [prizeWinners, setPrizeWinners] = useState<any>({
    special: [],
    first: [],
    second: [],
    third: [],
    consolation: []
  })
  const rotationRef = useRef<number>(0)
  const animationFrameRef = useRef<number | undefined>(undefined)
  const nextSpinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prizeWinnersRef = useRef<any>(null)
  
  // Animation state - tách biệt logic quay khỏi handleSpin
  const spinAnimationRef = useRef<{
    startRotation: number
    finalRotation: number
    startTime: number
    duration: number
  } | null>(null)
  
  // Cache gradient và shadow để tránh tạo lại mỗi frame
  const gradientCacheRef = useRef<CanvasGradient | null>(null)
  const canvasSizeRef = useRef<number>(0)
  
  // Flag để đảm bảo calculateWinner chỉ được gọi một lần
  const winnerCalculatedRef = useRef<boolean>(false)

  // Hàm helper để lấy tất cả các số đã trúng từ prizeWinners
  const getWonNumbers = (prizeWinnersData: any): Set<string> => {
    const wonNumbers = new Set<string>()
    if (!prizeWinnersData) return wonNumbers
    
    const prizeKeys = ['special', 'first', 'second', 'third', 'consolation']
    prizeKeys.forEach((prizeKey) => {
      const winners = prizeWinnersData[prizeKey] || []
      winners.forEach((number: string | null) => {
        if (number && number !== '') {
          wonNumbers.add(number)
        }
      })
    })
    return wonNumbers
  }

  // Load lucky numbers from Firebase
  useEffect(() => {
    if (!db) return

    const registrationRef = ref(db, 'registration')
    
    const unsubscribe = onValue(registrationRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        const numbers = Object.keys(data).sort((a, b) => parseInt(a) - parseInt(b))
        setLuckyNumbers(numbers)
        // shuffledNumbers sẽ được cập nhật trong useEffect riêng để lọc bỏ số đã trúng
      } else {
        setLuckyNumbers([])
        setShuffledNumbers([])
        stopNextSpinAnimation()
      }
    })

    return () => {
      unsubscribe()
      stopNextSpinAnimation()
    }
  }, [])

  // Tự động bắt đầu animation khi có số may mắn và không đang quay
  useEffect(() => {
    if (!db || isSpinning || luckyNumbers.length === 0) return

    // Kiểm tra xem đã có animation đang chạy chưa
    if (nextSpinIntervalRef.current) return

    // Bắt đầu animation cho số đầu tiên
    startNextSpinAnimation()

    return () => {
      // Cleanup khi component unmount hoặc dependencies thay đổi
      stopNextSpinAnimation()
    }
  }, [luckyNumbers, isSpinning])

  // Single Render Loop - hợp nhất tất cả animation vào một vòng lặp duy nhất
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || shuffledNumbers.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Larger wheel size to accommodate more participants
    const size = Math.min(window.innerHeight * 0.85, window.innerWidth * 0.8, 800)
    canvas.width = size
    canvas.height = size
    canvasSizeRef.current = size
    
    const centerX = size / 2
    const centerY = size / 2
    const radius = size / 2 - 40
    const lightRadius = radius + 20

    // Cache gradient và shadow - chỉ tạo một lần
    const pointerY = centerY - radius - 8
    const arrowWidth = 28
    const arrowHeight = 28
    
    // Tạo gradient một lần và cache
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

      // Tính toán rotation: nếu đang quay thì dùng easing, nếu không thì giữ nguyên
      let currentRotation = rotationRef.current
      if (spinAnimationRef.current && isSpinning) {
        const anim = spinAnimationRef.current
        const elapsed = Date.now() - anim.startTime
        const progress = Math.min(elapsed / anim.duration, 1)
        
        if (progress >= 1) {
          // Animation hoàn thành
          currentRotation = anim.finalRotation
          rotationRef.current = currentRotation
          spinAnimationRef.current = null
          setIsSpinning(false)
          setParentIsSpinning(false)
          
          // Tính toán số trúng thưởng (chỉ một lần)
          if (!winnerCalculatedRef.current) {
            winnerCalculatedRef.current = true
            calculateWinner()
          }
        } else {
          // Reset flag khi đang quay
          winnerCalculatedRef.current = false
          // Áp dụng easing function
          const easedProgress = easeOutQuart(progress)
          currentRotation = anim.startRotation + (anim.finalRotation - anim.startRotation) * easedProgress
          rotationRef.current = currentRotation
        }
      } else {
        // Reset flag khi không quay
        winnerCalculatedRef.current = false
      }

      // Add empty segment if count is odd to maintain color alternation
      const displayNumbers = shuffledNumbers.length % 2 === 1 
        ? [...shuffledNumbers, ''] 
        : shuffledNumbers
      const segmentCount = displayNumbers.length || 1
      const anglePerSegment = (2 * Math.PI) / segmentCount

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
          // Draw lucky number text
          ctx.fillStyle = i % 2 === 0 ? '#e53935' : '#ffffff'
          ctx.font = `bold ${Math.max(18, Math.min(28, radius / 7))}px Arial`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(displayNumbers[i], 0, 0)
        } else {
          // Draw lock icon with X using SVG path (Material Icons lock)
          const iconSize = Math.max(28, Math.min(45, radius / 6))
          const lockColor = i % 2 === 0 ? '#e53935' : '#ffffff'
          
          // SVG path for lock icon (Material Icons)
          // Scale to fit iconSize
          const scale = iconSize / 24 // Material Icons are typically 24x24
          
          ctx.save()
          ctx.scale(scale, scale)
          ctx.translate(-12, -12) // Center the 24x24 icon at origin
          
          ctx.fillStyle = lockColor
          ctx.strokeStyle = lockColor
          ctx.lineWidth = 1.5 / scale
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          
          // Lock icon SVG path (Material Icons - lock)
          const lockPath = new Path2D('M18,8h-1V6c0-2.76-2.24-5-5-5S7,3.24,7,6v2H6c-1.1,0-2,0.9-2,2v10c0,1.1,0.9,2,2,2h12c1.1,0,2-0.9,2-2V10C20,8.9,19.1,8,18,8z M12,17c-1.1,0-2-0.9-2-2s0.9-2,2-2s2,0.9,2,2S13.1,17,12,17z M15.1,8H8.9V6c0-1.71,1.39-3.1,3.1-3.1s3.1,1.39,3.1,3.1V8z')
          
          ctx.fill(lockPath)
          ctx.stroke(lockPath)
          ctx.restore()
        }
        
        ctx.restore()
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
      const blinkSpeed = isSpinning ? 50 : 200
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

      // Draw golden arrow pointer (triangle) - sử dụng cached gradient
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)'
      ctx.shadowBlur = 8
      ctx.shadowOffsetY = 2

      ctx.beginPath()
      ctx.moveTo(centerX, pointerY + arrowHeight / 2) // tip
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

    // Single animation loop - xử lý cả quay và đèn nhấp nháy
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
  }, [shuffledNumbers, isSpinning])

  // Hàm tính toán số trúng thưởng
  const calculateWinner = () => {
    const displayNumbers = shuffledNumbers.length % 2 === 1 
      ? [...shuffledNumbers, ''] 
      : shuffledNumbers
    const segmentCount = displayNumbers.length || 1
    const anglePerSegment = (2 * Math.PI) / segmentCount
    
    // Normalize rotation to 0-2π range
    let normalizedRotation = rotationRef.current % (2 * Math.PI)
    if (normalizedRotation < 0) {
      normalizedRotation += 2 * Math.PI
    }
    
    // Pointer is at top (3*Math.PI/2)
    const pointerAngle = (3 * Math.PI) / 2
    
    // Find segment closest to pointer
    let selectedIndex = 0
    let minDiff = Infinity
    
    for (let i = 0; i < segmentCount; i++) {
      const segmentCenterAngle = (i * anglePerSegment + anglePerSegment / 2 + normalizedRotation) % (2 * Math.PI)
      let diff = Math.abs(segmentCenterAngle - pointerAngle)
      diff = Math.min(diff, 2 * Math.PI - diff)
      
      if (diff < minDiff) {
        minDiff = diff
        selectedIndex = i
      }
    }
    
    const winner = displayNumbers[selectedIndex]
    if (winner && winner !== '') {
      setSelectedNumber(winner)
      
      // Lấy email từ Firebase registration data
      if (db) {
        const registrationRef = ref(db, `registration/${winner}`)
        get(registrationRef).then((snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val()
            setSelectedEmail(data.email || null)
          } else {
            setSelectedEmail(null)
          }
        }).catch((error) => {
          console.error('Error fetching winner email:', error)
          setSelectedEmail(null)
        })
      }
      
      setShowConfetti(true)
      
      // Cập nhật số vào giải thưởng
      updatePrizeWithNumber(winner).then(() => {
        // Bắt đầu animation cho số tiếp theo
        setTimeout(() => {
          startNextSpinAnimation()
        }, 500)
      })
      
      // Hide confetti after 3 seconds
      setTimeout(() => {
        setShowConfetti(false)
      }, 3000)
    }
  }

  // Hàm bắt đầu hiệu ứng nhảy số cho số sắp quay
  const startNextSpinAnimation = async () => {
    if (!db) return

    // Lấy dữ liệu từ DB
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
    const prizeWinnersData = winnersSnapshot.exists() ? winnersSnapshot.val() : {
      special: [],
      first: [],
      second: [],
      third: [],
      consolation: []
    }
    
    prizeWinnersRef.current = prizeWinnersData

    // Tìm giải và ô tiếp theo cần quay
    const prizeOrder = ['consolation', 'third', 'second', 'first', 'special']
    let nextSlot: { prize: string; index: number } | null = null

    for (const prizeKey of prizeOrder) {
      const count = prizeCounts[prizeKey] || 0
      if (count === 0) continue

      const winners = prizeWinnersData[prizeKey] || []
      
      // Tìm vị trí trống đầu tiên
      for (let i = 0; i < count; i++) {
        if (!winners[i]) {
          nextSlot = { prize: prizeKey, index: i }
          break
        }
      }
      
      if (nextSlot) break
    }

    if (!nextSlot) {
      setNextSpin({ prize: null, index: null, number: '' })
      return
    }

    // Set nextSpin với số rỗng để hiển thị "???"
    setNextSpin({
      prize: nextSlot.prize,
      index: nextSlot.index,
      number: ''
    })
  }

  // Dừng hiệu ứng nhảy số
  const stopNextSpinAnimation = () => {
    if (nextSpinIntervalRef.current) {
      clearInterval(nextSpinIntervalRef.current)
      nextSpinIntervalRef.current = null
    }
    setNextSpin({ prize: null, index: null, number: '' })
  }
  
  // Load prizeWinners để cập nhật ref và state
  useEffect(() => {
    if (!db) return

    const prizeWinnersDbRef = ref(db, 'settings/prizeWinners')
    
    const unsubscribe = onValue(prizeWinnersDbRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        prizeWinnersRef.current = data
        setPrizeWinners(data)
      } else {
        const emptyData = {
          special: [],
          first: [],
          second: [],
          third: [],
          consolation: []
        }
        prizeWinnersRef.current = emptyData
        setPrizeWinners(emptyData)
      }
    })

    return () => unsubscribe()
  }, [])

  // Cập nhật shuffledNumbers: lọc bỏ các số đã trúng
  useEffect(() => {
    if (luckyNumbers.length === 0) {
      setShuffledNumbers([])
      return
    }

    // Lấy các số đã trúng
    const wonNumbers = getWonNumbers(prizeWinners)
    
    // Lọc bỏ các số đã trúng khỏi danh sách
    const availableNumbers = luckyNumbers.filter(number => !wonNumbers.has(number))
    
    // Cập nhật shuffledNumbers với các số còn lại
    setShuffledNumbers([...availableNumbers])
  }, [luckyNumbers, prizeWinners])

  // Load spinConfig từ Firebase (theo từng giải)
  useEffect(() => {
    if (!db) return

    const spinConfigRef = ref(db, 'settings/spinConfig')
    
    const unsubscribe = onValue(spinConfigRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        setSpinConfig(data)
      } else {
        // Sử dụng giá trị mặc định nếu chưa có trong Firebase
        setSpinConfig({})
      }
    })

    return () => unsubscribe()
  }, [])

  const handleSpin = async () => {
    if (luckyNumbers.length === 0 || isSpinning) return
    
    // Dừng animation nhảy số
    await stopNextSpinAnimation()
    
    // Lấy thông tin giải đang quay từ nextSpin
    const prizeCountsRef = ref(db, 'settings/prizeCounts')
    const prizeWinnersDbRef = ref(db, 'settings/prizeWinners')
    
    const [countsSnapshot, winnersSnapshot] = await Promise.all([
      get(prizeCountsRef),
      get(prizeWinnersDbRef)
    ])

    if (!countsSnapshot.exists()) return

    const prizeCounts = countsSnapshot.val()
    const prizeWinnersData = winnersSnapshot.exists() ? winnersSnapshot.val() : {
      special: [],
      first: [],
      second: [],
      third: [],
      consolation: []
    }

    // Tìm giải tiếp theo cần quay
    const prizeOrder = ['consolation', 'third', 'second', 'first', 'special']
    let currentPrize: string | null = null
    
    for (const prizeKey of prizeOrder) {
      const count = prizeCounts[prizeKey] || 0
      if (count === 0) continue

      const winners = prizeWinnersData[prizeKey] || []
      
      for (let i = 0; i < count; i++) {
        if (!winners[i]) {
          currentPrize = prizeKey
          break
        }
      }
      
      if (currentPrize) break
    }

    // Lấy cấu hình quay cho giải hiện tại (chỉ cần turns)
    const currentConfig = currentPrize && spinConfig[currentPrize] 
      ? spinConfig[currentPrize]
      : { turns: DEFAULT_SPIN_TURNS }
    
    // Tính toán animation parameters
    const totalTurns = currentConfig.turns
    const baseTurns = Math.max(0, totalTurns - DECELERATION_TURNS) // Các vòng đầu quay đều
    const decelerationTurns = Math.min(DECELERATION_TURNS, totalTurns) // Các vòng cuối giảm tốc
    
    // Tính toán vị trí cuối cùng (quay ngược chiều)
    // Thêm random offset để mỗi lần quay dừng ở vị trí khác nhau (tạo tính ngẫu nhiên)
    const randomOffset = Math.random() * 2 * Math.PI // Random từ 0 đến 2π (một vòng đầy đủ)
    const startRotation = rotationRef.current
    const finalRotation = startRotation - (totalTurns * 2 * Math.PI) - randomOffset
    
    // Tính thời gian: phần đầu quay đều, phần cuối giảm tốc mượt hơn
    const baseDuration = baseTurns * BASE_SPEED_PER_TURN
    // Phần giảm tốc: thời gian dài hơn để mượt hơn (2 giây/vòng cho 2 vòng cuối)
    const decelerationDuration = decelerationTurns * (BASE_SPEED_PER_TURN * 2)
    const totalDuration = baseDuration + decelerationDuration
    
    // Reset flag khi bắt đầu quay mới
    winnerCalculatedRef.current = false
    
    // Set animation state - useEffect sẽ lo việc animate
    spinAnimationRef.current = {
      startRotation,
      finalRotation,
      startTime: Date.now(),
      duration: totalDuration
    }
    
    setIsSpinning(true)
    setParentIsSpinning(true)
  }

  const handleClosePopup = () => {
    setSelectedNumber(null)
    setSelectedEmail(null)
  }

  // Hàm xáo trộn thứ tự các số trên bánh xe
  const handleShuffle = () => {
    if (shuffledNumbers.length === 0) return
    
    // Tạo bản sao và xáo trộn ngẫu nhiên (Fisher-Yates shuffle)
    const shuffled = [...shuffledNumbers]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    
    // Reset rotation về 0 để bánh xe vẽ lại từ đầu với thứ tự mới
    rotationRef.current = 0
    
    // Cập nhật state để trigger re-render và vẽ lại bánh xe
    setShuffledNumbers(shuffled)
  }

  // Hàm cập nhật số vào giải thưởng
  const updatePrizeWithNumber = async (number: string) => {
    if (!db) return

    try {
      // Lấy dữ liệu giải thưởng từ Firebase
      const prizeCountsRef = ref(db, 'settings/prizeCounts')
      const prizeWinnersDbRef = ref(db, 'settings/prizeWinners')
      
      const [countsSnapshot, winnersSnapshot] = await Promise.all([
        get(prizeCountsRef),
        get(prizeWinnersDbRef)
      ])

      if (!countsSnapshot.exists()) return

      const prizeCounts = countsSnapshot.val()
      const prizeWinners = winnersSnapshot.exists() ? winnersSnapshot.val() : {
        special: [],
        first: [],
        second: [],
        third: [],
        consolation: []
      }

      // Mapping từ tiếng Anh sang thứ tự (từ thấp đến cao)
      const prizeOrder = [
        { key: 'consolation', name: 'Giải khuyến khích' },
        { key: 'third', name: 'Giải ba' },
        { key: 'second', name: 'Giải nhì' },
        { key: 'first', name: 'Giải nhất' },
        { key: 'special', name: 'Giải đặc biệt' }
      ]

      // Tìm giải đầu tiên còn trống (từ thấp đến cao)
      let found = false
      for (const prize of prizeOrder) {
        const count = prizeCounts[prize.key] || 0
        if (count === 0) continue

        const winners = prizeWinners[prize.key] || []
        
        // Tìm vị trí trống đầu tiên
        for (let i = 0; i < count; i++) {
          if (!winners[i]) {
            // Cập nhật số vào vị trí này
            const newWinners = [...winners]
            while (newWinners.length <= i) {
              newWinners.push(null)
            }
            newWinners[i] = number
            
            prizeWinners[prize.key] = newWinners
            
            // Cập nhật ref và state để animation có thể tiếp tục với danh sách mới
            prizeWinnersRef.current = prizeWinners
            setPrizeWinners(prizeWinners)
            
            // Lưu lên Firebase
            await set(prizeWinnersDbRef, prizeWinners)
            found = true
            console.log(`Đã thêm số ${number} vào ${prize.name} - vị trí ${i + 1}`)
            break
          }
        }
        
        if (found) break
      }

      if (!found) {
        console.log('Không còn vị trí trống trong các giải thưởng')
      }
    } catch (error) {
      console.error('Error updating prize with number:', error)
    }
  }

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
