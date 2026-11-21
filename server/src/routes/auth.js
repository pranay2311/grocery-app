import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import Receipt from '../models/Receipt.js'
import User from '../models/User.js'
import { createToken, hashPassword, requireAuth, verifyPassword } from '../services/auth.js'

const router = Router()

// Slow down password guessing: 20 attempts per 15 minutes per IP
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, message: { error: 'Too many attempts. Try again in a few minutes.' } })

const Username = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Username needs at least 3 characters')
  .max(30, 'Username can have at most 30 characters')
  .regex(/^[a-z0-9._-]+$/, 'Use only letters, numbers, dot, dash or underscore')
const Credentials = z.object({
  username: Username,
  password: z.string().min(6, 'Password needs at least 6 characters').max(200),
})

// Receipts scanned in this browser before logging in (guest id) become the user's own
async function claimGuestReceipts(req, userId) {
  const guestId = req.get('X-Guest-Id')
  if (guestId) await Receipt.updateMany({ guestId, user: null }, { $set: { user: userId } })
}

const session = (user) => ({ token: createToken(user), user: { username: user.username } })

function firstIssue(err) {
  return err instanceof z.ZodError ? err.issues[0].message : null
}

// Step 1: does this username exist? Decides between "log in" and "create account".
router.post('/check', authLimiter, async (req, res) => {
  const parsed = Username.safeParse(req.body?.username)
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) })
  res.json({ exists: Boolean(await User.exists({ username: parsed.data })) })
})

router.post('/login', authLimiter, async (req, res) => {
  const parsed = Credentials.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) })
  const user = await User.findOne({ username: parsed.data.username })
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: 'Wrong username or password.' })
  }
  await claimGuestReceipts(req, user._id)
  res.json(session(user))
})

router.post('/register', authLimiter, async (req, res) => {
  const parsed = Credentials.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) })
  if (await User.exists({ username: parsed.data.username })) {
    return res.status(409).json({ error: 'This username is taken.' })
  }
  const user = await User.create({ username: parsed.data.username, passwordHash: await hashPassword(parsed.data.password) })
  await claimGuestReceipts(req, user._id)
  res.status(201).json(session(user))
})

router.get('/me', requireAuth, (req, res) => res.json({ user: { username: req.user.username } }))

export default router
