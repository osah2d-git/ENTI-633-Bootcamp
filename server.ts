import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { parseWeeklySalesTable } from './src/utils/salesParser.ts';
import {
  buildSystemPrompt,
  buildAnalysisUserPrompt,
  countWords,
  generateDeterministicCommentary,
} from './src/utils/commentaryGenerator.ts';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '2mb' }));

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

app.post('/api/analyze', async (req: Request, res: Response) => {
  try {
    const { rawText } = req.body;

    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Please paste a weekly sales table to analyze.',
      });
    }

    const parsedData = parseWeeklySalesTable(rawText);

    // Rule: Check that the plan column and week are present, else ask
    if (!parsedData.hasWeek || !parsedData.hasPlan || parsedData.missingError) {
      return res.json({
        success: false,
        parsedData,
        missingMessage: parsedData.missingError?.message || 'Missing required information in sales table.',
      });
    }

    let commentary = '';
    let engineUsed = 'rules-engine';

    if (ai) {
      try {
        const systemPrompt = buildSystemPrompt();
        const userPrompt = buildAnalysisUserPrompt(parsedData);

        // Try gemini-3.1-flash-lite (generous quota, fast, high accuracy)
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.2, // Low temperature for factual precision
          },
        });

        const rawResult = response.text ? response.text.trim() : '';
        const singleParagraph = rawResult.replace(/\r?\n+/g, ' ').trim();
        const words = countWords(singleParagraph);

        const hasMissingStoreCheck =
          parsedData.storesMissingLY.length === 0 ||
          parsedData.storesMissingLY.every((store) =>
            new RegExp(`excluding\\s+${store}|excl\\.?\\s+${store}`, 'i').test(singleParagraph)
          );

        if (words >= 75 && words <= 125 && hasMissingStoreCheck) {
          commentary = singleParagraph;
          engineUsed = 'gemini-3.1-flash-lite';
        } else {
          commentary = generateDeterministicCommentary(parsedData);
          engineUsed = 'rules-engine';
        }
      } catch (geminiErr: any) {
        // Quietly fallback to deterministic rule engine without polluting logs with 429 quota traces
        commentary = generateDeterministicCommentary(parsedData);
        engineUsed = 'rules-engine';
      }
    } else {
      commentary = generateDeterministicCommentary(parsedData);
      engineUsed = 'rules-engine';
    }

    // Ensure commentary is clean, single paragraph
    commentary = commentary.replace(/\r?\n+/g, ' ').trim();
    const finalWordCount = countWords(commentary);

    return res.json({
      success: true,
      parsedData,
      commentary,
      wordCount: finalWordCount,
      paragraphCount: 1,
      engine: engineUsed,
    });
  } catch (error: any) {
    console.error('Error analyzing sales data:', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred while processing the sales table.',
    });
  }
});

app.get('/api/download-zip', (req: Request, res: Response) => {
  const zipPath = '/tmp/retail-sales-commentary.zip';
  exec('python3 scripts/create_zip.py /tmp/retail-sales-commentary.zip', (err) => {
    if (err) {
      console.error('Error creating zip:', err);
      return res.status(500).send('Error creating zip file');
    }
    return res.download(zipPath, 'retail-sales-commentary.zip');
  });
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server started on http://0.0.0.0:${PORT}`);
  });
}

startServer();
