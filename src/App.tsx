import { useState } from 'react'
import './App.css'

function App() {
  const [isLogin, setIsLogin] = useState<boolean>(false)

  const toggleLogin = () => {
    setIsLogin(!isLogin)
  }

  return (
    <>
      {/* Đã đăng nhập */}
      {isLogin && (
        <div className="signed-in-page">
          <button className="switch-button" onClick={toggleLogin}>
            Switch to Black Page
          </button>
        </div>
      )}

      {/* Chưa đăng nhập */}
      {!isLogin && (
        <div className="signed-out-page">
          <button className="switch-button" onClick={toggleLogin}>
            Switch to White Page
          </button>
        </div>
      )}
    </>
  )
}

export default App
