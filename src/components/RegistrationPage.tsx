import { type FormEvent, useState, useEffect, useRef } from 'react'
import '../App.css'
import { ref, get, set, onValue } from 'firebase/database'
import { db } from '../firebase'

interface LookupResult {
  email: string
  luckyNumber: string
  timestamp: number
}

const EMAIL_SUGGESTION_DOMAIN = '@rikkeisoft.com'

function RegistrationPage() {
  const [email, setEmail] = useState<string>('')
  const [luckyNumber, setLuckyNumber] = useState<string>('')
  const [message, setMessage] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isLocked, setIsLocked] = useState<boolean>(false)
  const [lookupEmail, setLookupEmail] = useState<string>('')
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false)
  const [showLookupModal, setShowLookupModal] = useState<boolean>(false)
  const [showEmailSuggestion, setShowEmailSuggestion] = useState<boolean>(false)
  const [showLookupEmailSuggestion, setShowLookupEmailSuggestion] = useState<boolean>(false)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const lookupEmailInputRef = useRef<HTMLInputElement>(null)

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

  // Helper function to check if email should show suggestion
  const shouldShowSuggestion = (emailValue: string): boolean => {
    if (!emailValue || emailValue.includes('@')) {
      return false
    }
    return true
  }

  // Helper function to get suggested email
  const getSuggestedEmail = (emailValue: string): string => {
    return emailValue + EMAIL_SUGGESTION_DOMAIN
  }

  // Handle email input change for registration form
  const handleEmailChange = (value: string) => {
    setEmail(value)
    setShowEmailSuggestion(shouldShowSuggestion(value))
  }

  // Handle lookup email input change
  const handleLookupEmailChange = (value: string) => {
    setLookupEmail(value)
    setShowLookupEmailSuggestion(shouldShowSuggestion(value))
  }

  // Apply email suggestion
  const applyEmailSuggestion = () => {
    if (showEmailSuggestion && email) {
      setEmail(getSuggestedEmail(email))
      setShowEmailSuggestion(false)
    }
  }

  // Apply lookup email suggestion
  const applyLookupEmailSuggestion = () => {
    if (showLookupEmailSuggestion && lookupEmail) {
      setLookupEmail(getSuggestedEmail(lookupEmail))
      setShowLookupEmailSuggestion(false)
    }
  }

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

      const timestamp = Date.now()
      await set(numberRef, {
        email: emailTrimmed,
        timestamp: timestamp,
      })

      // Save registration data to local storage
      const registrationData = {
        email: emailTrimmed,
        luckyNumber: numberTrimmed,
        timestamp: timestamp,
      }
      localStorage.setItem('registrationData', JSON.stringify(registrationData))
      
      // Dispatch custom event to notify App.tsx about the update
      window.dispatchEvent(new Event('registrationUpdated'))

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
    setShowLookupEmailSuggestion(false)
  }

  const handleCloseLookupModal = () => {
    setShowLookupModal(false)
    setLookupEmail('')
    setMessage('')
    setShowLookupEmailSuggestion(false)
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
        // Save registration data to local storage
        const registrationData = {
          email: found.email,
          luckyNumber: found.luckyNumber,
          timestamp: found.timestamp,
        }
        localStorage.setItem('registrationData', JSON.stringify(registrationData))
        
        // Dispatch custom event to notify App.tsx about the update
        window.dispatchEvent(new Event('registrationUpdated'))
        
        // Close modal and clear form
        setShowLookupModal(false)
        setLookupEmail('')
        setMessage('')
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


  return (
    <div className="signed-out-page">
      <form className="registration-form" onSubmit={handleSubmit}>
        <h2 className="form-title">Đăng ký số may mắn</h2>
        {isLocked && (
          <div className="form-error" style={{ textAlign: 'center', marginBottom: '8px' }}>
            ⚠️ Danh sách đăng ký đang bị khóa. Vui lòng thử lại sau!
          </div>
        )}
        <div className="form-group">
          <label htmlFor="email" className="form-label">
            Email
          </label>
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              ref={emailInputRef}
              id="email"
              type="email"
              className="form-input"
              placeholder="Nhập email của bạn"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && showEmailSuggestion) {
                  e.preventDefault()
                  applyEmailSuggestion()
                } else if (e.key === 'Tab' && showEmailSuggestion) {
                  e.preventDefault()
                  applyEmailSuggestion()
                }
              }}
              onBlur={() => {
                // Hide suggestion when input loses focus
                setTimeout(() => setShowEmailSuggestion(false), 200)
              }}
              disabled={isLocked}
              required
            />
            {showEmailSuggestion && email && (
              <div
                className="email-suggestion"
                onClick={applyEmailSuggestion}
                onMouseDown={(e) => e.preventDefault()}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: '#f0f0f0',
                  border: '1px solid #ccc',
                  borderTop: 'none',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  zIndex: 1000,
                  borderRadius: '0 0 4px 4px',
                  fontSize: '14px',
                  color: '#666',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e0e0e0'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0f0f0'
                }}
              >
                {getSuggestedEmail(email)}
              </div>
            )}
          </div>
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
                <div style={{ position: 'relative' }}>
                  <input
                    ref={lookupEmailInputRef}
                    id="lookupEmail"
                    type="email"
                    className="form-input"
                    placeholder="Nhập email để tra cứu"
                    value={lookupEmail}
                    onChange={(e) => handleLookupEmailChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (showLookupEmailSuggestion) {
                          e.preventDefault()
                          applyLookupEmailSuggestion()
                        } else {
                          handleLookup()
                        }
                      } else if (e.key === 'Tab' && showLookupEmailSuggestion) {
                        e.preventDefault()
                        applyLookupEmailSuggestion()
                      }
                    }}
                    onBlur={() => {
                      // Hide suggestion when input loses focus
                      setTimeout(() => setShowLookupEmailSuggestion(false), 200)
                    }}
                    autoFocus
                  />
                  {showLookupEmailSuggestion && lookupEmail && (
                    <div
                      className="email-suggestion"
                      onClick={applyLookupEmailSuggestion}
                      onMouseDown={(e) => e.preventDefault()}
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: '#f0f0f0',
                        border: '1px solid #ccc',
                        borderTop: 'none',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        zIndex: 1000,
                        borderRadius: '0 0 4px 4px',
                        fontSize: '14px',
                        color: '#666',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#e0e0e0'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#f0f0f0'
                      }}
                    >
                      {getSuggestedEmail(lookupEmail)}
                    </div>
                  )}
                </div>
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

    </div>
  )
}

export default RegistrationPage

