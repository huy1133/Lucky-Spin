import { useEffect, useRef, useState } from 'react'
import { FiVolume2, FiVolumeX } from 'react-icons/fi'
import '../App.css'

interface BackgroundMusicProps {
  videoId: string
}

export default function BackgroundMusic({ videoId }: BackgroundMusicProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [volume, setVolume] = useState(50) // Volume mặc định 50%
  const [isHovering, setIsHovering] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const playerReadyRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Hàm điều chỉnh volume
  const handleVolumeChange = (newVolume: number) => {
    if (!iframeRef.current || !playerReadyRef.current) return

    const iframe = iframeRef.current
    const playerWindow = iframe.contentWindow
    if (!playerWindow) return

    // YouTube volume range: 0-100
    const clampedVolume = Math.max(0, Math.min(100, newVolume))
    setVolume(clampedVolume)

    // Gửi lệnh setVolume
    playerWindow.postMessage(
      JSON.stringify({
        event: 'command',
        func: 'setVolume',
        args: [clampedVolume],
      }),
      'https://www.youtube.com'
    )

    // Nếu volume > 0, unmute; nếu volume = 0, mute
    if (clampedVolume > 0) {
      playerWindow.postMessage(
        JSON.stringify({
          event: 'command',
          func: 'unMute',
        }),
        'https://www.youtube.com'
      )
    } else {
      playerWindow.postMessage(
        JSON.stringify({
          event: 'command',
          func: 'mute',
        }),
        'https://www.youtube.com'
      )
    }
  }

  // Hàm toggle nhạc
  const togglePlay = () => {
    if (!iframeRef.current) {
      console.log('Iframe chưa sẵn sàng')
      return
    }

    const iframe = iframeRef.current
    const playerWindow = iframe.contentWindow
    if (!playerWindow) return

    if (!isPlaying) {
      // Bật nhạc: play và unmute với volume hiện tại
      if (volume > 0) {
        playerWindow.postMessage(
          JSON.stringify({
            event: 'command',
            func: 'setVolume',
            args: [volume],
          }),
          'https://www.youtube.com'
        )
        playerWindow.postMessage(
          JSON.stringify({
            event: 'command',
            func: 'unMute',
          }),
          'https://www.youtube.com'
        )
      }
      playerWindow.postMessage(
        JSON.stringify({
          event: 'command',
          func: 'playVideo',
        }),
        'https://www.youtube.com'
      )
      setIsPlaying(true)
    } else {
      // Tắt nhạc: pause hoặc mute
      playerWindow.postMessage(
        JSON.stringify({
          event: 'command',
          func: 'pauseVideo',
        }),
        'https://www.youtube.com'
      )
      setIsPlaying(false)
    }
  }

  // Lắng nghe message từ YouTube iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Chỉ xử lý message từ YouTube
      if (event.origin !== 'https://www.youtube.com') return

      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data

        if (data.event === 'onReady') {
          playerReadyRef.current = true
          setIsReady(true)
          // Set volume ban đầu
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
              JSON.stringify({
                event: 'command',
                func: 'setVolume',
                args: [volume],
              }),
              'https://www.youtube.com'
            )
            // Tự động play khi ready (muted)
            iframeRef.current.contentWindow.postMessage(
              JSON.stringify({
                event: 'command',
                func: 'playVideo',
              }),
              'https://www.youtube.com'
            )
            // Bắt đầu với muted, user sẽ unmute khi click
            setIsPlaying(false)
          }
        } else if (data.event === 'onStateChange') {
          // 0 = ended, 1 = playing, 2 = paused, 3 = buffering, 5 = cued
          if (data.info === 1) {
            // Đang play
          } else if (data.info === 2 || data.info === 0) {
            // Paused hoặc ended
          }
        }
      } catch (error) {
        // Ignore parse errors
      }
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  // Đợi một chút sau khi iframe load để đảm bảo player sẵn sàng
  useEffect(() => {
    const timer = setTimeout(() => {
      if (iframeRef.current && !playerReadyRef.current) {
        // Thử gửi lệnh play sau 2 giây (muted)
        const iframe = iframeRef.current
        const playerWindow = iframe.contentWindow
        if (playerWindow) {
          // Set volume trước
          playerWindow.postMessage(
            JSON.stringify({
              event: 'command',
              func: 'setVolume',
              args: [volume],
            }),
            'https://www.youtube.com'
          )
          playerWindow.postMessage(
            JSON.stringify({
              event: 'command',
              func: 'playVideo',
            }),
            'https://www.youtube.com'
          )
          // Bắt đầu với muted
          setIsReady(true)
          playerReadyRef.current = true
        }
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [volume])

  return (
    <div
      ref={containerRef}
      className="music-control-container"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Nút loa */}
      <button
        onClick={togglePlay}
        className="music-button"
        title={isPlaying ? 'Tắt nhạc' : 'Bật nhạc'}
        aria-label={isPlaying ? 'Tắt nhạc' : 'Bật nhạc'}
        disabled={!isReady}
      >
        {isPlaying ? <FiVolume2 /> : <FiVolumeX />}
      </button>

      {/* Slider volume - chỉ hiển thị khi hover và đang phát nhạc */}
      {isHovering && isPlaying && (
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => handleVolumeChange(Number(e.target.value))}
          className="music-volume-slider"
          title={`Volume: ${volume}%`}
        />
      )}

      {/* Nhạc YouTube ẩn - đặt ngoài màn hình nhưng có kích thước đủ để player hoạt động */}
      <div
        style={{
          position: 'fixed',
          top: '-9999px',
          left: '-9999px',
          width: '320px',
          height: '240px',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      >
        <iframe
          ref={iframeRef}
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&controls=0&modestbranding=1&enablejsapi=1&mute=1&origin=${window.location.origin}`}
          title="Background Music"
          frameBorder="0"
          allow="autoplay; encrypted-media"
          allowFullScreen
          width="320"
          height="240"
        />
      </div>
    </div>
  )
}
