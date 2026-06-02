# Mini CRM — Client Lead Management System

A full-stack Mini CRM built with **Node.js + Express**, **MongoDB (Mongoose)**, **JWT authentication**, and a **Vanilla JS** frontend.

---

## 🗂️ Project Structure

```
mini-crm/
├── server/
│   ├── config/db.js
│   ├── controllers/authController.js
│   ├── controllers/leadController.js
│   ├── middleware/authMiddleware.js
│   ├── models/User.js
│   ├── models/Lead.js
│   ├── routes/authRoutes.js
│   ├── routes/leadRoutes.js
│   └── server.js
├── client/
│   ├── index.html
│   ├── dashboard.html
│   ├── leads.html
│   ├── add-lead.html
│   ├── lead-detail.html
│   ├── css/style.css
│   ├── css/auth.css
│   ├── css/dashboard.css
│   ├── js/utils.js
│   ├── js/auth.js
│   ├── js/dashboard.js
│   ├── js/leads.js
│   ├── js/add-lead.js
│   └── js/lead-detail.js
├── .env
├── .gitignore
├── package.json
└── README.md
```

---

## ⚙️ Local Setup

### 1. Clone & Install

```bash
git clone https://github.com/your-username/mini-crm.git
cd mini-crm
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/mini-crm
JWT_SECRET=your_super_secret_jwt_key_change_this
JWT_EXPIRES_IN=7d
ADMIN_SETUP_KEY=myadminsecretkey2024
```

### 3. Start MongoDB Locally

```bash
# macOS (Homebrew)
brew services start mongodb-community

# Ubuntu
sudo systemctl start mongod

# Windows — start MongoDB service from Services panel
```

### 4. Run the Server

```bash
npm run dev       # development (nodemon auto-restart)
npm start         # production
```

Open **http://localhost:5000** in your browser.

---

## 🔐 First-Time Setup

### Register the First Admin

Visit `http://localhost:5000` → click **Register** tab and fill in:

| Field | Value |
|---|---|
| Name | Your Name |
| Email | admin@example.com |
| Password | (min 6 chars) |
| Setup Key | value of `ADMIN_SETUP_KEY` in your `.env` |

Or use curl:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin",
    "email": "admin@minicrm.com",
    "password": "secret123",
    "setupKey": "myadminsecretkey2024"
  }'
```

---

## 🌐 API Reference

All lead routes require `Authorization: Bearer <token>` header.

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register admin (requires setupKey) |
| POST | `/api/auth/login` | Login → returns JWT |
| GET | `/api/auth/me` | Get current user profile |
| POST | `/api/auth/refresh` | Refresh JWT token |
| PUT | `/api/auth/profile` | Update name/email |

### Leads

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/leads` | List leads (search, filter, paginate) |
| POST | `/api/leads` | Create new lead |
| GET | `/api/leads/stats` | Dashboard statistics |
| GET | `/api/leads/:id` | Get single lead |
| PUT | `/api/leads/:id` | Update lead |
| DELETE | `/api/leads/:id` | Delete lead |
| POST | `/api/leads/:id/notes` | Add follow-up note |
| DELETE | `/api/leads/:id/notes/:noteId` | Delete a note |

### Query Parameters for GET /api/leads

```
?search=john           # search name, email, company
?status=New            # New | Contacted | Qualified | Converted | Lost
?priority=High         # High | Medium | Low
?source=Referral       # Website | Referral | Social Media | ...
?sort=-createdAt       # field to sort (-field = descending)
?page=1                # page number
?limit=10              # results per page (max 50)
```

---

## ☁️ MongoDB Atlas Setup

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas) → create free cluster
2. Create a database user (username + password)
3. Whitelist your IP (or use `0.0.0.0/0` for all IPs)
4. Click **Connect** → **Connect your application** → copy the URI
5. Replace `MONGO_URI` in your `.env`:

```env
MONGO_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/mini-crm?retryWrites=true&w=majority
```

---

## 🚀 Deployment on Render

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/mini-crm.git
git push -u origin main
```

### 2. Create Render Web Service

1. Go to [render.com](https://render.com) → **New Web Service**
2. Connect your GitHub repo
3. Configure:

| Setting | Value |
|---|---|
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Root Directory | (leave blank) |

### 3. Add Environment Variables on Render

In Render dashboard → **Environment** tab, add:

```
PORT            = 10000
MONGO_URI       = mongodb+srv://...  (your Atlas URI)
JWT_SECRET      = (long random string)
JWT_EXPIRES_IN  = 7d
ADMIN_SETUP_KEY = (your secret key)
NODE_ENV        = production
```

### 4. Deploy

Render auto-deploys on every push to `main`. First deploy takes ~2 minutes.

Your app will be live at: `https://your-app-name.onrender.com`

---

## 🧪 Testing the API

### Health Check
```bash
curl https://your-app.onrender.com/api/health
```

### Login
```bash
curl -X POST https://your-app.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@minicrm.com","password":"secret123"}'
```

### Create Lead (replace TOKEN)
```bash
curl -X POST https://your-app.onrender.com/api/leads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@acme.com",
    "company": "Acme Corp",
    "status": "New",
    "priority": "High",
    "dealValue": 15000
  }'
```

### Get All Leads
```bash
curl https://your-app.onrender.com/api/leads \
  -H "Authorization: Bearer TOKEN"
```

---

## ✨ Features

- ✅ JWT authentication with bcrypt password hashing
- ✅ Admin registration protected by setup key
- ✅ Full lead CRUD (Create, Read, Update, Delete)
- ✅ 5-stage pipeline: New → Contacted → Qualified → Converted → Lost
- ✅ Search across name, email, and company
- ✅ Filter by status, priority, and source
- ✅ Sortable columns and pagination
- ✅ Follow-up notes with scheduled dates
- ✅ SVG donut chart (no chart library)
- ✅ KPI stat cards with deal value totals
- ✅ Dark theme with indigo accent design system
- ✅ Fully responsive (mobile sidebar drawer)
- ✅ Toast notifications throughout

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Auth | JSON Web Tokens, bcryptjs |
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Deployment | Render (backend), MongoDB Atlas (DB) |

---

## 📄 License

MIT — free to use and modify.
