import { type FormEvent, useState } from 'react'
import '../App.css'
import { ref, get, set } from 'firebase/database'
import { db } from '../firebase'

function RegistrationPage() {
  const [email, setEmail] = useState<string>('')
  const [luckyNumber, setLuckyNumber] = useState<string>('')
  const [message, setMessage] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')
    setIsLoading(true)

    if (!db) {
      setMessage('Opps! có lỗi xảy ra, vui lòng thử lại')
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

  return (
    <div className="signed-out-page">
      <form className="registration-form" onSubmit={handleSubmit}>
        <h2 className="form-title">Đăng ký may mắn</h2>
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
            required
          />
        </div>
        {message && (
          <p className={message.includes('thành công') ? 'form-message' : 'form-error'}>
            {message}
          </p>
        )}
        <button type="submit" className="submit-button" disabled={isLoading}>
          {isLoading ? 'Đang xử lý...' : 'Đăng ký'}
        </button>
      </form>
    </div>
  )
}

export default RegistrationPage

