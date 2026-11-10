import { Download, Share, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { canPromptInstall, dismissInstall, installDismissed, isIosSafari, isStandalone, onInstallChange, promptInstall } from '../lib/install'

/** A small, dismissible card: install the arcade like an app. Hidden once installed, when dismissed, or where the browser cannot install. */
export function InstallPrompt() {
  const [, tick] = useState(0)
  const [hidden, setHidden] = useState(installDismissed)
  useEffect(() => onInstallChange(() => tick((n) => n + 1)), [])
  if (hidden || isStandalone()) return null
  const ios = isIosSafari()
  if (!ios && !canPromptInstall()) return null
  return (
    <section className="install-card" aria-label="Install the arcade">
      <div>
        <strong>Play it like an app</strong>
        <p>
          {ios ? (
            <>Tap <Share size={14} aria-hidden="true" /> Share, then “Add to Home Screen”. It opens full screen and works offline.</>
          ) : (
            'Add it to your home screen. It opens full screen and works offline.'
          )}
        </p>
      </div>
      {!ios ? (
        <button className="primary-btn" onClick={() => void promptInstall()}>
          <Download size={16} /> Install
        </button>
      ) : null}
      <button
        className="icon-btn"
        aria-label="Dismiss install suggestion"
        onClick={() => {
          dismissInstall()
          setHidden(true)
        }}
      >
        <X size={16} />
      </button>
    </section>
  )
}
