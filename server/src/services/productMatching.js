import Product from '../models/Product.js'

// When two receipt lines count as "the same product" for price comparison.
// Shared by the receipt reader (matching new items) and the merge script (cleaning old data).
export const SAME_PRODUCT_RULES = `Two items are the SAME product when a shopper would compare their prices directly:
- Same kind of product and same size/pack (e.g. "Vollmilch 3,5% 1L"), even if the name or abbreviation differs ("Bananen", "Bananen lose", "Bananen RFA").
- Supermarket own brands of the same product ARE the same product (Gutes Land, Milbona, ja!, K-Classic, Gut & Günstig, Milsani...), so their prices can be compared across chains.
They are DIFFERENT products when:
- One is organic (Bio) and the other is not.
- One is a national brand (Milka, Pringles, Nesquik, Müller, Pril...) and the other is a different brand or own brand.
- Size or pack differs in a way that matters (500g vs 1kg, 6 vs 10 eggs), or the variety differs (Vollmilch vs fettarme Milch, Bodenhaltung vs Freilandhaltung eggs, red vs white onions).`

// Products a new receipt line could match: active (not merged away) ones, numbered for the AI.
export async function loadCatalog(limit = 1000) {
  const products = await Product.find({ mergedInto: null }).select('name').sort({ name: 1 }).limit(limit).lean()
  const text = products.map((p, i) => `${i}: ${p.name}`).join('\n')
  return { products, text }
}

// Follow a merged product to the product it was merged into.
export async function resolveProduct(product) {
  let current = product
  for (let hops = 0; current?.mergedInto && hops < 5; hops++) {
    current = await Product.findById(current.mergedInto)
  }
  return current
}
