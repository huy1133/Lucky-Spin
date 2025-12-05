import { useState } from 'react'
import './App.css'
import LoginPage from './components/LoginPage'
import RegistrationPage from './components/RegistrationPage'
import Home from './components/Home'

function App() {
  const [isConsole, setIsConsole] = useState<boolean>(false)
  const [isSignedIn, setIsSignedIn] = useState<boolean>(false)

  const toggleConsole = () => {
    setIsConsole(!isConsole)
  }

  const handleLoginSuccess = () => {
    setIsSignedIn(true)
  }
  
  return (
    <>
      {!isSignedIn && (
        <>
          {!isConsole && <RegistrationPage />}
          {isConsole && <LoginPage onLoginSuccess={handleLoginSuccess} />}
        </>
      )}

      {isSignedIn && (
        <>
          {!isConsole && <RegistrationPage />}

          {isConsole && <Home />}
        </>
      )}
      <button className="switch-button" onClick={toggleConsole}>
        {isConsole ? 'Back to registration' : 'Go to console'}
      </button>
    </>
  )
}

export default App
