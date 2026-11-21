import { loadCatalog, SAME_PRODUCT_RULES } from './productMatching.js'
import { ReceiptReadError } from './receiptSchema.js'

// Picks the AI provider from AI_PROVIDER in .env: "gemini" (default, free tier) or "claude" (paid).
// Providers are loaded on first use, so only the chosen provider's API key is required.
const PROVIDERS = {
  gemini: () => import('./providers/gemini.js'),
  claude: () => import('./providers/claude.js'),
}

let providerPromise

function loadProvider() {
  const name = (process.env.AI_PROVIDER || 'gemini').toLowerCase()
  if (!PROVIDERS[name]) throw new Error(`Unknown AI_PROVIDER "${name}". Use "gemini" or "claude".`)
  providerPromise ??= PROVIDERS[name]().catch((err) => {
    providerPromise = undefined // allow a retry after fixing .env
    throw err
  })
  return providerPromise
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
  const [provider, catalog] = await Promise.all([loadProvider(), loadCatalog()])
  const receipt = await provider.parseReceiptImage(buffer, mediaType, buildInstructions(catalog.text))
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
