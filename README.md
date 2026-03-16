# 🤖 Chatbot Backend — Digital Products Business

An AI-powered chatbot backend built for digital product sellers. Handles product search, FAQ matching, and human agent handoff — deployed on Railway with Supabase and Claude AI.

---

## 📌 Project Overview

This is the backend API for a business chatbot that helps customers:
- Search and discover digital products
- Get instant answers from a pre-built FAQ database
- Request a live human agent when needed

Built as a single Node.js service for testing, with a clear path to microservices for production.

---

## 🧱 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Node.js | Backend engine |
| Framework | Express.js | API routing |
| Database | Supabase (PostgreSQL) | Products, FAQs, chat logs |
| AI | Claude API (Anthropic) | Intelligent responses |
| Email | Resend | Human handoff alerts |
| Deployment | Railway | Cloud hosting |
| Frontend (Phase 5) | Vercel | Chat widget UI |

---

## 🗄️ Database Tables

| Table | Purpose |
|-------|---------|
| `products` | Digital product catalog with pricing and stock status |
| `faqs` | Pre-written question and answer pairs |
| `chat_messages` | Full conversation history logs |
| `handoff_requests` | Queue of customers requesting a human agent |

---

## 🔌 API Endpoints

### Health Check
```
GET /
```
Returns server status. Used to verify the backend is running.

---

### Product Search
```
GET /products?search=keyword
```
Searches the product catalog by keyword.

**Example:**
```
GET /products?search=inventory
```

---

### Chat
```
POST /chat
```
Main chatbot endpoint. Processes customer messages and returns a reply.

**Request body:**
```json
{
  "message": "do you offer refunds?",
  "session_id": "unique-session-id"
}
```

**Response:**
```json
{
  "reply": "Yes we offer a 7-day money back guarantee on all products."
}
```

**How it works — in order:**
1. Saves user message to `chat_messages` table
2. Checks if user wants a human agent
3. Searches `faqs` table for a keyword match
4. If no FAQ match — calls Claude AI with business context
5. Saves bot reply to `chat_messages` table
6. Returns reply to user

---

### Handoff Queue
```
GET /handoff
```
Returns all pending human handoff requests. Used by the agent dashboard.

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory with these values:

```
SUPABASE_URL=https://xxxxxx.supabase.co
SUPABASE_KEY=your_supabase_publishable_key
ANTHROPIC_API_KEY=your_claude_api_key
ALERT_EMAIL=your@gmail.com
RESEND_API_KEY=your_resend_api_key
PORT=3000
```

> ⚠️ Never commit your `.env` file to GitHub. It is listed in `.gitignore`.

---

## 🚀 Local Setup

**Step 1 — Clone the repository:**
```bash
git clone git@github.com:yourusername/chatbot-backend.git
cd chatbot-backend
```

**Step 2 — Install dependencies:**
```bash
npm install
```

**Step 3 — Create your `.env` file and fill in your keys**

**Step 4 — Start the server:**
```bash
node index.js
```

Server runs on `http://localhost:3000`

---

## ☁️ Deployment

This project is deployed on **Railway** via GitHub integration.

Every push to the `main` branch triggers an automatic redeployment.

**Live URL:**
```
https://chatbot-backend-production-c000.up.railway.app
```

---

## 🧪 Testing

Use **Postman** to test all endpoints.

**Test 1 — Product search:**
```json
POST /chat
{
  "message": "what products do you offer?",
  "session_id": "test-001"
}
```

**Test 2 — FAQ matching:**
```json
POST /chat
{
  "message": "do you offer refunds?",
  "session_id": "test-001"
}
```

**Test 3 — Human handoff:**
```json
POST /chat
{
  "message": "talk to a human",
  "session_id": "test-001"
}
```

---

## ✅ Test Results

| Feature | Status |
|---------|--------|
| Product search | ✅ Passing |
| FAQ matching | ✅ Passing |
| Human handoff (Supabase logging) | ✅ Passing |
| Human handoff (Email alert) | 🔧 In progress |

---

## 🗺️ Roadmap

- [x] Phase 1 — Accounts and tools setup
- [x] Phase 2 — Database setup (Supabase)
- [x] Phase 3 — Backend API (Railway)
- [ ] Phase 4 — Chat widget UI (Vercel)
- [ ] Phase 5 — Full system testing
- [ ] Phase 6 — Production deployment with custom domain

---

## 📁 Project Structure

```
chatbot-backend/
├── index.js          # Main backend application
├── package.json      # Project dependencies
├── package-lock.json # Dependency lock file
├── .gitignore        # Files excluded from GitHub
└── .env              # Secret keys (never committed)
```

---

## 👤 Author

Built from scratch as a test deployment for a digital products business chatbot.
Documented step by step from zero to operational.

---

## 📄 License

MIT
