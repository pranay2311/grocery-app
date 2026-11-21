# Grocery Price Compare — Project Plan

## Goal
Users scan German supermarket receipts. AI pulls out store, date, items and prices.
The data is saved in MongoDB, so anyone can find where a product is cheapest.

## Decisions
- **Receipt reading:** AI vision model gives structured JSON, then the user reviews and fixes items before saving
- **Users:** public; guest uploads allowed, optional sign-up
- **Prices:** stored per store branch; search can group results by chain or by branch
- **Stack:** React (Vite) + Node/Express + MongoDB (Mongoose)

## Data model (first draft)
- `stores` – chain, branch name, address, city, postcode
- `products` – standard name, category, unit (kg / L / Stück), size, known receipt spellings
- `receipts` – uploader (user or guest id), store, date, total, status
- `prices` – product, store, receipt, date, price, unit price (per kg/L)

## Hosting (free)
- Frontend: Vercel / Netlify / Cloudflare Pages
- Backend: Oracle Cloud Always Free VM (always on), or Render / Vercel serverless as a fallback
- Database: MongoDB Atlas M0 (512 MB)

## Milestones
1. MVP: upload → AI parse → review/edit → save → search, cheapest first
2. Guest + account auth, rate limiting against spam
3. Branch/chain filters, price history chart
4. Shopping list "cheapest store for my list"
5. PWA camera scanning, German/English UI
