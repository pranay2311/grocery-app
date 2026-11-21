// Checks the LISA connection: lists the models your key can use and tests which ones can read images.
// Run with: npm run lisa:models
import OpenAI from 'openai'
import zlib from 'node:zlib'

const { LISA_BASE_URL, LISA_API_KEY } = process.env
if (!LISA_BASE_URL || !LISA_API_KEY) {
  console.error('Set LISA_BASE_URL and LISA_API_KEY in server/.env first.')
  process.exit(1)
}

const client = new OpenAI({ apiKey: LISA_API_KEY, baseURL: LISA_BASE_URL, timeout: 60_000 })

let models
try {
  models = []
  for await (const m of client.models.list()) models.push(m.id)
} catch (err) {
  console.error(`Could not reach LISA at ${LISA_BASE_URL}: ${err.status ?? ''} ${err.message}`)
  if (/certificate|self.signed|UNABLE_TO_VERIFY/i.test(String(err.cause ?? err.message))) {
    console.error('-> LISA uses a private certificate. Save it as a .pem file and set NODE_EXTRA_CA_CERTS to its path.')
  }
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|fetch failed/i.test(String(err.cause ?? err.message))) {
    console.error('-> The address is not reachable from here. It may only work on the campus network / VPN.')
  }
  process.exit(1)
}
console.log(`Connected. ${models.length} models:\n  ${models.join('\n  ')}\n`)

// Tiny red square as a test image: a model that can see it should answer "red"
function redPng() {
  const w = 8, h = 8, raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set([255, 0, 0], y * (w * 3 + 1) + 1 + x * 3)
  const crcTable = [...Array(256)].map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
const image = `data:image/png;base64,${redPng().toString('base64')}`

console.log('Testing which models can read images (needed for receipts)…')
for (const model of models) {
  try {
    const r = await client.chat.completions.create({
      model,
      max_tokens: 10,
      messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: image } }, { type: 'text', text: 'What colour is this image? One word.' }] }],
    })
    const answer = (r.choices[0]?.message?.content ?? '').trim()
    console.log(`  ${/red|rot/i.test(answer) ? '✅ can see images' : '❓ answered'}  ${model}  ("${answer.slice(0, 40)}")`)
  } catch (err) {
    console.log(`  ❌ no images     ${model}  (${err.status ?? ''} ${String(err.message).slice(0, 60)})`)
  }
}
console.log('\nPut a ✅ model in server/.env as LISA_MODEL=..., then set AI_PROVIDER=lisa.')
