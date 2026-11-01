import { TOKENS } from '../games/ghata/tokens'

/** A playing piece drawn in the colour of its surroundings (`currentColor`). Decorative: the owner is named elsewhere. */
export function TokenIcon({ token }: { token: number }) {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" focusable="false" fill="currentColor" fillRule="evenodd">
      <path d={TOKENS[token].path} />
    </svg>
  )
}
