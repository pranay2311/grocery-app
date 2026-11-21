import { loadCatalog, SAME_PRODUCT_RULES } from './productMatching.js'
import { ReceiptReadError } from './receiptSchema.js'

// Picks the AI provider from AI_PROVIDER in .env: "gemini" (default, free tier), "claude" (paid) or "lisa" (OpenAI-compatible).
// Providers are loaded on first use, so only the chosen provider's API key is required.
const PROVIDERS = {
  gemini: () => import('./providers/gemini.js'),
  claude: () => import('./providers/claude.js'),
  lisa: () => import('./providers/lisa.js'),
}

const loaded = new Map()

function loadProvider(name) {
  if (!PROVIDERS[name]) throw new Error(`Unknown AI provider "${name}". Use "gemini", "claude" or "lisa".`)
  if (!loaded.has(name)) {
    loaded.set(
      name,
      PROVIDERS[name]().catch((err) => {
        loaded.delete(name) // allow a retry after fixing .env
        throw err
      }),
    )
  }
  return loaded.get(name)
}

// Main provider, plus an optional backup used when the main one fails or times out.
// Default backup: Gemini, when the main provider is something else and a Gemini key exists.
function providerNames() {
  const main = (process.env.AI_PROVIDER || 'gemini').toLowerCase()
  const fallback = (process.env.AI_FALLBACK_PROVIDER ?? (main !== 'gemini' && process.env.GEMINI_API_KEY ? 'gemini' : '')).toLowerCase()
  return fallback && fallback !== 'none' && fallback !== main ? [main, fallback] : [main]
}

async function readWithFallback(buffer, mediaType, instructions) {
  const names = providerNames()
  for (const [i, name] of names.entries()) {
    try {
      const provider = await loadProvider(name)
      return await provider.parseReceiptImage(buffer, mediaType, instructions)
    } catch (err) {
      if (i === names.length - 1) throw err
      console.warn(`Receipt reading with ${name} failed (${err.message}); trying ${names[i + 1]}`)
    }
  }
}

function buildInstructions(catalogText) {
  if (!catalogText) return 'Extract this receipt. There are no known products yet, so use -1 for existingProduct.'
  return `Extract this receipt.

For every item, check whether it is already one of these known products and put its number in existingProduct (-1 if none matches).
${SAME_PRODUCT_RULES}

Known products:
${catalogText}`
}

export async function parseReceiptImage(buffer, mediaType) {
  const catalog = await loadCatalog()
  const receipt = await readWithFallback(buffer, mediaType, buildInstructions(catalog.text))
  if (receipt.items.length === 0) {
    throw new ReceiptReadError('No products found on this photo. Is it a supermarket receipt?')
  }

  // Turn the AI's list number into a real product id the review screen can show and change
  receipt.items = receipt.items.map(({ existingProduct, ...item }) => {
    const match = catalog.products[existingProduct]
    return match ? { ...item, productId: String(match._id), matchedName: match.name } : item
  })
  return receipt
}
