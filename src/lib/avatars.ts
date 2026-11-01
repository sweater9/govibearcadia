/** Avatars: a glyph on a colour, unlocked by level. Cosmetic and private: they live on this device and are never sent anywhere. */

export type AvatarId = string
export type Avatar = { id: AvatarId; name: string; glyph: string; from: string; to: string; level: number }

export const AVATARS: readonly Avatar[] = [
  { id: 'spark', name: 'Spark', glyph: '✦', from: '#8b5cf6', to: '#22d3ee', level: 1 },
  { id: 'orbit', name: 'Orbit', glyph: '◎', from: '#f43f5e', to: '#fb923c', level: 1 },
  { id: 'wave', name: 'Wave', glyph: '∿', from: '#a3e635', to: '#16a34a', level: 1 },
  { id: 'cross', name: 'Cross', glyph: '✕', from: '#22d3ee', to: '#8b5cf6', level: 1 },
  { id: 'anchor', name: 'Anchor', glyph: '⚓', from: '#0ea5e9', to: '#4f46e5', level: 2 },
  { id: 'disc', name: 'Disc', glyph: '◍', from: '#ef4444', to: '#facc15', level: 2 },
  { id: 'burst', name: 'Burst', glyph: '✹', from: '#34d399', to: '#0d9488', level: 3 },
  { id: 'prism', name: 'Prism', glyph: '◇', from: '#a78bfa', to: '#ec4899', level: 3 },
  { id: 'sun', name: 'Sun', glyph: '☀', from: '#facc15', to: '#fb7185', level: 5 },
  { id: 'crown', name: 'Crown', glyph: '♛', from: '#f59e0b', to: '#b45309', level: 5 },
  { id: 'flip', name: 'Flip', glyph: '⇅', from: '#38bdf8', to: '#6366f1', level: 8 },
  { id: 'star', name: 'Star', glyph: '★', from: '#fde047', to: '#a855f7', level: 8 },
]

export const DEFAULT_AVATAR: AvatarId = 'spark'
export const getAvatar = (id: unknown): Avatar | undefined => AVATARS.find((a) => a.id === id)
export const isAvatarId = (v: unknown): v is AvatarId => getAvatar(v) !== undefined
export const isUnlocked = (id: AvatarId, level: number): boolean => level >= (getAvatar(id)?.level ?? Infinity)

/** The avatar to actually show: the stored choice if it exists and is unlocked, otherwise the default. */
export const resolveAvatar = (stored: unknown, level: number): Avatar => {
  const a = getAvatar(stored)
  return a && level >= a.level ? a : getAvatar(DEFAULT_AVATAR)!
}

// ---- browser layer ---------------------------------------------------------------------------------

const KEY = 'govibearcadia.avatar'

export function storedAvatar(): AvatarId | null {
  try {
    const v = localStorage.getItem(KEY)
    return isAvatarId(v) ? v : null
  } catch {
    return null
  }
}

/** Remembers the choice. Storage may be unavailable; the avatar still shows for this visit. */
export function saveAvatar(id: AvatarId): void {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* private mode or blocked storage: the choice just won't persist */
  }
}
