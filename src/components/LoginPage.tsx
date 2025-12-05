import { type FormEvent, useState } from 'react'
import '../App.css'

interface LoginPageProps {
  onLoginSuccess: () => void
}

function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [loginEmail, setLoginEmail] = useState<string>('')
  const [loginPassword, setLoginPassword] = useState<string>('')
  const [loginError, setLoginError] = useState<string>('')

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoginError('')

    // Simple validation - you can add real authentication here
    if (loginEmail.trim() === '' || loginPassword.trim() === '') {
      setLoginError('Vui lòng nhập đầy đủ thông tin')
      return
    }

    // Simulate login success
    onLoginSuccess()
  }

  return (
    <div className="login-page">
      <form className="login-form" onSubmit={handleLogin}>
        <h2 className="form-title">Đăng nhập</h2>
        <div className="form-group">
          <label htmlFor="loginEmail" className="form-label">
            Email
          </label>
          <input
            id="loginEmail"
            type="email"
            className="form-input"
            placeholder="Nhập email của bạn"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="loginPassword" className="form-label">
            Mật khẩu
          </label>
          <input
            id="loginPassword"
            type="password"
            className="form-input"
            placeholder="Nhập mật khẩu của bạn"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            required
          />
        </div>
        {loginError && <p className="form-error">{loginError}</p>}
        <button type="submit" className="submit-button">
          Đăng nhập
        </button>
      </form>
    </div>
  )
}

export default LoginPage

