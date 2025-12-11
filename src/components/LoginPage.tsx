import { type FormEvent, useState } from 'react'
import '../App.css'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'

function LoginPage() {
  const [loginEmail, setLoginEmail] = useState<string>('')
  const [loginPassword, setLoginPassword] = useState<string>('')
  const [loginError, setLoginError] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoginError('')
    setIsLoading(true)

    if (loginEmail.trim() === '' || loginPassword.trim() === '') {
      setLoginError('Vui lòng nhập đầy đủ thông tin')
      setIsLoading(false)
      return
    }

    if (!auth) {
      setLoginError('Opps! có lỗi xảy ra, vui lòng thử lại')
      setIsLoading(false)
      return
    }

    try {
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword)
      // onLoginSuccess will be called automatically by auth state listener
    } catch (error: any) {
      console.error('Error logging in:', error)
      let errorMessage = 'Opps! có lỗi xảy ra, vui lòng thử lại'
      
      if (error.code === 'auth/invalid-email') {
        errorMessage = 'Email không hợp lệ'
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'Không tìm thấy tài khoản với email này'
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Mật khẩu không đúng'
      } else if (error.code === 'auth/invalid-credential') {
        errorMessage = 'Email hoặc mật khẩu không đúng'
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Quá nhiều lần thử. Vui lòng thử lại sau'
      }
      
      setLoginError(errorMessage)
    } finally {
      setIsLoading(false)
    }
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
        <button 
          type="submit" 
          className="submit-button login-submit-button"
          disabled={isLoading}
        >
          {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  )
}

export default LoginPage

