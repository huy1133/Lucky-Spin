import { useState } from 'react'
import '../App.css'
import AnimatedNodeBackground from './AnimatedNodeBackground'
import ParticipantList from './ParticipantList'
import SpinWheel from './SpinWheel.tsx'
import PrizeList from './PrizeList.tsx'

interface NextSpinInfo {
  prize: string | null
  index: number | null
  number: string
}

function Home() {
  const [nextSpin, setNextSpin] = useState<NextSpinInfo>({
    prize: null,
    index: null,
    number: ''
  })
  const [isSpinning, setIsSpinning] = useState<boolean>(false)
  const [isParticipantListMinimized, setIsParticipantListMinimized] = useState<boolean>(true)

  return (
    <div className="signed-in-page">
      <AnimatedNodeBackground />
      <div className="home-layout">
        <ParticipantList onMinimizedChange={setIsParticipantListMinimized} />
        <SpinWheel nextSpin={nextSpin} setNextSpin={setNextSpin} setIsSpinning={setIsSpinning} />
        <PrizeList nextSpin={nextSpin} isSpinning={isSpinning} isParticipantListMinimized={isParticipantListMinimized} />
      </div>
    </div>
  )
}

export default Home

