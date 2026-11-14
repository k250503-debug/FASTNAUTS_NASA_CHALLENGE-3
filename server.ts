import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

interface AdvisorRequestBody {
  question?: string;
  telemetry?: {
    planetName: string;
    day: number;
    maxDays: number;
    budget: number;
    sciencePoints: number;
    solarCondition: string;
    oxygen: number;
    water: number;
    food: number;
    battery: number;
    batteryMax: number;
    shielding: number;
    radiationExposure: number;
    rates: {
      oxygenProd: number;
      oxygenCons: number;
      waterProd: number;
      waterCons: number;
      foodProd: number;
      foodCons: number;
      powerGen: number;
      powerUsed: number;
    };
    buildingsSummary: string[];
    activeEventTitle?: string | null;
  };
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.post('/api/advisor', async (req, res) => {
    const body = req.body as AdvisorRequestBody;
    const question = (body.question || '').trim();
    const telemetry = body.telemetry;

    if (!question || !telemetry) {
      res.status(400).json({ error: 'Question and mission telemetry are required.' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(503).json({
        error: 'Gemini API key is not configured in Secrets. Use Built-in Telemetry Diagnostics below.',
        code: 'NO_API_KEY',
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const systemInstruction = `You are ASTRA Mission Advisor, a clear, encouraging NASA STEM flight director helping a student commander operate a space outpost.
Rules:
1. Reference the commander's exact live telemetry numbers (production vs. consumption rates) to diagnose what is happening.
2. Explain the underlying space engineering or ISRU science in 2-4 crisp, accessible sentences.
3. Offer 1-2 actionable options with their trade-offs, without dictating a single choice.
4. Clearly treat numbers as educational simulation values, not flight-certified spacecraft specs.
5. Do not use markdown headers or overly long paragraphs.`;

      const prompt = `Live Outpost Telemetry:
- Planet: ${telemetry.planetName}, Day ${telemetry.day} of ${telemetry.maxDays}
- Solar Condition: ${telemetry.solarCondition}
- Oxygen: ${telemetry.oxygen}% (+${telemetry.rates.oxygenProd}/day vs -${telemetry.rates.oxygenCons}/day)
- Water: ${telemetry.water}% (+${telemetry.rates.waterProd}/day vs -${telemetry.rates.waterCons}/day)
- Food: ${telemetry.food}% (+${telemetry.rates.foodProd}/day vs -${telemetry.rates.foodCons}/day)
- Battery: ${telemetry.battery}/${telemetry.batteryMax} kWh (Gen +${telemetry.rates.powerGen} kWh vs Load -${telemetry.rates.powerUsed} kWh)
- Radiation Shielding: ${telemetry.shielding}%, Crew Radiation Exposure: ${telemetry.radiationExposure}%
- Credits: ${telemetry.budget} CR, Science Points: ${telemetry.sciencePoints} SCI
- Deployed Modules: ${telemetry.buildingsSummary.join(', ') || 'None'}
- Active Emergency: ${telemetry.activeEventTitle || 'None'}

Commander Question: "${question}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const answer = response.text?.trim();
      if (!answer) {
        res.status(502).json({ error: 'Advisor returned an empty response.' });
        return;
      }

      res.json({ answer });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reach Gemini Advisor.';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ASTRA Mission Control server running on http://localhost:${PORT}`);
  });
}

startServer();
