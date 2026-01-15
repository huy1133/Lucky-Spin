import { useState, useEffect, useRef } from 'react'
import '../App.css'
import { ref, set, onValue, get } from 'firebase/database'
import { db } from '../firebase'

// Hàm tách tên từ email (bỏ phần @domain.com)
const getNameFromEmail = (email: string): string => {
  if (!email) return ''
  const atIndex = email.indexOf('@')
  return atIndex > 0 ? email.substring(0, atIndex) : email
}

interface PrizeCounts {
  'Giải đặc biệt': number
  'Giải nhất': number
  'Giải nhì': number
  'Giải ba': number
  'Giải khuyến khích': number
}

interface PrizeWinners {
  'Giải đặc biệt': (string | null)[]
  'Giải nhất': (string | null)[]
  'Giải nhì': (string | null)[]
  'Giải ba': (string | null)[]
  'Giải khuyến khích': (string | null)[]
}

// Interface cho Firebase (tiếng Anh)
interface PrizeCountsFirebase {
  special: number
  first: number
  second: number
  third: number
  consolation: number
}

interface PrizeWinnersFirebase {
  special: (string | null)[]
  first: (string | null)[]
  second: (string | null)[]
  third: (string | null)[]
  consolation: (string | null)[]
}

interface NextSpinInfo {
  prize: string | null
  index: number | null
  number: string
}

interface PrizeListProps {
  nextSpin: NextSpinInfo
  isSpinning: boolean
}

function PrizeList({ nextSpin, isSpinning }: PrizeListProps) {
  const [prizeCounts, setPrizeCounts] = useState<PrizeCounts>({
    'Giải đặc biệt': 1,
    'Giải nhất': 2,
    'Giải nhì': 0,
    'Giải ba': 0,
    'Giải khuyến khích': 0
  })

  const [prizeWinners, setPrizeWinners] = useState<PrizeWinners>({
    'Giải đặc biệt': [null],
    'Giải nhất': [null, null],
    'Giải nhì': [],
    'Giải ba': [],
    'Giải khuyến khích': []
  })

  const [showSettings, setShowSettings] = useState<boolean>(false)
  const [viewNumber, setViewNumber] = useState<string | null>(null)
  const [viewEmail, setViewEmail] = useState<string | null>(null)
  const [tempPrizeCounts, setTempPrizeCounts] = useState<PrizeCounts>(prizeCounts)
  const [winnerEmails, setWinnerEmails] = useState<Record<string, string>>({}) // Map luckyNumber -> email
  const [spinConfig, setSpinConfig] = useState<Record<keyof PrizeCounts, { turns: number }>>({
    'Giải đặc biệt': { turns: 15 },
    'Giải nhất': { turns: 15 },
    'Giải nhì': { turns: 15 },
    'Giải ba': { turns: 15 },
    'Giải khuyến khích': { turns: 15 }
  })
  const [tempSpinConfig, setTempSpinConfig] = useState<Record<keyof PrizeCounts, { turns: number }>>({
    'Giải đặc biệt': { turns: 15 },
    'Giải nhất': { turns: 15 },
    'Giải nhì': { turns: 15 },
    'Giải ba': { turns: 15 },
    'Giải khuyến khích': { turns: 15 }
  })
  const hasLoadedWinnersRef = useRef<boolean>(false)

  // Thứ tự hiển thị từ thấp lên cao (giải thấp ở trên, giải cao ở dưới)
  const prizeOrder: (keyof PrizeCounts)[] = [
    'Giải khuyến khích',
    'Giải ba',
    'Giải nhì',
    'Giải nhất',
    'Giải đặc biệt'
  ]

  // Convert từ Firebase (tiếng Anh) sang local (tiếng Việt)
  const convertFromFirebase = (firebaseData: PrizeCountsFirebase): PrizeCounts => {
    const result: PrizeCounts = {
      'Giải đặc biệt': firebaseData.special || 0,
      'Giải nhất': firebaseData.first || 0,
      'Giải nhì': firebaseData.second || 0,
      'Giải ba': firebaseData.third || 0,
      'Giải khuyến khích': firebaseData.consolation || 0
    }
    return result
  }

  // Convert từ local (tiếng Việt) sang Firebase (tiếng Anh)
  const convertToFirebase = (localData: PrizeCounts): PrizeCountsFirebase => {
    return {
      special: localData['Giải đặc biệt'],
      first: localData['Giải nhất'],
      second: localData['Giải nhì'],
      third: localData['Giải ba'],
      consolation: localData['Giải khuyến khích']
    }
  }

  // Convert winners từ Firebase sang local
  const convertWinnersFromFirebase = (firebaseData: PrizeWinnersFirebase): PrizeWinners => {
    return {
      'Giải đặc biệt': firebaseData.special || [],
      'Giải nhất': firebaseData.first || [],
      'Giải nhì': firebaseData.second || [],
      'Giải ba': firebaseData.third || [],
      'Giải khuyến khích': firebaseData.consolation || []
    }
  }

  // Convert winners từ local sang Firebase
  const convertWinnersToFirebase = (localData: PrizeWinners): PrizeWinnersFirebase => {
    return {
      special: localData['Giải đặc biệt'] || [],
      first: localData['Giải nhất'] || [],
      second: localData['Giải nhì'] || [],
      third: localData['Giải ba'] || [],
      consolation: localData['Giải khuyến khích'] || []
    }
  }

  // Convert nextSpin từ props sang format local
  const getSpinningInfo = () => {
    if (!nextSpin.prize || nextSpin.index === null) {
      return { prize: null, index: null, number: '' }
    }
    
    // Convert từ tiếng Anh sang tiếng Việt
    const prizeMapping: Record<string, keyof PrizeCounts> = {
      'consolation': 'Giải khuyến khích',
      'third': 'Giải ba',
      'second': 'Giải nhì',
      'first': 'Giải nhất',
      'special': 'Giải đặc biệt'
    }
    
    const localPrize = prizeMapping[nextSpin.prize]
    if (localPrize) {
      return {
        prize: localPrize,
        index: nextSpin.index,
        number: nextSpin.number
      }
    }
    
    return { prize: null, index: null, number: '' }
  }

  // Load dữ liệu từ Firebase khi component mount
  useEffect(() => {
    if (!db) return

    const settingsRef = ref(db, 'settings/prizeCounts')
    const winnersRef = ref(db, 'settings/prizeWinners')
    
    // Load prizeWinners từ Firebase - ưu tiên load trước
    const unsubscribeWinners = onValue(winnersRef, (snapshot) => {
      hasLoadedWinnersRef.current = true
      
      if (snapshot.exists()) {
        const firebaseData = snapshot.val() as PrizeWinnersFirebase
        const localData = convertWinnersFromFirebase(firebaseData)
        
        // Set prizeWinners trực tiếp từ Firebase - đây là dữ liệu quan trọng
        setPrizeWinners(localData)
      } else {
        // Nếu Firebase không có dữ liệu winners, khởi tạo dựa trên prizeCounts hiện tại
        setPrizeCounts((currentCounts) => {
          const newPrizeWinners: PrizeWinners = {
            'Giải đặc biệt': Array(currentCounts['Giải đặc biệt']).fill(null),
            'Giải nhất': Array(currentCounts['Giải nhất']).fill(null),
            'Giải nhì': Array(currentCounts['Giải nhì']).fill(null),
            'Giải ba': Array(currentCounts['Giải ba']).fill(null),
            'Giải khuyến khích': Array(currentCounts['Giải khuyến khích']).fill(null)
          }
          setPrizeWinners(newPrizeWinners)
          return currentCounts
        })
      }
    })

    // Load prizeCounts từ Firebase
    const unsubscribeSettings = onValue(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const firebaseData = snapshot.val() as PrizeCountsFirebase
        const localData = convertFromFirebase(firebaseData)
        setPrizeCounts(localData)
        
        // Điều chỉnh prizeWinners để khớp với số lượng giải mới
        // Nếu đã load winners từ Firebase, chỉ điều chỉnh số lượng mà không ghi đè dữ liệu
        setPrizeWinners((prevWinners) => {
          // Nếu đã load winners từ Firebase, giữ nguyên dữ liệu đã có
          if (hasLoadedWinnersRef.current) {
            const newPrizeWinners: PrizeWinners = { ...prevWinners }
            Object.keys(localData).forEach((prize) => {
              const key = prize as keyof PrizeCounts
              const currentWinners = newPrizeWinners[key] || []
              const newCount = localData[key]
              
              if (currentWinners.length < newCount) {
                // Chỉ thêm null cho các vị trí mới, giữ nguyên dữ liệu đã có
                newPrizeWinners[key] = [
                  ...currentWinners,
                  ...Array(newCount - currentWinners.length).fill(null)
                ]
              } else if (currentWinners.length > newCount) {
                // Cắt bớt nếu số lượng giảm
                newPrizeWinners[key] = currentWinners.slice(0, newCount)
              }
            })
            return newPrizeWinners
          } else {
            // Nếu chưa load winners, tạo mới dựa trên prizeCounts
            const newPrizeWinners: PrizeWinners = {
              'Giải đặc biệt': Array(localData['Giải đặc biệt']).fill(null),
              'Giải nhất': Array(localData['Giải nhất']).fill(null),
              'Giải nhì': Array(localData['Giải nhì']).fill(null),
              'Giải ba': Array(localData['Giải ba']).fill(null),
              'Giải khuyến khích': Array(localData['Giải khuyến khích']).fill(null)
            }
            return newPrizeWinners
          }
        })
      }
    })

    return () => {
      unsubscribeSettings()
      unsubscribeWinners()
    }
  }, [])

  // Load emails của các winner từ Firebase
  useEffect(() => {
    if (!db) return

    // Lấy tất cả các số đã trúng
    const allWinners: string[] = []
    Object.values(prizeWinners).forEach((winners) => {
      winners.forEach((winner: string | null) => {
        if (winner && !allWinners.includes(winner)) {
          allWinners.push(winner)
        }
      })
    })

    // Load email cho từng winner
    const loadEmails = async () => {
      const emailMap: Record<string, string> = {}
      
      await Promise.all(
        allWinners.map(async (luckyNumber) => {
          try {
            const registrationRef = ref(db, `registration/${luckyNumber}`)
            const snapshot = await get(registrationRef)
            if (snapshot.exists()) {
              const data = snapshot.val()
              if (data.email) {
                emailMap[luckyNumber] = data.email
              }
            }
          } catch (error) {
            console.error(`Error loading email for ${luckyNumber}:`, error)
          }
        })
      )

      setWinnerEmails(emailMap)
    }

    if (allWinners.length > 0) {
      loadEmails()
    } else {
      setWinnerEmails({})
    }
  }, [prizeWinners])

  // Load spinConfig từ Firebase (theo từng giải)
  useEffect(() => {
    if (!db) return

    const spinConfigRef = ref(db, 'settings/spinConfig')
    
    const unsubscribe = onValue(spinConfigRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        // Convert từ Firebase format (tiếng Anh) sang local format (tiếng Việt)
        const prizeMapping: Record<string, keyof PrizeCounts> = {
          'special': 'Giải đặc biệt',
          'first': 'Giải nhất',
          'second': 'Giải nhì',
          'third': 'Giải ba',
          'consolation': 'Giải khuyến khích'
        }
        
        const newSpinConfig: Record<keyof PrizeCounts, { turns: number }> = {
          'Giải đặc biệt': { turns: 15 },
          'Giải nhất': { turns: 15 },
          'Giải nhì': { turns: 15 },
          'Giải ba': { turns: 15 },
          'Giải khuyến khích': { turns: 15 }
        }
        
        // Load từ Firebase nếu có
        Object.keys(prizeMapping).forEach((firebaseKey) => {
          const localKey = prizeMapping[firebaseKey]
          if (data[firebaseKey]) {
            newSpinConfig[localKey] = {
              turns: data[firebaseKey].turns || 15
            }
          }
        })
        
        setSpinConfig(newSpinConfig)
      }
    })

    return () => unsubscribe()
  }, [])

  const handleOpenSettings = () => {
    setTempPrizeCounts({ ...prizeCounts })
    setTempSpinConfig({
      'Giải đặc biệt': { turns: spinConfig['Giải đặc biệt'].turns },
      'Giải nhất': { turns: spinConfig['Giải nhất'].turns },
      'Giải nhì': { turns: spinConfig['Giải nhì'].turns },
      'Giải ba': { turns: spinConfig['Giải ba'].turns },
      'Giải khuyến khích': { turns: spinConfig['Giải khuyến khích'].turns }
    })
    setShowSettings(true)
  }

  const handleCloseSettings = () => {
    setShowSettings(false)
  }

  // Lưu winners lên Firebase
  const saveWinnersToFirebase = async (winners: PrizeWinners) => {
    if (!db) return

    try {
      const firebaseData = convertWinnersToFirebase(winners)
      const winnersRef = ref(db, 'settings/prizeWinners')
      await set(winnersRef, firebaseData)
    } catch (error) {
      console.error('Error saving winners to Firebase:', error)
    }
  }

  // Lưu thông tin giải thưởng riêng
  const handleSavePrizeSettings = async () => {
    if (!db) {
      console.error('Firebase database not available')
      return
    }

    try {
      // Convert sang format Firebase (tiếng Anh)
      const firebaseData = convertToFirebase(tempPrizeCounts)
      
      // Lưu lên Firebase
      const settingsRef = ref(db, 'settings/prizeCounts')
      await set(settingsRef, firebaseData)
      
      // Reset danh sách winners
      const resetWinners: PrizeWinners = {
        'Giải đặc biệt': Array(tempPrizeCounts['Giải đặc biệt']).fill(null),
        'Giải nhất': Array(tempPrizeCounts['Giải nhất']).fill(null),
        'Giải nhì': Array(tempPrizeCounts['Giải nhì']).fill(null),
        'Giải ba': Array(tempPrizeCounts['Giải ba']).fill(null),
        'Giải khuyến khích': Array(tempPrizeCounts['Giải khuyến khích']).fill(null)
      }
      
      // Lưu winners đã reset lên Firebase
      await saveWinnersToFirebase(resetWinners)
      
      // Cập nhật state local
      setPrizeCounts({ ...tempPrizeCounts })
      setPrizeWinners(resetWinners)
    } catch (error) {
      console.error('Error saving prize counts to Firebase:', error)
      throw error
    }
  }

  // Lưu thông tin vòng quay riêng (theo từng giải)
  const handleSaveSpinConfig = async () => {
    if (!db) {
      console.error('Firebase database not available')
      return
    }

    try {
      // Convert từ local format (tiếng Việt) sang Firebase format (tiếng Anh)
      const prizeMapping: Record<keyof PrizeCounts, string> = {
        'Giải đặc biệt': 'special',
        'Giải nhất': 'first',
        'Giải nhì': 'second',
        'Giải ba': 'third',
        'Giải khuyến khích': 'consolation'
      }
      
      const firebaseConfig: Record<string, { turns: number }> = {}
      
      Object.keys(tempSpinConfig).forEach((localKey) => {
        const firebaseKey = prizeMapping[localKey as keyof PrizeCounts]
        firebaseConfig[firebaseKey] = {
          turns: tempSpinConfig[localKey as keyof PrizeCounts].turns
        }
      })
      
      // Lưu spinConfig lên Firebase
      const spinConfigRef = ref(db, 'settings/spinConfig')
      await set(spinConfigRef, firebaseConfig)
      
      // Cập nhật state local
      setSpinConfig({
        'Giải đặc biệt': { turns: tempSpinConfig['Giải đặc biệt'].turns },
        'Giải nhất': { turns: tempSpinConfig['Giải nhất'].turns },
        'Giải nhì': { turns: tempSpinConfig['Giải nhì'].turns },
        'Giải ba': { turns: tempSpinConfig['Giải ba'].turns },
        'Giải khuyến khích': { turns: tempSpinConfig['Giải khuyến khích'].turns }
      })
    } catch (error) {
      console.error('Error saving spin config to Firebase:', error)
      throw error
    }
  }

  const handlePrizeCountChange = (prize: keyof PrizeCounts, value: number) => {
    if (value < 0) return
    setTempPrizeCounts({
      ...tempPrizeCounts,
      [prize]: value
    })
  }

  const handleSpinConfigChange = (prize: keyof PrizeCounts, value: number) => {
    if (value < 1) return
    setTempSpinConfig({
      ...tempSpinConfig,
      [prize]: {
        turns: value
      }
    })
  }

  // Hàm đặt lại tất cả số đã quay
  const handleResetAll = async () => {
    if (!db) {
      console.error('Firebase database not available')
      return
    }

    // Xác nhận trước khi reset
    const confirmed = window.confirm('Bạn có chắc chắn muốn xóa toàn bộ số đã quay?')
    if (!confirmed) return

    try {
      // Reset tất cả winners về null dựa trên số lượng giải hiện tại
      const resetWinners: PrizeWinners = {
        'Giải đặc biệt': Array(prizeCounts['Giải đặc biệt']).fill(null),
        'Giải nhất': Array(prizeCounts['Giải nhất']).fill(null),
        'Giải nhì': Array(prizeCounts['Giải nhì']).fill(null),
        'Giải ba': Array(prizeCounts['Giải ba']).fill(null),
        'Giải khuyến khích': Array(prizeCounts['Giải khuyến khích']).fill(null)
      }
      
      // Lưu lên Firebase
      await saveWinnersToFirebase(resetWinners)
      
      // Cập nhật state local
      setPrizeWinners(resetWinners)
      
      alert('Đã xóa toàn bộ số đã quay!')
    } catch (error) {
      console.error('Error resetting winners:', error)
      alert('Có lỗi xảy ra khi đặt lại. Vui lòng thử lại.')
    }
  }

  const handleViewNumber = async (luckyNumber: string) => {
    if (!db || !luckyNumber) return

    setViewNumber(luckyNumber)
    
    // Lấy email từ Firebase registration data
    try {
      const registrationRef = ref(db, `registration/${luckyNumber}`)
      const snapshot = await get(registrationRef)
      
      if (snapshot.exists()) {
        const data = snapshot.val()
        setViewEmail(data.email || null)
      } else {
        setViewEmail(null)
      }
    } catch (error) {
      console.error('Error fetching email:', error)
      setViewEmail(null)
    }
  }

  const handleCloseViewPopup = () => {
    setViewNumber(null)
    setViewEmail(null)
  }

  // Hàm quay lại số đã quay - đặt về null và cập nhật Firebase
  const handleUndoPrize = async (prize: keyof PrizeCounts, index: number) => {
    if (!db) {
      console.error('Firebase database not available')
      return
    }

    // Kiểm tra xem slot này có đang được quay không
    const spinningInfo = getSpinningInfo()
    const isSpinningThis = spinningInfo.prize === prize && spinningInfo.index === index
    
    if (isSpinningThis) {
      alert('Không thể quay lại khi đang quay số này. Vui lòng đợi quay xong.')
      return
    }

    // Xác nhận trước khi quay lại
    const confirmed = window.confirm('Bạn có chắc chắn muốn quay lại số này?')
    if (!confirmed) return

    try {
      // Lấy dữ liệu hiện tại từ Firebase
      const prizeWinnersDbRef = ref(db, 'settings/prizeWinners')
      const winnersSnapshot = await get(prizeWinnersDbRef)
      
      if (!winnersSnapshot.exists()) {
        alert('Không tìm thấy dữ liệu giải thưởng.')
        return
      }

      const firebaseWinners = winnersSnapshot.val() as PrizeWinnersFirebase
      const localWinners = convertWinnersFromFirebase(firebaseWinners)
      
      // Kiểm tra xem có số ở vị trí này không
      const currentWinner = localWinners[prize]?.[index]
      if (!currentWinner) {
        alert('Không có số nào ở vị trí này để quay lại.')
        return
      }

      // Đặt số về null (không xóa khỏi registration DB)
      const newWinners = { ...localWinners }
      const prizeArray = [...(newWinners[prize] || [])]
      prizeArray[index] = null
      newWinners[prize] = prizeArray

      // Convert sang Firebase format và lưu
      const firebaseData = convertWinnersToFirebase(newWinners)
      await set(prizeWinnersDbRef, firebaseData)

      // Cập nhật state local
      setPrizeWinners(newWinners)

    } catch (error) {
      console.error('Error undoing prize:', error)
      alert('Có lỗi xảy ra khi quay lại. Vui lòng thử lại.')
    }
  }

  return (
    <>
      <div className="prize-list-section">
        <div className="prize-list-header">
          <h2>Danh sách giải thưởng</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="prize-reset-button" 
              onClick={handleResetAll} 
              title="Đặt lại tất cả số đã quay"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 4V10H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M23 20V14H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14L18.36 18.36A9 9 0 0 1 3.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button className="prize-settings-button" onClick={handleOpenSettings} title="Cài đặt">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.01131 9.77251C4.28062 9.5799 4.48571 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          </div>
        </div>
        <div className="prize-list-content">
          {prizeOrder.map((prize) => {
            const winners = prizeWinners[prize] || []
            const count = prizeCounts[prize]
            
            // Chỉ hiển thị các giải có số lượng > 0
            if (count === 0) return null
            
            // Đảm bảo có đủ số lượng ô để hiển thị
            const displayWinners = Array(count).fill(null).map((_, index) => 
              winners[index] !== undefined ? winners[index] : null
            )
            
            return (
              <div key={prize} className="prize-row">
                <div className="prize-name">{prize}</div>
                <div className="prize-numbers">
                  {displayWinners.map((winner, index) => {
                    const spinningInfo = getSpinningInfo()
                    const isSpinningThis = spinningInfo.prize === prize && spinningInfo.index === index
                    const displayValue = isSpinningThis ? (spinningInfo.number || '???') : (winner || '???')
                    const hasWinner = winner !== null && winner !== undefined && !isSpinningThis
                    
                    // Lấy tên từ email nếu có
                    const winnerEmail = winner ? winnerEmails[winner] : null
                    const winnerName = winnerEmail ? getNameFromEmail(winnerEmail) : null
                    
                    return (
                      <div 
                        key={index} 
                        className={`prize-number-box ${isSpinningThis ? 'spinning' : ''} ${hasWinner && !isSpinning ? 'prize-number-won' : ''}`}
                      >
                        <div className="prize-number-content">
                          <span className="prize-number-value">{displayValue}</span>
                          {hasWinner && winnerName && (
                            <span className="prize-winner-name">{winnerName}</span>
                          )}
                        </div>
                        {hasWinner && !isSpinning && (
                          <div className="prize-number-actions">
                            <button
                              className="prize-view-btn"
                              title="Xem"
                              aria-label="Xem"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleViewNumber(winner)
                              }}
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <circle
                                  cx="12"
                                  cy="12"
                                  r="3"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                            <button
                              className="prize-undo-btn"
                              title="Quay lại"
                              aria-label="Quay lại"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleUndoPrize(prize, index)
                              }}
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M1 4V10H7"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M23 20V14H17"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14L18.36 18.36A9 9 0 0 1 3.51 15"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showSettings && (
        <div className="prize-settings-overlay" onClick={handleCloseSettings}>
          <div className="prize-settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="prize-settings-header">
              <h3>Cài đặt</h3>
            </div>
            <div className="prize-settings-content">
              <div className="prize-settings-table">
                <div className="prize-settings-table-header">
                  <div className="prize-settings-table-cell" style={{ fontWeight: 600 }}>Giải thưởng</div>
                  <div className="prize-settings-table-cell" style={{ fontWeight: 600 }}>Số lượng</div>
                  <div className="prize-settings-table-cell" style={{ fontWeight: 600 }}>Số vòng quay</div>
                </div>
                {prizeOrder.map((prize) => (
                  <div key={prize} className="prize-settings-table-row">
                    <div className="prize-settings-table-cell" data-label="Giải thưởng">
                      <label className="prize-setting-label-inline">{prize}</label>
                    </div>
                    <div className="prize-settings-table-cell" data-label="Số lượng">
                      <input
                        type="number"
                        className="prize-setting-input"
                        value={tempPrizeCounts[prize]}
                        onChange={(e) => handlePrizeCountChange(prize, parseInt(e.target.value) || 0)}
                        min="0"
                      />
                    </div>
                    <div className="prize-settings-table-cell" data-label="Số vòng quay">
                      <input
                        type="number"
                        className="prize-setting-input"
                        value={tempSpinConfig[prize].turns}
                        onChange={(e) => handleSpinConfigChange(prize, parseInt(e.target.value) || 1)}
                        min="1"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="prize-settings-footer">
              <button className="prize-settings-cancel" onClick={handleCloseSettings}>
                Đóng
              </button>
              <button 
                className="prize-settings-save" 
                onClick={async () => {
                  try {
                    await handleSavePrizeSettings()
                    await handleSaveSpinConfig()
                    alert('Đã lưu cài đặt thành công!')
                  } catch (error) {
                    alert('Có lỗi xảy ra khi lưu cài đặt. Vui lòng thử lại.')
                  }
                }}
              >
                Lưu cài đặt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Popup */}
      {viewNumber && (
        <div className="winner-popup-overlay" onClick={handleCloseViewPopup}>
          <div className="winner-popup" onClick={(e) => e.stopPropagation()}>
            <div className="winner-popup-content">
              <div className="winner-popup-title">Thông tin số may mắn</div>
              <div className="winner-popup-number">Số may mắn: {viewNumber}</div>
              {viewEmail && (
                <div className="winner-popup-email">Người dùng: {viewEmail}</div>
              )}
              {!viewEmail && (
                <div className="winner-popup-email" style={{ color: '#999', fontStyle: 'italic' }}>
                  Không tìm thấy thông tin người dùng
                </div>
              )}
              <button className="winner-popup-close" onClick={handleCloseViewPopup}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default PrizeList
