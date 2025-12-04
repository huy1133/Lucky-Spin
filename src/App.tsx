import { type FormEvent, useState } from 'react'
import './App.css'

function App() {
  const [isLogin, setIsLogin] = useState<boolean>(false)
  const [email, setEmail] = useState<string>('')
  const [luckyNumber, setLuckyNumber] = useState<string>('')
  const [message, setMessage] = useState<string>('')

  const toggleLogin = () => {
    setIsLogin(!isLogin)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(`Đăng ký thành công với email ${email} và số may mắn ${luckyNumber}!`)
  }

  return (
    <>
      {/* Đã đăng nhập */}
      {!isLogin && (
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
            {message && <p className="form-message">{message}</p>}
            <button type="submit" className="submit-button">
              Đăng ký
            </button>
          </form>
          <button className="switch-button" onClick={toggleLogin}>
            Go to console
          </button>
        </div>
      )}

      {/* Chưa đăng nhập */}
      {isLogin && (
        <div className="signed-in-page">
          <button className="switch-button" onClick={toggleLogin}>
            Back to registration
          </button>
        </div>
      )}
    </>
  )
}

export default App
