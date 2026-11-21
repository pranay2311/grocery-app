> 📚 I made this project for learning purposes: to practise full-stack web development and hosting.

# Grocery Prices

Scan German supermarket receipts, store the prices in MongoDB, and find where a product is cheapest.

```
client/   React (Vite + Tailwind) – search page, receipt upload + review
server/   Node/Express API – AI receipt reading, MongoDB models, price search
```

## Setup

1. Create a free MongoDB Atlas cluster (M0) and copy its connection string.
2. Get a free Gemini API key from aistudio.google.com.
3. Copy `server/.env.example` to `server/.env` and fill in `MONGODB_URI` and `GEMINI_API_KEY`.
4. Install and run:

```powershell
npm run install:all
npm run dev
```

The app runs at http://localhost:5173 and the API at http://localhost:5000.

## How it works

1. **Scan** – `POST /api/receipts/scan` sends the photo to Gemini, which returns store, date, total and items as JSON. Nothing is saved yet.
2. **Review** – the user corrects any mistakes in the table.
3. **Save** – `POST /api/receipts` saves the store branch, receipt, products (with the receipt spelling as an alias) and one price per item.
4. **Search** – `GET /api/prices/search?q=milch&groupBy=chain|branch` returns the latest price per chain or branch, cheapest per unit first.

See [PLAN.md](PLAN.md) for the roadmap and hosting plan.
