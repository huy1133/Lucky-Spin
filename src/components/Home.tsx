import '../App.css'
import AnimatedNodeBackground from './AnimatedNodeBackground'
import ParticipantList from './ParticipantList'
import SpinWheel from './SpinWheel.tsx'
import PrizeList from './PrizeList.tsx'

function Home() {
  return (
    <div className="signed-in-page">
      <AnimatedNodeBackground />
      <div className="home-layout">
        <ParticipantList />
        <SpinWheel />
        <PrizeList />
      </div>
    </div>
  )
}

export default Home

