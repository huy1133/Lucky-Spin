import { type FormEvent, useState, useEffect } from 'react'
import '../App.css'
import { ref, get, set, onValue } from 'firebase/database'
import { db } from '../firebase'

interface LookupResult {
  email: string
  luckyNumber: string
  timestamp: number
}

function RegistrationPage() {
  const [email, setEmail] = useState<string>('')
  const [luckyNumber, setLuckyNumber] = useState<string>('')
  const [message, setMessage] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isLocked, setIsLocked] = useState<boolean>(false)
  const [lookupEmail, setLookupEmail] = useState<string>('')
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null)
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false)
  const [showLookupModal, setShowLookupModal] = useState<boolean>(false)

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')
    setIsLoading(true)

    if (!db) {
      setMessage('Opps! có lỗi xảy ra, vui lòng thử lại')
      setIsLoading(false)
      return
    }

    // Check if registration is locked
    if (isLocked) {
      setMessage('Opps! đã khóa đăng ký, vui lòng thử lại sau')
      setIsLoading(false)
      return
    }

    try {
      const emailTrimmed = email.trim().toLowerCase()
      const numberTrimmed = luckyNumber.trim()

      const numberRef = ref(db, `registration/${numberTrimmed}`)
      const numberSnapshot = await get(numberRef)

      if (numberSnapshot.exists()) {
        setMessage('Số đã được sử dụng')
        setIsLoading(false)
        return
      }

      const registrationRef = ref(db, 'registration')
      const allRegistrations = await get(registrationRef)

      if (allRegistrations.exists()) {
        const data = allRegistrations.val()
        const isEmailUsed = Object.values(data).some(
          (item: any) => item.email === emailTrimmed
        )

        if (isEmailUsed) {
          setMessage('Email đã được đăng ký')
          setIsLoading(false)
          return
        }
      }

      await set(numberRef, {
        email: emailTrimmed,
        timestamp: Date.now(),
      })

      setMessage(`Đăng ký thành công với email ${emailTrimmed} và số may mắn ${numberTrimmed}!`)
      setEmail('')
      setLuckyNumber('')
    } catch (error: any) {
      console.error('Error registering:', error)
      setMessage('Opps! có lỗi xảy ra, vui lòng thử lại')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenLookup = () => {
    setShowLookupModal(true)
    setLookupEmail('')
    setMessage('')
  }

  const handleCloseLookupModal = () => {
    setShowLookupModal(false)
    setLookupEmail('')
    setMessage('')
  }

  const handleLookup = async () => {
    if (!lookupEmail.trim()) {
      setMessage('Vui lòng nhập email để tra cứu')
      return
    }

    setIsLookingUp(true)
    setMessage('')

    if (!db) {
      setMessage('Opps! có lỗi xảy ra, vui lòng thử lại')
      setIsLookingUp(false)
      return
    }

    try {
      const emailTrimmed = lookupEmail.trim().toLowerCase()
      const registrationRef = ref(db, 'registration')
      const allRegistrations = await get(registrationRef)

      if (!allRegistrations.exists()) {
        setMessage('Không tìm thấy thông tin đăng ký')
        setIsLookingUp(false)
        return
      }

      const data = allRegistrations.val()
      let found: LookupResult | null = null

      // Search for email in all registrations
      for (const [number, registration] of Object.entries(data)) {
        const reg = registration as any
        if (reg.email === emailTrimmed) {
          found = {
            email: reg.email,
            luckyNumber: number,
            timestamp: reg.timestamp,
          }
          break
        }
      }

      if (found) {
        setLookupResult(found)
        setShowLookupModal(false)
        setLookupEmail('')
      } else {
        setMessage('Không tìm thấy thông tin đăng ký với email này')
      }
    } catch (error: any) {
      console.error('Error looking up:', error)
      setMessage('Opps! có lỗi xảy ra, vui lòng thử lại')
    } finally {
      setIsLookingUp(false)
    }
  }

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const handleCloseLookupPopup = () => {
    setLookupResult(null)
  }

  return (
    <div className="signed-out-page">
      <form className="registration-form" onSubmit={handleSubmit}>
        <h2 className="form-title">Đăng ký may mắn</h2>
        {isLocked && (
          <div className="form-error" style={{ textAlign: 'center', marginBottom: '8px' }}>
            ⚠️ Danh sách đăng ký đang bị khóa. Vui lòng thử lại sau!
          </div>
        )}
        <div className="form-group">
          <label htmlFor="email" className="form-label">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="form-input"
            placeholder="Nhập email của bạn"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLocked}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="luckyNumber" className="form-label">
            Số may mắn
          </label>
          <input
            id="luckyNumber"
            type="number"
            className="form-input"
            placeholder="Nhập số may mắn của bạn"
            value={luckyNumber}
            onChange={(e) => setLuckyNumber(e.target.value)}
            disabled={isLocked}
            required
          />
        </div>
        {message && (
          <p className={message.includes('thành công') ? 'form-message' : 'form-error'}>
            {message}
          </p>
        )}
        <div className="form-buttons">
          <button 
            type="submit" 
            className="submit-button" 
            disabled={isLoading || isLocked}
          >
            {isLoading ? 'Đang xử lý...' : isLocked ? 'Đăng ký đã bị khóa' : 'Đăng ký'}
          </button>
          <button 
            type="button" 
            className="lookup-button" 
            onClick={handleOpenLookup}
          >
            Tra cứu
          </button>
        </div>
      </form>

      {/* Lookup Form Modal */}
      {showLookupModal && (
        <div className="lookup-modal-overlay" onClick={handleCloseLookupModal}>
          <div className="lookup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lookup-modal-content">
              <h3 className="lookup-modal-title">Tra cứu thông tin đăng ký</h3>
              <div className="form-group">
                <label htmlFor="lookupEmail" className="form-label">
                  Email
                </label>
                <input
                  id="lookupEmail"
                  type="email"
                  className="form-input"
                  placeholder="Nhập email để tra cứu"
                  value={lookupEmail}
                  onChange={(e) => setLookupEmail(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleLookup()
                    }
                  }}
                  autoFocus
                />
              </div>
              {message && !message.includes('thành công') && (
                <p className="lookup-error-message">
                  {message}
                </p>
              )}
              <div className="lookup-modal-buttons">
                <button
                  type="button"
                  className="lookup-submit-button"
                  onClick={handleLookup}
                  disabled={isLookingUp}
                >
                  {isLookingUp ? 'Đang tra cứu...' : 'Tra cứu'}
                </button>
                <button
                  type="button"
                  className="lookup-cancel-button"
                  onClick={handleCloseLookupModal}
                  disabled={isLookingUp}
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lookup Result Popup */}
      {lookupResult && (
        <div className="lookup-modal-overlay" onClick={handleCloseLookupPopup}>
          <div className="lookup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lookup-modal-content">
              <h3 className="lookup-modal-title">Thông tin đã đăng ký</h3>
              <div className="lookup-result-info">
                <div className="lookup-result-item">
                  <span className="lookup-result-label">Email:</span>
                  <span className="lookup-result-value">{lookupResult.email}</span>
                </div>
                <div className="lookup-result-item">
                  <span className="lookup-result-label">Số may mắn:</span>
                  <span className="lookup-result-value">{lookupResult.luckyNumber}</span>
                </div>
                <div className="lookup-result-item">
                  <span className="lookup-result-label">Thời gian đăng ký:</span>
                  <span className="lookup-result-value">{formatDate(lookupResult.timestamp)}</span>
                </div>
              </div>
              <div className="lookup-modal-buttons">
                <button className="lookup-submit-button" onClick={handleCloseLookupPopup}>
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RegistrationPage

