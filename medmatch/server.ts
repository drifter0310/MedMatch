import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import { GoogleGenAI, Type } from '@google/genai';

const db = new Database('medmatch.db');
let apiKey = process.env.GEMINI_API_KEY;
if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
  apiKey = "AIzaSyDpFC02Wajgoomsa63c0pcc4F0HY10SCSs";
}
const ai = new GoogleGenAI({ apiKey });

// Initialize DB schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE
  );
  
  CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    date TEXT,
    item TEXT,
    generic TEXT,
    saved REAL
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.post('/api/scan', async (req, res) => {
    const { imageBase64 } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({ error: 'Image is required' });
    }

    try {
      const mimeType = imageBase64.substring(imageBase64.indexOf(':') + 1, imageBase64.indexOf(';'));
      const base64Data = imageBase64.split(',')[1];

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data
              }
            },
            {
              text: "Analyze this prescription or medicine strip. Identify all medicines. For each medicine, provide its original name, generic compound, estimated original price per pill in BDT, and exactly 5 cheaper generic alternatives available in Bangladesh with their manufacturer, price per pill in BDT, and savings compared to the original. Ensure 'verified' is true for DGDA verified medicines."
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              medicines: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    originalName: { type: Type.STRING },
                    genericCompound: { type: Type.STRING },
                    originalPrice: { type: Type.NUMBER },
                    alternatives: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          manufacturer: { type: Type.STRING },
                          price: { type: Type.NUMBER },
                          savings: { type: Type.NUMBER },
                          verified: { type: Type.BOOLEAN }
                        },
                        required: ["name", "manufacturer", "price", "savings", "verified"]
                      }
                    }
                  },
                  required: ["originalName", "genericCompound", "originalPrice", "alternatives"]
                }
              }
            },
            required: ["medicines"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      res.json(result);
    } catch (error) {
      console.error("Scan error:", error);
      res.status(500).json({ error: "Failed to analyze image" });
    }
  });

  app.post('/api/signup', (req, res) => {
    const { email, userId } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO users (id, email) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET email=excluded.email');
      stmt.run(userId, email);
      res.json({ success: true, email });
    } catch (error) {
      res.status(500).json({ error: 'Failed to sign up' });
    }
  });

  app.get('/api/history', (req, res) => {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ error: 'User ID required' });
    
    try {
      const stmt = db.prepare('SELECT * FROM scans WHERE user_id = ? ORDER BY id DESC');
      const history = stmt.all(userId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch history' });
    }
  });

  app.post('/api/history', (req, res) => {
    const { userId, date, item, generic, saved } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    try {
      const stmt = db.prepare('INSERT INTO scans (user_id, date, item, generic, saved) VALUES (?, ?, ?, ?, ?)');
      const info = stmt.run(userId, date, item, generic, saved);
      res.json({ id: info.lastInsertRowid, date, item, generic, saved });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save scan' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
