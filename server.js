import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import multer from 'multer';
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(cors());
app.use(express.json());

// Configure file upload storage in system memory
const upload = multer({ storage: multer.memoryStorage() });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 1. ADVANCED SCHEDULE GENERATOR (With Course Outline integration)
app.post('/api/generate-schedule', async (req, res) => {
  const { subjects, dailyHours } = req.body;
  if (!subjects || subjects.length === 0) return res.status(400).json({ error: 'No subjects provided.' });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an expert academic tutor. Create a realistic, daily study schedule. 
                 Available hours per day: ${dailyHours}. 
                 Subjects data: ${JSON.stringify(subjects)}. 
                 
                 CRITICAL REQUIREMENT: For any subject that has an 'outline' provided, you must distribute the specific topics listed in that outline across the study days leading up to its deadline. Do not use generic topics if an outline is provided.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            strategyOverview: { type: "STRING" },
            dailySchedule: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  day: { type: "STRING" },
                  totalHoursAllocated: { type: "NUMBER" },
                  tasks: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        subject: { type: "STRING" },
                        duration: { type: "STRING" },
                        focusTopic: { type: "STRING", description: "The specific sub-topic taken straight from the outline or syllabus module." }
                      },
                      required: ["subject", "duration", "focusTopic"]
                    }
                  }
                },
                required: ["day", "totalHoursAllocated", "tasks"]
              }
            }
          },
          required: ["strategyOverview", "dailySchedule"]
        }
      }
    });
    res.json(JSON.parse(response.text));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Schedule calculation failed' });
  }
});

// 2. ADVANCED FILE-ANALYSIS FLASHCARDS & KNOWLEDGE GAP IDENTIFIER
app.post('/api/generate-flashcards', upload.single('file'), async (req, res) => {
  const { topic } = req.body;
  
  try {
    let contentSource = `Topic: ${topic}`;

    // If the user uploaded a document file, pass it directly into Gemini
    if (req.file) {
      const b64Data = req.file.buffer.toString("base64");
      contentSource = [
        {
          inlineData: {
            data: b64Data,
            mimeType: req.file.mimetype
          }
        },
        `Analyze this document file. Based strictly on its content regarding "${topic || 'General Material'}", generate 5 targeted flashcards. Additionally, summarize any major core engineering concepts or fundamental definitions that appear critical but require strong active retention.`
      ];
    } else {
      contentSource = `Create 5 comprehensive flashcards for a student studying this topic: "${topic}".`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contentSource,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            flashcards: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  front: { type: "STRING" },
                  back: { type: "STRING" }
                },
                required: ["front", "back"]
              }
            },
            knowledgeGapsOverview: { 
              type: "STRING", 
              description: "A bulleted breakdown identifying critical concepts the student must make sure they don't skip or lack understanding in based on the materials." 
            }
          },
          required: ["flashcards", "knowledgeGapsOverview"]
        }
      }
    });

    res.json(JSON.parse(response.text));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process document analysis.' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running smoothly on port ${PORT}`));