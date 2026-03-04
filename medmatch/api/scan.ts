import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();

  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'Image is required' });

  try {
    const mimeType = imageBase64.substring(imageBase64.indexOf(':') + 1, imageBase64.indexOf(';'));
    const base64Data = imageBase64.split(',')[1];

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: "Analyze this prescription or medicine strip. Identify all medicines. For each medicine, provide its original name, generic compound, estimated original price per pill in BDT, and exactly 5 cheaper generic alternatives available in Bangladesh with their manufacturer, price per pill in BDT, and savings compared to the original. Ensure 'verified' is true for DGDA verified medicines." }
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
}
