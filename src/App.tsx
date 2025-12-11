import { useState, useEffect } from 'react'
import './App.css'
import LoginPage from './components/LoginPage'
import RegistrationPage from './components/RegistrationPage'
import Home from './components/Home'
import UserInfoPage from './components/UserInfoPage'
import { auth } from './firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'

function App() {
  const [isConsole, setIsConsole] = useState<boolean>(false)
  const [isSignedIn, setIsSignedIn] = useState<boolean>(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true)
  const [hasRegistrationData, setHasRegistrationData] = useState<boolean>(false)

  // Check local storage for registration data
  useEffect(() => {
    const storedData = localStorage.getItem('registrationData')
    setHasRegistrationData(!!storedData)
  }, [])

  // Listen to auth state changes
  useEffect(() => {
    if (!auth) {
      setIsCheckingAuth(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsSignedIn(!!user)
      // When user signs in, automatically show Home (console)
      if (user) {
        setIsConsole(true)
      } else {
        // When user signs out, go back to registration page
        setIsConsole(false)
      }
      setIsCheckingAuth(false)
    })

    return () => unsubscribe()
  }, [])

  // Listen for storage changes to update hasRegistrationData
  useEffect(() => {
    const handleStorageChange = () => {
      const storedData = localStorage.getItem('registrationData')
      setHasRegistrationData(!!storedData)
    }

    window.addEventListener('storage', handleStorageChange)
    // Also listen for custom event from RegistrationPage
    window.addEventListener('registrationUpdated', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('registrationUpdated', handleStorageChange)
    }
  }, [])

  const toggleConsole = () => {
    setIsConsole(!isConsole)
  }

  const handleLogout = async () => {
    if (auth) {
      try {
        await signOut(auth)
      } catch (error) {
        console.error('Error signing out:', error)
      }
    }
  }
  
  // Show loading while checking auth state
  if (isCheckingAuth) {
    return (
      <div className="login-page">
        <div className="login-form" style={{ textAlign: 'center' }}>
          <p style={{ color: '#ffffff', margin: 0 }}>Đang tải...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {!isSignedIn && (
        <>
          {!isConsole && (
            hasRegistrationData ? <UserInfoPage /> : <RegistrationPage />
          )}
          {isConsole && <LoginPage />}
        </>
      )}

      {isSignedIn && (
        <>
          {!isConsole && <RegistrationPage />}

          {isConsole && <Home />}
        </>
      )}
      {isSignedIn && (
        <button className="logout-button" onClick={handleLogout} title="Đăng xuất">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
      <div className="app-controls">
        {isSignedIn && (
          <button className="switch-button" onClick={toggleConsole}>
            {isConsole ? 'Back to registration' : 'Go to console'}
          </button>
        )}
        {!isSignedIn && (
          <button className="switch-button" onClick={toggleConsole}>
            {isConsole ? 'Back to registration' : 'Go to console'}
          </button>
        )}
      </div>
    </>
  )
}

export default App
