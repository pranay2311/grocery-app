import { loadCatalog, SAME_PRODUCT_RULES } from './productMatching.js'
import { parseReceiptImage as readWithGemini } from './providers/gemini.js'
import { ReceiptReadError } from './receiptSchema.js'

// Receipts are read by Google Gemini (see providers/gemini.js).

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
  const receipt = await readWithGemini(buffer, mediaType, buildInstructions(catalog.text))
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
