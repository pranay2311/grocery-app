import crypto from 'node:crypto'
import { promisify } from 'node:util'
import jwt from 'jsonwebtoken'

const scrypt = promisify(crypto.scrypt)
const TOKEN_LIFETIME = '30d'

function secret() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set in server/.env')
  return process.env.JWT_SECRET
}

// Passwords are stored as a salted scrypt hash (built into Node, no extra library)
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = await scrypt(password, salt, 64)
  return `${salt}:${hash.toString('hex')}`
}

export async function verifyPassword(password, stored) {
  const [salt, hex] = stored.split(':')
  const expected = Buffer.from(hex, 'hex')
  const actual = await scrypt(password, salt, expected.length)
  return crypto.timingSafeEqual(actual, expected)
}

export function createToken(user) {
  return jwt.sign({ sub: String(user._id), username: user.username }, secret(), { expiresIn: TOKEN_LIFETIME })
}

// Express middleware: requires "Authorization: Bearer <token>" and sets req.user
export function requireAuth(req, res, next) {
  const header = req.get('Authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  try {
    const payload = jwt.verify(token, secret())
    req.user = { id: payload.sub, username: payload.username }
    next()
  } catch {
    res.status(401).json({ error: 'Please log in.' })
  }
}

// Express middleware for pages visitors may see without logging in: sets req.user only when a valid token is sent
export function optionalAuth(req, res, next) {
  const header = req.get('Authorization') || ''
  if (!header.startsWith('Bearer ')) {
    req.user = null
    return next()
  }
  return requireAuth(req, res, next) // a token was sent but is invalid/expired -> 401 so the app logs out
}
