import { ApiError, GoogleGenAI } from '@google/genai'
import { z } from 'zod'
import { ReceiptReadError, ReceiptSchema, SYSTEM_PROMPT } from '../receiptSchema.js'

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set. Add it to server/.env (get one at aistudio.google.com).')
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
const responseJsonSchema = z.toJSONSchema(ReceiptSchema)

// Models are tried in order: if one is overloaded (503) or retired (404), the next one is used.
// Run `npm run models` to see which models your key can use.
const MODELS = (process.env.GEMINI_MODELS || 'gemini-3.5-flash,gemini-3.8-flash')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean)

export async function parseReceiptImage(buffer, mediaType, instructions) {
  let response
  for (const [i, model] of MODELS.entries()) {
    try {
      response = await generate(model, buffer, mediaType, instructions)
      break
    } catch (err) {
      const canTryNext = err instanceof ApiError && [404, 500, 503].includes(err.status) && i < MODELS.length - 1
      if (canTryNext) {
        console.warn(`Gemini model ${model} failed (${err.status}), trying ${MODELS[i + 1]}`)
        continue
      }
      if (err instanceof ApiError && err.status === 429) {
        throw new ReceiptReadError('Daily free scan limit reached. Please try again later.', 429)
      }
      if (err instanceof ApiError && err.status === 503) {
        throw new ReceiptReadError('The AI service is busy right now. Please try again in a minute.', 503)
      }
      throw err
    }
  }

  try {
    return ReceiptSchema.parse(JSON.parse(response.text ?? ''))
  } catch {
    throw new ReceiptReadError('Could not read this receipt. Please try a clearer photo.')
  }
}

function generate(model, buffer, mediaType, instructions) {
  return ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: mediaType, data: buffer.toString('base64') } },
          { text: instructions },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseJsonSchema,
      temperature: 0,
    },
  })
}
