import { randomBytes } from 'crypto'

// Simple URL-safe ID generator using Node's built-in crypto
// 21 chars of base-62 → ~125 bits of entropy (safe collision-free up to ~1B IDs)
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

export function nanoid(size = 21): string {
  const bytes = randomBytes(size)
  return Array.from(bytes)
    .map(b => ALPHABET[b % ALPHABET.length])
    .join('')
}
