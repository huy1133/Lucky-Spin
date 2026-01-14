import { useEffect, useState } from 'react'
import '../App.css'
import { ref, onValue, remove, set } from 'firebase/database'
import { db } from '../firebase'

interface Participant {
  luckyNumber: string
  email: string
  timestamp: number
}

type SortOption = 'number' | 'email' | 'timestamp'

function ParticipantList() {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isLocked, setIsLocked] = useState<boolean>(false)
  const [sortBy, setSortBy] = useState<SortOption>('timestamp')
  const [isMinimized, setIsMinimized] = useState<boolean>(true)

  // Load locked status from Firebase
  useEffect(() => {
    if (!db) return

    const lockedRef = ref(db, 'settings/locked')
    
    const unsubscribe = onValue(lockedRef, (snapshot) => {
      if (snapshot.exists()) {
        setIsLocked(snapshot.val() === true)
      } else {
        setIsLocked(false)
      }
    })

    return () => unsubscribe()
  }, [])

  // Load participants from Firebase
  useEffect(() => {
    if (!db) {
      setIsLoading(false)
      return
    }
  
    const defaultMailsRef = ref(db, 'settings/defaultMails')
    const registrationRef = ref(db, 'registration')
  
    let defaultMails: string[] = []
    let registrations: any = {}
  
    const unsubscribeDefaultMails = onValue(defaultMailsRef, (snapshot) => {
      defaultMails = snapshot.exists()
        ? Object.values(snapshot.val())
        : []
  
      mergeData()
    })
  
    const unsubscribeRegistration = onValue(registrationRef, (snapshot) => {
      registrations = snapshot.exists() ? snapshot.val() : {}
  
      mergeData()
    })
  
    const mergeData = () => {
      if (!defaultMails.length && !Object.keys(registrations).length) return
  
      const registrationMap = new Map<
        string,
        { luckyNumber: string; timestamp: number }
      >()
  
      Object.keys(registrations).forEach((luckyNumber) => {
        const { email, timestamp } = registrations[luckyNumber]
        registrationMap.set(email.toLowerCase(), {
          luckyNumber,
          timestamp,
        })
      })
  
      const mergedParticipants: Participant[] = defaultMails.map((email: string) => {
        const registered = registrationMap.get(email.toLowerCase())
  
        return {
          email,
          luckyNumber: registered?.luckyNumber ?? 'not registered yet',
          timestamp: registered?.timestamp ?? 0,
        }
      })
  
      setParticipants(mergedParticipants)
      setIsLoading(false)
    }
  
    return () => {
      unsubscribeDefaultMails()
      unsubscribeRegistration()
    }
  }, [db])  

  const handleToggleLock = async () => {
    if (!db) return
    
    try {
      const lockedRef = ref(db, 'settings/locked')
      await set(lockedRef, !isLocked)
    } catch (error) {
      console.error('Error toggling lock:', error)
      alert('Có lỗi xảy ra khi cập nhật trạng thái khóa')
    }
  }

  const handleDelete = async (luckyNumber: string) => {
    if (!db) return
    
    if (window.confirm('Bạn có chắc chắn muốn xóa người tham gia này?')) {
      try {
        const participantRef = ref(db, `registration/${luckyNumber}`)
        await remove(participantRef)
      } catch (error) {
        console.error('Error deleting participant:', error)
        alert('Có lỗi xảy ra khi xóa người tham gia')
      }
    }
  }

  const formatDate = (timestamp: number): string => {
    if(timestamp === 0) {
      return 'not registered yet'
    }
    const date = new Date(timestamp)
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  // Tính số người đã đăng ký
  const registeredCount = participants.filter(
    (p) => p.luckyNumber !== 'not registered yet'
  ).length
  const totalCount = participants.length

  // Sort participants based on selected option
  const sortedParticipants = (() => {
    const registeredParticipants = participants.filter(
      (p) => p.luckyNumber !== 'not registered yet'
    )
  
    const notRegisteredParticipants = participants.filter(
      (p) => p.luckyNumber === 'not registered yet'
    )
  
    const sortedRegistered = [...registeredParticipants].sort((a, b) => {
      switch (sortBy) {
        case 'number':
          return Number(a.luckyNumber) - Number(b.luckyNumber)
  
        case 'email':
          return a.email.localeCompare(b.email)
  
        case 'timestamp':
          return Number(a.timestamp) - Number(b.timestamp)
  
        default:
          return 0
      }
    })
  
    return [...sortedRegistered, ...notRegisteredParticipants]
  })()  

  return (
    <>
      {/* Minimized Floating Button */}
      {isMinimized && (
        <button
          className="participant-minimized-btn"
          onClick={() => setIsMinimized(false)}
          title="Mở danh sách tham gia"
          aria-label="Mở danh sách tham gia"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M9 12H15M12 9L12 15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M4 6C4 5.46957 4.21071 4.96086 4.58579 4.58579C4.96086 4.21071 5.46957 4 6 4H18C18.5304 4 19.0391 4.21071 19.4142 4.58579C19.7893 4.96086 20 5.46957 20 6V18C20 18.5304 19.7893 19.0391 19.4142 19.4142C19.0391 19.7893 18.5304 20 18 20H6C5.46957 20 4.96086 19.7893 4.58579 19.4142C4.21071 19.0391 4 18.5304 4 18V6Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="participant-minimized-count">{registeredCount}/{totalCount}</span>
        </button>
      )}

      {/* Full Participant List */}
      {!isMinimized && (
        <div className="participant-list-section">
          <div className="participant-list-header">
            <div className="participant-header-top">
              <h2>Danh sách tham gia</h2>
              <button
                className="participant-minimize-btn"
                onClick={() => setIsMinimized(true)}
                title="Thu nhỏ danh sách"
                aria-label="Thu nhỏ danh sách"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5 12H19"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <div className="participant-header-controls">
              <div className="participant-sort-wrapper">
                <label className="participant-sort-label">Sắp xếp:</label>
                <select
                  className="participant-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  title="Sắp xếp danh sách"
                >
                  <option value="number">Số may mắn</option>
                  <option value="email">Email</option>
                  <option value="timestamp">Thời gian</option>
                </select>
              </div>
              <span className="participant-count">{registeredCount}/{totalCount}</span>
              <button
                className={`participant-lock-toggle ${isLocked ? 'locked' : 'unlocked'}`}
                onClick={handleToggleLock}
                title={isLocked ? 'Mở khóa danh sách' : 'Khóa danh sách'}
                aria-label={isLocked ? 'Mở khóa danh sách' : 'Khóa danh sách'}
              />
            </div>
          </div>
          
          {isLoading ? (
            <div className="participant-list-loading">Đang tải...</div>
          ) : participants.length === 0 ? (
            <div className="participant-list-empty">Chưa có người tham gia</div>
          ) : (
            <div className="participant-list-content">
              {sortedParticipants.map((participant) => (
                <div key={participant.email} className="participant-item">
                  <div className="participant-info">
                    <div className="participant-top-row">
                      <span className="participant-email">{participant.email}</span>
                      <span className="participant-time">
                        {formatDate(participant.timestamp)}
                      </span>
                    </div>
                    <div className="participant-lucky-number">
                      Số: {participant.luckyNumber}
                    </div>
                  </div>
                  <button
                    className="participant-delete-btn"
                    onClick={() => handleDelete(participant.luckyNumber)}
                    title="Xóa người tham gia"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M3 6H5H21M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M10 11V17"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M14 11V17"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

export default ParticipantList
