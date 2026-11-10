import { Volume2, VolumeX } from 'lucide-react'
import { useState } from 'react'
import { isSoundOn, playSound, setSoundOn } from '../lib/sound'

export function SoundToggle() {
  const [on, setOn] = useState(isSoundOn)
  return (
    <button
      className="icon-btn"
      aria-label={on ? 'Turn sound off' : 'Turn sound on'}
      aria-pressed={on}
      onClick={() => {
        setSoundOn(!on)
        setOn(!on)
        if (!on) playSound('tap')
      }}
    >
      {on ? <Volume2 /> : <VolumeX />}
    </button>
  )
}
