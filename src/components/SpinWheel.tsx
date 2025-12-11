import { useEffect, useRef, useState } from 'react'
import '../App.css'
import { ref, onValue, get, set } from 'firebase/database'
import { db } from '../firebase'
import Confetti from './Confetti'

// Giá trị mặc định (sẽ được cập nhật từ Firebase)
const DEFAULT_SPIN_DURATION = 20000 
const DEFAULT_SPIN_TURNS = 15

interface NextSpinInfo {
  prize: string | null
  index: number | null
  number: string
}

interface SpinWheelProps {
  nextSpin: NextSpinInfo
  setNextSpin: (info: NextSpinInfo) => void
}

function SpinWheel({ setNextSpin }: SpinWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [luckyNumbers, setLuckyNumbers] = useState<string[]>([])
  const [shuffledNumbers, setShuffledNumbers] = useState<string[]>([]) // Thứ tự hiển thị trên bánh xe (có thể xáo trộn)
  const [isSpinning, setIsSpinning] = useState<boolean>(false)
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState<boolean>(false)
  const [spinConfig, setSpinConfig] = useState<{ duration: number; turns: number }>({
    duration: DEFAULT_SPIN_DURATION,
    turns: DEFAULT_SPIN_TURNS
  })
  const rotationRef = useRef<number>(0)
  const animationFrameRef = useRef<number | undefined>(undefined)
  const nextSpinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prizeWinnersRef = useRef<any>(null)

  // Load lucky numbers from Firebase
  useEffect(() => {
    if (!db) return

    const registrationRef = ref(db, 'registration')
    
    const unsubscribe = onValue(registrationRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        const numbers = Object.keys(data).sort((a, b) => parseInt(a) - parseInt(b))
        setLuckyNumbers(numbers)
        setShuffledNumbers([...numbers]) // Khởi tạo thứ tự hiển thị
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

  // Draw wheel and lights
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || shuffledNumbers.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Larger wheel size to accommodate more participants
    const size = Math.min(window.innerHeight * 0.85, window.innerWidth * 0.8, 800)
    canvas.width = size
    canvas.height = size
    const centerX = size / 2
    const centerY = size / 2
    const radius = size / 2 - 40
    const lightRadius = radius + 20

    const drawWheel = (rotation: number = 0, spinning: boolean = false) => {
      ctx.clearRect(0, 0, size, size)

      // Add empty segment if count is odd to maintain color alternation
      const displayNumbers = shuffledNumbers.length % 2 === 1 
        ? [...shuffledNumbers, ''] 
        : shuffledNumbers
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
          ctx.font = `bold ${Math.max(18, Math.min(28, radius / 7))}px Arial`
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

      // Draw golden arrow pointer (triangle) for a sharper look
      const pointerY = centerY - radius - 8 // tip sits inside the wheel
      const arrowWidth = 28
      const arrowHeight = 28

      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)'
      ctx.shadowBlur = 8
      ctx.shadowOffsetY = 2

      ctx.beginPath()
      ctx.moveTo(centerX, pointerY + arrowHeight / 2) // tip
      ctx.lineTo(centerX - arrowWidth / 2, pointerY - arrowHeight / 2)
      ctx.lineTo(centerX + arrowWidth / 2, pointerY - arrowHeight / 2)
      ctx.closePath()

      const gradient = ctx.createLinearGradient(centerX, pointerY - arrowHeight / 2, centerX, pointerY + arrowHeight / 2)
      gradient.addColorStop(0, '#fdd835')  // bright gold
      gradient.addColorStop(1, '#fbc02d')  // deeper gold
      ctx.fillStyle = gradient
      ctx.fill()

      ctx.strokeStyle = '#8d6e63'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.restore()
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
  }, [shuffledNumbers, isSpinning])

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

    // Sử dụng tất cả các số may mắn (cho phép số đã quay được chọn lại)
    const availableNumbers = luckyNumbers
    if (availableNumbers.length === 0) {
      setNextSpin({ prize: null, index: null, number: '' })
      return
    }

    // Hiệu ứng nhảy số - nhảy ngẫu nhiên giữa tất cả các số
    nextSpinIntervalRef.current = setInterval(async () => {
      // Lấy lại dữ liệu từ DB để đảm bảo có dữ liệu mới nhất
      const prizeCountsRef = ref(db, 'settings/prizeCounts')
      const prizeWinnersDbRef = ref(db, 'settings/prizeWinners')
      
      const [countsSnapshot, winnersSnapshot] = await Promise.all([
        get(prizeCountsRef),
        get(prizeWinnersDbRef)
      ])

      if (!countsSnapshot.exists()) {
        setNextSpin({ prize: null, index: null, number: '' })
        if (nextSpinIntervalRef.current) {
          clearInterval(nextSpinIntervalRef.current)
          nextSpinIntervalRef.current = null
        }
        return
      }

      const prizeCounts = countsSnapshot.val()
      const currentPrizeWinners = winnersSnapshot.exists() ? winnersSnapshot.val() : {
        special: [],
        first: [],
        second: [],
        third: [],
        consolation: []
      }
      
      prizeWinnersRef.current = currentPrizeWinners
      
      // Tìm giải và ô tiếp theo cần quay (từ DB)
      const prizeOrder = ['consolation', 'third', 'second', 'first', 'special']
      let currentNextSlot: { prize: string; index: number } | null = null
      
      for (const prizeKey of prizeOrder) {
        const count = prizeCounts[prizeKey] || 0
        if (count === 0) continue
        
        const winners = currentPrizeWinners[prizeKey] || []
        for (let i = 0; i < count; i++) {
          if (!winners[i]) {
            currentNextSlot = { prize: prizeKey, index: i }
            break
          }
        }
        if (currentNextSlot) break
      }
      
      if (!currentNextSlot) {
        setNextSpin({ prize: null, index: null, number: '' })
        if (nextSpinIntervalRef.current) {
          clearInterval(nextSpinIntervalRef.current)
          nextSpinIntervalRef.current = null
        }
        return
      }
      
      // Sử dụng tất cả các số may mắn (cho phép số đã quay được chọn lại)
      const currentAvailableNumbers = luckyNumbers
      
      if (currentAvailableNumbers.length === 0) {
        setNextSpin({ prize: null, index: null, number: '' })
        if (nextSpinIntervalRef.current) {
          clearInterval(nextSpinIntervalRef.current)
          nextSpinIntervalRef.current = null
        }
        return
      }
      
      // Nhảy ngẫu nhiên giữa tất cả các số
      const randomIndex = Math.floor(Math.random() * currentAvailableNumbers.length)
      const randomNumber = currentAvailableNumbers[randomIndex]
      
      setNextSpin({
        prize: currentNextSlot.prize,
        index: currentNextSlot.index,
        number: randomNumber
      })
    }, 100) // Nhảy mỗi 100ms
  }

  // Dừng hiệu ứng nhảy số
  const stopNextSpinAnimation = () => {
    if (nextSpinIntervalRef.current) {
      clearInterval(nextSpinIntervalRef.current)
      nextSpinIntervalRef.current = null
    }
    setNextSpin({ prize: null, index: null, number: '' })
  }
  
  // Load prizeWinners để cập nhật ref
  useEffect(() => {
    if (!db) return

    const prizeWinnersDbRef = ref(db, 'settings/prizeWinners')
    
    const unsubscribe = onValue(prizeWinnersDbRef, (snapshot) => {
      if (snapshot.exists()) {
        prizeWinnersRef.current = snapshot.val()
      } else {
        prizeWinnersRef.current = {
          special: [],
          first: [],
          second: [],
          third: [],
          consolation: []
        }
      }
    })

    return () => unsubscribe()
  }, [])

  // Load spinConfig từ Firebase
  useEffect(() => {
    if (!db) return

    const spinConfigRef = ref(db, 'settings/spinConfig')
    
    const unsubscribe = onValue(spinConfigRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        setSpinConfig({
          duration: data.duration || DEFAULT_SPIN_DURATION,
          turns: data.turns || DEFAULT_SPIN_TURNS
        })
      } else {
        // Sử dụng giá trị mặc định nếu chưa có trong Firebase
        setSpinConfig({
          duration: DEFAULT_SPIN_DURATION,
          turns: DEFAULT_SPIN_TURNS
        })
      }
    })

    return () => unsubscribe()
  }, [])

  const handleSpin = async () => {
    if (luckyNumbers.length === 0 || isSpinning) return
    
    // Dừng animation nhảy số
    await stopNextSpinAnimation()
    
    setIsSpinning(true)
    
    // Spin configuration: base turns + random offset
    const randomOffset = Math.random() * 2 * Math.PI // thêm góc ngẫu nhiên để không đoán trước
    const totalTurns = spinConfig.turns + Math.random() * 1.5 // thêm tối đa ~1.5 vòng ngẫu nhiên
    const finalRotation = rotationRef.current - (totalTurns * 2 * Math.PI + randomOffset)
    
    // Animate to final position
    const startRotation = rotationRef.current
    const duration = spinConfig.duration
    const startTime = Date.now()

      const animateSpin = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      
    // Đơn giản: ease-out thống nhất (cubic) để mượt và tránh giật
    // progress: 0 -> 1, easeOut: 0 -> 1
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
      const displayNumbers = shuffledNumbers.length % 2 === 1 
        ? [...shuffledNumbers, ''] 
        : shuffledNumbers
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
          ctx.font = `bold ${Math.max(18, Math.min(28, radius / 7))}px Arial`
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

      // Draw golden arrow pointer (triangle) for a sharper look
      const pointerY = centerY - radius - 8 // tip sits inside the wheel
      const arrowWidth = 28
      const arrowHeight = 28

      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)'
      ctx.shadowBlur = 8
      ctx.shadowOffsetY = 2

      ctx.beginPath()
      ctx.moveTo(centerX, pointerY + arrowHeight / 2) // tip
      ctx.lineTo(centerX - arrowWidth / 2, pointerY - arrowHeight / 2)
      ctx.lineTo(centerX + arrowWidth / 2, pointerY - arrowHeight / 2)
      ctx.closePath()

      const gradient = ctx.createLinearGradient(centerX, pointerY - arrowHeight / 2, centerX, pointerY + arrowHeight / 2)
      gradient.addColorStop(0, '#fdd835')  // bright gold
      gradient.addColorStop(1, '#fbc02d')  // deeper gold
      ctx.fillStyle = gradient
      ctx.fill()

      ctx.strokeStyle = '#8d6e63'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.restore()

      if (progress < 1) {
        requestAnimationFrame(animateSpin)
      } else {
        setIsSpinning(false)
        
        // Calculate which number is selected (pointer is at top, angle = -Math.PI/2)
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
        
        // Pointer is at top (-Math.PI/2 or 3*Math.PI/2)
        // We need to find which segment's center is pointing upward
        // The pointer points to -Math.PI/2, but segments rotate, so we need to find
        // which segment center, when rotated, aligns with the pointer
        const pointerAngle = (3 * Math.PI) / 2 // Top position
        
        // Calculate angle from center to pointer (fixed at top)
        // Find which segment contains this angle after rotation
        // We need to reverse the rotation to find the original segment
        let selectedIndex = 0
        let minDiff = Infinity
        
        for (let i = 0; i < segmentCount; i++) {
          // Segment center angle in the rotated coordinate system
          const segmentCenterAngle = (i * anglePerSegment + anglePerSegment / 2 + normalizedRotation) % (2 * Math.PI)
          
          // Calculate difference to pointer angle
          let diff = Math.abs(segmentCenterAngle - pointerAngle)
          // Handle wrap-around
          diff = Math.min(diff, 2 * Math.PI - diff)
          
          if (diff < minDiff) {
            minDiff = diff
            selectedIndex = i
          }
        }
        
        const winner = displayNumbers[selectedIndex]
        if (winner && winner !== '') {
          setSelectedNumber(winner)
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
    }

    animateSpin()
  }

  const handleClosePopup = () => {
    setSelectedNumber(null)
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
            
            // Cập nhật ref để animation có thể tiếp tục với danh sách mới
            prizeWinnersRef.current = prizeWinners
            
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
