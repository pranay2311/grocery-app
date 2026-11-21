// Lists the Gemini models your API key can use for generating content.
// Run with: npm run models
import { GoogleGenAI } from '@google/genai'

if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is not set in server/.env')
  process.exit(1)
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
const pager = await ai.models.list()
for await (const model of pager) {
  if (model.supportedActions?.includes('generateContent') && model.name.includes('gemini')) {
    console.log(model.name.replace('models/', ''))
  }
}
