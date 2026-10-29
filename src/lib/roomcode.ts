/** Room codes: 6 characters with no look-alikes (no 0/O, 1/I/L). Pure, shared by the client and the Worker. */

export const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const ROOM_CODE_LENGTH = 6
const PATTERN = new RegExp(`^[${ROOM_ALPHABET}]{${ROOM_CODE_LENGTH}}$`)

/** Turns whatever a person typed or pasted into a candidate code (trims, uppercases, drops spaces and dashes). */
export const normaliseRoomCode = (input: string): string => input.toUpperCase().replace(/[\s-]/g, '')

export const isRoomCode = (value: unknown): value is string => typeof value === 'string' && PATTERN.test(value)

/** A random code from the supplied byte source (use `crypto.getRandomValues`). Rejection sampling keeps it unbiased. */
export function makeRoomCode(fill: (bytes: Uint8Array) => Uint8Array): string {
  const limit = 256 - (256 % ROOM_ALPHABET.length)
  let code = ''
  while (code.length < ROOM_CODE_LENGTH) {
    for (const b of fill(new Uint8Array(16))) {
      if (b < limit && code.length < ROOM_CODE_LENGTH) code += ROOM_ALPHABET[b % ROOM_ALPHABET.length]
    }
  }
  return code
}
