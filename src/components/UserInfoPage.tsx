import { useEffect, useState } from 'react'
import '../App.css'

interface RegistrationData {
  email: string
  luckyNumber: string
  timestamp: number
}

function UserInfoPage() {
  const [registrationData, setRegistrationData] = useState<RegistrationData | null>(null)

  useEffect(() => {
    // Load registration data from local storage
    const storedData = localStorage.getItem('registrationData')
    if (storedData) {
      try {
        const data = JSON.parse(storedData)
        setRegistrationData(data)
      } catch (error) {
        console.error('Error parsing registration data:', error)
      }
    }
  }, [])

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

  if (!registrationData) {
    return (
      <div className="user-info-page">
        <div className="user-info-container">
          <h2 className="user-info-title">Thông tin đăng ký</h2>
          <p className="user-info-empty">Không có thông tin đăng ký</p>
        </div>
      </div>
    )
  }

  const handleGoToRegistration = () => {
    // Clear local storage and navigate to registration page
    localStorage.removeItem('registrationData')
    window.dispatchEvent(new Event('registrationUpdated'))
    // Update local state to trigger re-render
    setRegistrationData(null)
  }

  return (
    <div className="user-info-page">
      <div className="user-info-container">
        <h2 className="user-info-title">Thông tin đã đăng ký</h2>
        <div className="user-info-content">
          <div className="user-info-item">
            <span className="user-info-label">Email:</span>
            <span className="user-info-value">{registrationData.email}</span>
          </div>
          <div className="user-info-item">
            <span className="user-info-label">Số may mắn:</span>
            <span className="user-info-value">{registrationData.luckyNumber}</span>
          </div>
          <div className="user-info-item">
            <span className="user-info-label">Thời gian đăng ký:</span>
            <span className="user-info-value">{formatDate(registrationData.timestamp)}</span>
          </div>
        </div>
        <button 
          type="button" 
          className="user-info-register-button" 
          onClick={handleGoToRegistration}
        >
          Quay về trang đăng ký
        </button>
      </div>
    </div>
  )
}

export default UserInfoPage

