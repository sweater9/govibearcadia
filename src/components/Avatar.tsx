import type { Avatar as AvatarData } from '../lib/avatars'

/** A round badge: the avatar's glyph on its two-colour gradient. Decorative; the name is given by the caller. */
export function Avatar({ avatar, size = 56 }: { avatar: AvatarData; size?: number }) {
  return (
    <span className="avatar" aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.5, background: `linear-gradient(135deg, ${avatar.from}, ${avatar.to})` }}>
      {avatar.glyph}
    </span>
  )
}
