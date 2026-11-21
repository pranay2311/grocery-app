import OpenAI, { APIError } from 'openai'
import { z } from 'zod'
import { ReceiptReadError, ReceiptSchema, SYSTEM_PROMPT } from '../receiptSchema.js'

// LISA (AWS "LLM Inference Solution", e.g. Hochschule Hof) speaks the OpenAI API.
// Set AI_PROVIDER=lisa, LISA_BASE_URL, LISA_API_KEY and LISA_MODEL (a model that can read images) in .env.
// If LISA uses a private certificate, point NODE_EXTRA_CA_CERTS at its .pem file.
if (!process.env.LISA_BASE_URL || !process.env.LISA_API_KEY) {
  throw new Error('LISA_BASE_URL and LISA_API_KEY must be set in server/.env to use AI_PROVIDER=lisa.')
}
if (!process.env.LISA_MODEL) {
  throw new Error('LISA_MODEL is not set. Run `npm run lisa:models` to see the available models.')
}

// A shared university server can be slow when busy: give up after 75 s (the app then falls back to Gemini)
const client = new OpenAI({ apiKey: process.env.LISA_API_KEY, baseURL: process.env.LISA_BASE_URL, timeout: 75_000, maxRetries: 0 })
const jsonSchema = z.toJSONSchema(ReceiptSchema)

// Plain JSON mode first: strict json_schema mode hung on LISA with long prompts (tested 2026-11-21).
// The schema is in the system prompt and the answer is validated with zod anyway.
const FORMATS = [{ type: 'json_object' }, null]

export async function parseReceiptImage(buffer, mediaType, instructions) {
  const messages = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\nAnswer with JSON only, matching this JSON schema:\n${JSON.stringify(jsonSchema)}` },
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${mediaType};base64,${buffer.toString('base64')}` } },
        { type: 'text', text: instructions },
      ],
    },
  ]

  let response
  for (const [i, format] of FORMATS.entries()) {
    try {
      response = await client.chat.completions.create({
        model: process.env.LISA_MODEL,
        messages,
        temperature: 0,
        ...(format ? { response_format: format } : {}),
      })
      break
    } catch (err) {
      // 400 = this model doesn't accept that output format; try the next simpler one
      if (err instanceof APIError && err.status === 400 && i < FORMATS.length - 1) continue
      if (err instanceof APIError && err.status === 429) {
        throw new ReceiptReadError('Scan limit reached. Please try again later.', 429)
      }
      if (err instanceof APIError && (err.status === 401 || err.status === 403)) {
        throw new ReceiptReadError('The AI service rejected the API key.', 503)
      }
      throw err
    }
  }

  const text = response.choices[0]?.message?.content ?? ''
  try {
    return ReceiptSchema.parse(JSON.parse(extractJson(text)))
  } catch {
    throw new ReceiptReadError('Could not read this receipt. Please try a clearer photo.')
  }
}

// Models without a JSON mode sometimes wrap the answer in ```json fences or add a sentence around it
function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1]
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  return start >= 0 && end > start ? text.slice(start, end + 1) : text
}
