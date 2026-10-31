# 🔧 LocalFix — AI-Powered Hyper-Local Hardware Discovery Platform

**LocalFix** is a full-stack O2O (Online-to-Offline) hardware and plumbing discovery platform that bridges the gap between local household buyers and nearby neighbourhood hardware stores (1km – 5km). It solves two major real-world problems: **identifying exact hardware fitting sizes** and **locating real-time stock in nearby shops**.

---

## ✨ Key Features

- **📸 Gemini Vision AI Part & Size Detector:** Upload a photo of a broken tap, pipe, or fitting (with reference scaling support like a ₹10 coin) to automatically detect the exact specification (e.g., 1/2 inch / 15mm), get Hinglish repair advice, and receive companion item suggestions like Teflon Tape.
- **📏 1:1 On-Screen Digital Caliper:** Interactive millimeter scale (4mm to 32mm / M4 to M32 standard) allowing users to place physical nuts, bolts, or washers directly on the screen to measure exact diameter.
- **📍 PostGIS Hyper-Local Radius Search (1km – 5km):** Real-time spatial queries using `ST_DWithin` and `ST_Distance` to filter in-stock items sorted by exact distance in meters.
- **🗺️ Interactive Live Map:** Integrated Leaflet.js & OpenStreetMap view displaying user location, dynamic radius circle, and clickable store pins with live pricing.
- **⚖️ Instant Store Comparison:** Compare prices and distances across multiple local hardware stores side-by-side.
- **🏪 Retailer SaaS Portal & Lead Tracker:** Dedicated dashboard for shop owners to publish inventory with size specifications and track high-intent walk-in customer leads in real time.

---

## 🛠️ Tech Stack

- **Frontend:** React.js (Vite), Tailwind CSS, Leaflet.js (OpenStreetMap)
- **Backend:** Node.js, Express.js, Multer
- **Database:** PostgreSQL (Supabase) with **PostGIS** Spatial Extension
- **AI Integration:** Google Gemini Vision API (`@google/generative-ai`)

---

## 📡 Core API Endpoints

- `GET /api/search` — PostGIS spatial search filtering stores and products within a dynamic meter radius (`lat`, `lng`, `radius`, `item`, `size`).
- `POST /api/analyze-part` — Multipart image analysis via Gemini Vision AI returning structured JSON specifications and repair advice.
- `POST /api/leads` — Logs high-intent O2O customer walk-in leads when store contact details are unlocked.
- `GET /api/retailer/dashboard` — Fetches registered local stores and real-time customer lead analytics.
- `POST /api/products` — Allows retailers to publish new hardware inventory to the local radius.

---

## 🚀 Local Setup Instructions

### 1. Clone the Repository
```bash
git clone [https://github.com/adi-184/LocalFix.git](https://github.com/adi-184/LocalFix.git)
cd LocalFix