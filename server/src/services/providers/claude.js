import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { ReceiptReadError, ReceiptSchema, SYSTEM_PROMPT } from '../receiptSchema.js'

// Paid option. Set AI_PROVIDER=claude and ANTHROPIC_API_KEY in .env to use it.
const client = new Anthropic() // reads ANTHROPIC_API_KEY from the environment

export async function parseReceiptImage(buffer, mediaType, instructions) {
  const response = await client.beta.messages.parse({
    model: process.env.CLAUDE_MODEL || 'claude-opus-5-5',
    max_tokens: 16000,
    // If the main model declines a request, the API retries it on a fallback model automatically.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: betaZodOutputFormat(ReceiptSchema) },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') } },
          { type: 'text', text: instructions },
        ],
      },
    ],
  })

  if (response.stop_reason === 'refusal' || !response.parsed_output) {
    throw new ReceiptReadError('Could not read this receipt. Please try a clearer photo.')
  }
  return response.parsed_output
}
