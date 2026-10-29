const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Image upload memory storage (for AI Vision)
const upload = multer({ storage: multer.memoryStorage() });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get('/', (req, res) => {
  res.json({ status: "Success", message: "LocalFix Hyper-Local Backend Server is Live!" });
});

// 1. HYPER-LOCAL RADIUS SEARCH API (1km - 5km) WITH MAP COORDINATES
app.get('/api/search', async (req, res) => {
  try {
    const { item = '', size = '', lat = 29.9476, lng = 76.8155, radius = 5000 } = req.query;
    const query = `
      SELECT 
        p.id AS product_id, p.product_name, p.category, p.size_spec, p.price,
        s.id AS store_id, s.store_name, s.address, s.phone,
        ST_Y(s.location::geometry) AS store_lat,
        ST_X(s.location::geometry) AS store_lng,
        ROUND(ST_Distance(
          s.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        )) AS distance_meters
      FROM products p
      JOIN stores s ON p.store_id = s.id
      WHERE p.in_stock = TRUE
        AND p.product_name ILIKE $3
        AND p.size_spec ILIKE $4
        AND ST_DWithin(
          s.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $5
        )
      ORDER BY distance_meters ASC;
    `;
    const values = [parseFloat(lng), parseFloat(lat), `%${item}%`, `%${size}%`, parseInt(radius)];
    const result = await pool.query(query, values);
    res.json({ success: true, count: result.rows.length, results: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. AI HARDWARE SIZE & PART DETECTOR API (With Auto-Model Detection)
app.post('/api/analyze-part', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please upload an image" });
    }
    const userContext = req.body.context || "General household hardware/plumbing";

    const imagePart = {
      inlineData: {
        data: req.file.buffer.toString("base64"),
        mimeType: req.file.mimetype
      }
    };

    const prompt = `
      You are an expert Indian hardware & plumbing store owner.
      Analyze this image of a hardware/plumbing part or repair problem.
      User Context: "${userContext}"
      If an Indian coin (like ₹10 coin = 27mm) is present, use it for scale. Otherwise use standard Indian household fitting sizes based on context.
      Return ONLY a JSON object with these exact keys:
      {
        "identified_part": "Short name of the part (e.g., Tap, Elbow, Nut Bolt)",
        "recommended_size": "Size keyword (e.g., 1/2 inch, 3/4 inch, 10mm)",
        "full_specification": "Detailed spec (e.g., 1/2 inch (15mm) Brass Bib Cock)",
        "advice_hinglish": "Helpful 1-2 line explanation in simple Hinglish for the buyer",
        "extra_items": ["e.g., Teflon Tape"]
      }
    `;

    // Candidate models to try automatically
    const candidateModels = [
      "gemini-3-flash-preview",
      "gemini-3-flash",
      "gemini-flash-latest",
      "gemini-2.5-flash-lite",
      "gemini-pro-latest"
    ];

    let aiData = null;
    let lastError = null;

    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: "application/json" }
        });
        const result = await model.generateContent([prompt, imagePart]);
        aiData = JSON.parse(result.response.text());
        console.log(`✅ AI Analysis succeeded using model: ${modelName}`);
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!aiData) {
      throw lastError || new Error("No available Gemini model responded.");
    }

    res.json({ success: true, ai_analysis: aiData });
  } catch (err) {
    console.error("AI Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. LEAD GENERATION TRACKER API
app.post('/api/leads', async (req, res) => {
  try {
    const { store_id, searched_item } = req.body;
    await pool.query(
      'INSERT INTO leads (store_id, searched_item) VALUES ($1, $2)',
      [store_id, searched_item]
    );
    res.json({ success: true, message: "Lead recorded for retailer!" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. RETAILER DASHBOARD ANALYTICS & INVENTORY API
app.get('/api/retailer/dashboard', async (req, res) => {
  try {
    const stores = await pool.query('SELECT id, store_name, address, phone, subscription_tier FROM stores ORDER BY id ASC');
    const leads = await pool.query(`
      SELECT l.id, s.store_name, l.searched_item, l.created_at 
      FROM leads l JOIN stores s ON l.store_id = s.id 
      ORDER BY l.created_at DESC LIMIT 10
    `);
    res.json({ success: true, stores: stores.rows, recent_leads: leads.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. RETAILER ADD NEW PRODUCT API
app.post('/api/products', async (req, res) => {
  try {
    const { store_id, product_name, category, size_spec, price } = req.body;
    const result = await pool.query(
      `INSERT INTO products (store_id, product_name, category, size_spec, price, in_stock) 
       VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
      [store_id, product_name, category, size_spec, price]
    );
    res.json({ success: true, product: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});