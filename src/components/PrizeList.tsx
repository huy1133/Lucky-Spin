import { useState, useEffect, useRef } from 'react'
import '../App.css'
import { ref, set, onValue } from 'firebase/database'
import { db } from '../firebase'

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
}

function PrizeList({ nextSpin }: PrizeListProps) {
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
  const [tempPrizeCounts, setTempPrizeCounts] = useState<PrizeCounts>(prizeCounts)
  const [spinConfig, setSpinConfig] = useState<{ duration: number; turns: number }>({
    duration: 20000,
    turns: 15
  })
  const [tempSpinConfig, setTempSpinConfig] = useState<{ duration: number; turns: number }>({
    duration: 20000,
    turns: 15
  })
  const hasLoadedWinnersRef = useRef<boolean>(false)

  // Thứ tự hiển thị từ cao xuống thấp (tháp)
  const prizeOrder: (keyof PrizeCounts)[] = [
    'Giải đặc biệt',
    'Giải nhất',
    'Giải nhì',
    'Giải ba',
    'Giải khuyến khích'
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

  // Load spinConfig từ Firebase
  useEffect(() => {
    if (!db) return

    const spinConfigRef = ref(db, 'settings/spinConfig')
    
    const unsubscribe = onValue(spinConfigRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        setSpinConfig({
          duration: data.duration || 20000,
          turns: data.turns || 15
        })
      }
    })

    return () => unsubscribe()
  }, [])

  const handleOpenSettings = () => {
    setTempPrizeCounts({ ...prizeCounts })
    setTempSpinConfig({ ...spinConfig })
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
      
      alert('Đã lưu cài đặt giải thưởng thành công!')
    } catch (error) {
      console.error('Error saving prize counts to Firebase:', error)
      alert('Có lỗi xảy ra khi lưu cài đặt giải thưởng. Vui lòng thử lại.')
    }
  }

  // Lưu thông tin vòng quay riêng
  const handleSaveSpinConfig = async () => {
    if (!db) {
      console.error('Firebase database not available')
      return
    }

    try {
      // Lưu spinConfig lên Firebase
      const spinConfigRef = ref(db, 'settings/spinConfig')
      await set(spinConfigRef, {
        duration: tempSpinConfig.duration,
        turns: tempSpinConfig.turns
      })
      
      // Cập nhật state local
      setSpinConfig({ ...tempSpinConfig })
      
      alert('Đã lưu cài đặt vòng quay thành công!')
    } catch (error) {
      console.error('Error saving spin config to Firebase:', error)
      alert('Có lỗi xảy ra khi lưu cài đặt vòng quay. Vui lòng thử lại.')
    }
  }

  const handlePrizeCountChange = (prize: keyof PrizeCounts, value: number) => {
    if (value < 0) return
    setTempPrizeCounts({
      ...tempPrizeCounts,
      [prize]: value
    })
  }

  const handleSpinConfigChange = (field: 'duration' | 'turns', value: number) => {
    if (value < 0) return
    setTempSpinConfig({
      ...tempSpinConfig,
      [field]: value
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
                    const displayValue = isSpinningThis ? spinningInfo.number : (winner || '???')
                    
                    return (
                      <div 
                        key={index} 
                        className={`prize-number-box ${isSpinningThis ? 'spinning' : ''}`}
                      >
                        {displayValue}
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
              <h3>Cài đặt số lượng giải thưởng</h3>
              <button className="prize-settings-close" onClick={handleCloseSettings}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <div className="prize-settings-content">
              {prizeOrder.map((prize) => (
                <div key={prize} className="prize-setting-item">
                  <label className="prize-setting-label">{prize}</label>
                  <div className="prize-setting-controls">
                    <button
                      className="prize-setting-button"
                      onClick={() => handlePrizeCountChange(prize, tempPrizeCounts[prize] - 1)}
                      disabled={tempPrizeCounts[prize] <= 0}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      className="prize-setting-input"
                      value={tempPrizeCounts[prize]}
                      onChange={(e) => handlePrizeCountChange(prize, parseInt(e.target.value) || 0)}
                      min="0"
                    />
                    <button
                      className="prize-setting-button"
                      onClick={() => handlePrizeCountChange(prize, tempPrizeCounts[prize] + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
              
              {/* Nút lưu riêng cho giải thưởng */}
              <div style={{ 
                marginTop: '16px', 
                display: 'flex', 
                gap: '12px', 
                justifyContent: 'flex-end' 
              }}>
                <button 
                  className="prize-settings-save" 
                  onClick={handleSavePrizeSettings}
                  style={{ fontSize: '14px', padding: '8px 16px' }}
                >
                  Lưu cài đặt giải thưởng
                </button>
              </div>
              
              {/* Phần cài đặt vòng quay */}
              <div style={{ 
                marginTop: '24px', 
                paddingTop: '24px', 
                borderTop: '2px solid #e0e0e0' 
              }}>
                <h4 style={{ 
                  margin: '0 0 16px 0', 
                  fontSize: '16px', 
                  fontWeight: 700, 
                  color: '#333' 
                }}>
                  Cài đặt vòng quay
                </h4>
                
                <div className="prize-setting-item">
                  <label className="prize-setting-label">Thời gian quay (ms)</label>
                  <div className="prize-setting-controls">
                    <button
                      className="prize-setting-button"
                      onClick={() => handleSpinConfigChange('duration', tempSpinConfig.duration - 1000)}
                      disabled={tempSpinConfig.duration <= 1000}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      className="prize-setting-input"
                      style={{ width: '100px' }}
                      value={tempSpinConfig.duration}
                      onChange={(e) => handleSpinConfigChange('duration', parseInt(e.target.value) || 1000)}
                      min="1000"
                      step="1000"
                    />
                    <button
                      className="prize-setting-button"
                      onClick={() => handleSpinConfigChange('duration', tempSpinConfig.duration + 1000)}
                    >
                      +
                    </button>
                  </div>
                </div>
                
                <div className="prize-setting-item">
                  <label className="prize-setting-label">Số vòng quay</label>
                  <div className="prize-setting-controls">
                    <button
                      className="prize-setting-button"
                      onClick={() => handleSpinConfigChange('turns', tempSpinConfig.turns - 1)}
                      disabled={tempSpinConfig.turns <= 1}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      className="prize-setting-input"
                      style={{ width: '100px' }}
                      value={tempSpinConfig.turns}
                      onChange={(e) => handleSpinConfigChange('turns', parseInt(e.target.value) || 1)}
                      min="1"
                    />
                    <button
                      className="prize-setting-button"
                      onClick={() => handleSpinConfigChange('turns', tempSpinConfig.turns + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
                
                {/* Nút lưu riêng cho vòng quay */}
                <div style={{ 
                  marginTop: '16px', 
                  display: 'flex', 
                  gap: '12px', 
                  justifyContent: 'flex-end' 
                }}>
                  <button 
                    className="prize-settings-save" 
                    onClick={handleSaveSpinConfig}
                    style={{ fontSize: '14px', padding: '8px 16px' }}
                  >
                    Lưu cài đặt vòng quay
                  </button>
                </div>
              </div>
            </div>
            <div className="prize-settings-footer">
              <button className="prize-settings-cancel" onClick={handleCloseSettings}>
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
