import { z } from 'zod'

// The shape every AI provider must return for a receipt.
export const ReceiptSchema = z.object({
  store: z.object({
    chain: z
      .string()
      .describe(
        'Supermarket chain. Use exactly one of these names when it matches: "Aldi Nord", "Aldi Süd", "Lidl", "REWE", "Edeka", "Netto Marken-Discount", "Netto" (only the Danish Netto with the dog logo), "Penny", "Kaufland", "Norma", "Globus", "dm", "Rossmann". Otherwise the name printed on the receipt.',
      ),
    address: z.string().describe('Street and house number of the branch, empty string if not printed'),
    postcode: z.string().describe('5-digit German postcode, empty string if not printed'),
    city: z.string().describe('City, empty string if not printed'),
  }),
  date: z.string().describe('Purchase date as YYYY-MM-DD, empty string if not readable'),
  total: z.number().describe('Final amount paid in EUR ("SUMME" / "zu zahlen")'),
  items: z.array(
    z.object({
      rawName: z.string().describe('Product text exactly as printed on the receipt'),
      name: z.string().describe('Clear German product name with size if known, e.g. "Vollmilch 3,5% 1L"'),
      nameEn: z.string().describe('The same product name in English, e.g. "Whole milk 3.5% 1L"'),
      icon: z
        .string()
        .describe('One single emoji that best pictures this specific product, e.g. 🍌 bananas, 🥛 milk, 🧀 cheese, 🥚 eggs, 🍅 tomatoes, 🧅 onions, 🥐 croissant'),
      category: z.string().describe('One of: Obst & Gemüse, Milchprodukte, Fleisch & Fisch, Brot & Backwaren, Getränke, Tiefkühl, Vorrat, Süßes & Snacks, Drogerie, Haushalt, Sonstiges'),
      quantity: z.number().describe('Number of pieces, or weight in kg / volume in l for loose goods'),
      unit: z.enum(['piece', 'kg', 'l']),
      totalPrice: z.number().describe('Final EUR amount for this line after any discount on it'),
      existingProduct: z
        .number()
        .int()
        .describe('Number of the matching product from the list of known products, or -1 if it is a new product'),
    }),
  ),
})

export const SYSTEM_PROMPT = `You read photos of German supermarket receipts (Kassenbons) and return their contents as structured data.

Receipt conventions to handle:
- Prices use a comma as decimal separator ("1,29" means 1.29 EUR). Return plain numbers.
- Weighed items look like "0,532 kg x 2,99 EUR/kg": quantity is 0.532, unit "kg", totalPrice is the line total.
- Multiples look like "2 x 0,99": quantity 2, unit "piece", totalPrice 1.98.
- Discount lines ("Rabatt", "Preisvorteil", "Aktion", negative amounts) belong to the item directly above: subtract them from that item's totalPrice instead of listing them separately.
- Skip deposit lines ("Pfand", "Leergut"), bag fees, payment lines, tax summaries (MwSt) and loyalty points.
- Expand abbreviations into a readable German product name in "name", but keep "rawName" exactly as printed.
If something is unreadable, make your best guess; the user reviews everything before it is saved.`

// Keep only a real emoji (the AI occasionally returns a word); empty string otherwise.
export function cleanIcon(value = '') {
  const first = [...new Intl.Segmenter().segment(value.trim())][0]?.segment ?? ''
  return /\p{Extended_Pictographic}/u.test(first) ? first : ''
}

export class ReceiptReadError extends Error {
  constructor(message, status = 422) {
    super(message)
    this.status = status
  }
}
