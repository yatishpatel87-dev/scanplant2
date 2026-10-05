import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// High limit for base64 plant image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize Gemini SDK if API key is present
const geminiApiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (geminiApiKey) {
  ai = new GoogleGenAI({ apiKey: geminiApiKey });
}

/**
 * Endpoint: POST /api/analyze-plant
 * Multimodal Plant Disease & Crop Identification using Gemini Vision
 */
app.post('/api/analyze-plant', async (req: Request, res: Response) => {
  try {
    const { images, cropHint } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      res.status(400).json({ error: 'કૃપા કરીને ઓછામાં ઓછો એક ફોટો આપો (At least one image is required)' });
      return;
    }

    if (!ai) {
      console.warn('GEMINI_API_KEY not configured on server. Handing over to fallback.');
      res.status(503).json({ error: 'GEMINI_API_KEY not set on server' });
      return;
    }

    // Convert data URLs to Gemini inlineData parts
    const imageParts = images.slice(0, 3).map((imgUrl: string) => {
      const match = imgUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        return {
          inlineData: {
            mimeType: match[1],
            data: match[2]
          }
        };
      }
      return null;
    }).filter(Boolean);

    if (imageParts.length === 0) {
      res.status(400).json({ error: 'અમાન્ય ફોટો ફોર્મેટ (Invalid image base64 data)' });
      return;
    }

    const promptText = `
You are an expert plant pathologist, botanist, and agricultural AI specialist.
Your task is to analyze the provided image(s) with high accuracy and strictly identify WHAT IS ACTUALLY IN THE SCANNED PHOTO.

CRITICAL INSTRUCTIONS:
1. STRICT ACCURACY TO SCANNED IMAGE:
   - Identify the EXACT plant, crop, tree, fruit, vegetable, flower, medicinal plant, or leaf present in the photo.
   - For example:
     * If the photo shows a Rose (ગુલાબ), identify it as Rose.
     * If it shows Lemon / Citrus (લીંબુ), identify it as Lemon.
     * If it shows Mango (આંબો/કેરી), Guava (જામફળ), Papaya (પપૈયા), Banana (કેળા), Chikoo (ચીકુ) — identify that exact fruit tree.
     * If it shows Tomato (ટામેટા), Chilli (મરચાં), Brinjal (રીંગણ), Okra (ભીંડા), Onion (ડુંગળી), Garlic (લસણ) — identify that exact vegetable.
     * If it shows Cotton (કપાસ), Groundnut (મગફળી), Wheat (ઘઉં), Rice/Paddy (ડાંગર), Millet (બાજરી), Maize (મકાઈ), Cumin (જીરું), Mustard (રાયડો), Castor (એરંડા) — identify that exact crop.
     * If it shows Neem (લીમડો), Tulsi (તુલસી), Banyan (વડ), Peepal (પીપળો), Aloe vera (કુંવારપાઠું) — identify that exact plant.
     * If it shows a houseplant, ornamental flower, or weed — identify that exact plant.
   - ${cropHint ? `Note: The user provided an optional note: "${cropHint}". Cross-check with visual evidence. If the photo visibly shows a DIFFERENT plant than the note, identify what is ACTUALLY in the photo!` : 'Identify the plant strictly based on visual characteristics in the photo.'}
   - NEVER default to cotton, wheat, or any other crop if the photo shows a different plant!

2. NON-PLANT DETECTION:
   - If the image DOES NOT contain any plant, leaf, crop, flower, tree, or agricultural subject (e.g. photo of a human face, vehicle, animal, indoor furniture, room, blank surface, device, paper, etc.):
     * Set "is_plant": false
     * Set "plant_name_gu": "કોઈ છોડ કે પાક ઓળખાયો નથી"
     * Set "plant_name_en": "Not a Plant / Crop"
     * Set "scientific_name": "N/A"
     * Set "crop_category": "અન્ય"
     * Set "growth_stage": "લાગુ પડતું નથી"
     * Set "health_status": "attention"
     * Set "confidence": "high"
     * Set "confidence_score": 0.95
     * Set "visible_symptoms": ["આ ફોટામાં કોઈ ખેતી પાક, છોડ, ફૂલ કે પાંદડું દેખાતું નથી."]
     * Set "possible_disease": "કોઈ રોગ નથી (છોડની ગેરહાજરી)"
     * Set "possible_pest": "લાગુ પડતું નથી"
     * Set "possible_nutrient_deficiency": "લાગુ પડતું નથી"
     * Set "water_guidance": "કૃપા કરીને ખેતરના પાક અથવા ઘરના છોડનો ફોટો સ્કેન કરો."
     * Set "care_recommendation": "યોગ્ય પરિણામ માટે છોડ અથવા પાંદડાનો સ્પષ્ટ ફોટો લો."
     * Set "treatment_guidance": "છોડ કે પાંદડાનો ફોટો અપલોડ કરવાથી ચોક્કસ રોગ અને સારવાર મળી શકશે."
     * Set "warning": "આ ફોટામાં કોઈ પાક કે છોડ દેખાતો નથી. કૃપા કરીને પાક કે છોડનો ફોટો સ્કેનરમાં મૂકો."

3. FOR VALID PLANTS - ACTUAL HEALTH STATUS:
   - Closely inspect the scanned plant's leaves/stem/fruit.
   - If the plant is green, spotless, and thriving:
     * Set "health_status": "healthy"
     * Set "possible_disease": "છોડ સ્વસ્થ અને તંદુરસ્ત જણાય છે (Healthy Plant)"
     * Set "visible_symptoms": ["લીલાં અને સ્વસ્થ પાન", "કોઈ સડો કે ડાઘ નથી"]
   - If diseased or infested, identify the EXACT issue (powdery mildew, leaf spot, aphids, mites, blight, deficiency, etc.) matching THIS specific plant species.
   - All remedies, organic IPM advice, and watering tips must be specific to THIS plant.

You MUST return a pure, valid JSON object (no markdown quotes, no explanations outside JSON) with this exact schema:
{
  "is_plant": true,
  "plant_name_gu": "ચોક્કસ છોડ/પાકનું શુદ્ધ ગુજરાતી નામ",
  "plant_name_en": "Exact English Name",
  "scientific_name": "Botanical / Scientific Name",
  "crop_category": "પાક/છોડનો પ્રકાર (બાગાયતી ફળઝાડ, શાકભાજી, અનાજ, તેલીબિયાં, રોકડિયો પાક, સુશોભન ફૂલછોડ, ઔષધીય વનસ્પતિ)",
  "growth_stage": "વૃદ્ધિનો તબક્કો",
  "health_status": "healthy" | "attention" | "critical",
  "confidence": "high" | "medium" | "low",
  "confidence_score": 0.90,
  "visible_symptoms": ["ફોટામાં દેખાતા ચોક્કસ લક્ષણો"],
  "possible_disease": "આ ચોક્કસ છોડનો સંભવિત રોગ અથવા 'છોડ તંદુરસ્ત છે'",
  "possible_pest": "સંભવિત જીવાત અથવા 'કોઈ જીવાત દેખાતી નથી'",
  "possible_nutrient_deficiency": "સંભવિત પોષક તત્વોની ઉણપ અથવા 'સામાન્ય પોષણ'",
  "water_guidance": "આ ચોક્કસ છોડ માટે પાણી/ભેજ માર્ગદર્શન",
  "care_recommendation": "આ ચોક્કસ છોડ માટે જરૂરી સંભાળ",
  "treatment_guidance": "આ ચોક્કસ છોડ માટે IPM, લીમડાનું અર્ક, જૈવિક ઉપાયો અને યોગ્ય માવજત",
  "dos_and_donts": {
    "dos": ["આ છોડ માટે શું કરવું"],
    "donts": ["આ છોડ માટે શું ન કરવું"]
  },
  "when_to_consult_expert": "ક્યારે નિષ્ણાતની સલાહ લેવી",
  "warning": "આ ફોટા આધારિત પ્રાથમિક AI વિશ્લેષણ છે. ચોક્કસ રોગ, પોષક તત્વોની ઉણપ અથવા દવાની ભલામણ માટે જમીન/પાકની તપાસ અને સ્થાનિક કૃષિ નિષ્ણાતની સલાહ જરૂરી હોઈ શકે છે."
};
`
;
    const contents = [
      ...imageParts,
      { text: promptText }
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents as any,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const responseText = response.text || '';
    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      // Clean possible markdown code fences
      const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    // Attach server id and timestamp
    parsed.id = `scan-${Date.now()}`;
    parsed.timestamp = new Date().toISOString();
    parsed.image_url = images[0];
    if (images.length > 1) {
      parsed.secondary_image_url = images[1];
    }

    res.json(parsed);
  } catch (error: any) {
    console.error('Error analyzing plant with Gemini API:', error);
    res.status(500).json({
      error: 'AI વિશ્લેષણમાં ત્રુટિ આવી છે. કૃપા કરીને ફરી પ્રયાસ કરો.',
      details: error?.message || 'Unknown error'
    });
  }
});

/**
 * Endpoint: POST /api/chat
 * Agricultural Chat Assistant in Gujarati
 */
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { message, history } = req.body;

    if (!message) {
      res.status(400).json({ error: 'સંદેશ આપવો જરૂરી છે (Message is required)' });
      return;
    }

    if (!ai) {
      res.status(503).json({ error: 'GEMINI_API_KEY not configured on server' });
      return;
    }

    const systemInstruction = `
તમે ગુજરાતના ખેડૂતો માટેના સ્માર્ટ કૃષિ સલાહકાર અને પાક નિષ્ણાત "કૃષિ મિત્ર" છો.
આપ ખેડૂતોના પ્રશ્નોના જવાબો સરળ, આદરપૂર્ણ અને શુદ્ધ ગુજરાતી ભાષામાં આપો છો.

મુખ્ય નિયમો:
૧. પાક, રોગ, જીવાત, ખાતર, પાણી વ્યવસ્થાપન, જમીન સંભાળ અંગે ચોક્કસ અને વ્યવહારુ માહિતી આપો.
૨. કોઈપણ રાસાયણિક દવાની ભલામણ કરતાં પહેલા જૈવિક (Organic) અને IPM (Integrated Pest Management) ઉપાયોને પ્રાથમિકતા આપો (જેમ કે લીમડાનું તેલ, ટ્રાઇકોડર્મા, ફેરોમોન ટ્રેપ).
૩. ક્યારેય બે કે વધુ દવાઓ ભેગી કરવાની જોખમી સલાહ ન આપવી. દવા વાપરતી વખતે માસ્ક અને મોજાં પહેરવાની સલાહ આપવી.
૪. જવાબના અંતે ટૂંકી સાવચેતી નોંધ અને આગામી ૨-૩ સંભવિત પ્રશ્નો (suggestions) આપવા.
૫. સ્પષ્ટ બુલેટ પોઇન્ટ્સ અને સરળ ભાષા વાપરો.
`;

    const chatHistory = Array.isArray(history)
      ? history.map((item: any) => ({
          role: item.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: item.content || item.text }]
        }))
      : [];

    chatHistory.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: chatHistory as any,
      config: {
        systemInstruction
      }
    });

    const answer = response.text || '';
    res.json({
      text: answer,
      suggestions: [
        'આ રોગમાં કયું જૈવિક ખાતર વાપરી શકાય?',
        'પિયત ક્યારે અને કેટલું આપવું જોઈએ?',
        'દવાનો છંટકાવ કરતી વખતે શું સાવચેતી રાખવી?'
      ]
    });
  } catch (error: any) {
    console.error('Error in chat assistant:', error);
    res.status(500).json({
      error: 'ચેટ સહાયકમાં ત્રુટિ આવી છે.',
      details: error?.message || 'Unknown error'
    });
  }
});

/**
 * Endpoint: GET /api/weather
 * Real-time Gujarat Agricultural Weather
 */
app.get('/api/weather', async (req: Request, res: Response) => {
  try {
    const lat = req.query.lat ? Number(req.query.lat) : 22.3039; // Default Rajkot
    const lon = req.query.lon ? Number(req.query.lon) : 70.8022;
    const districtName = (req.query.district as string) || 'Rajkot';

    const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=Asia%2FKolkata`;
    
    const omRes = await fetch(omUrl);
    if (!omRes.ok) {
      throw new Error(`Open-Meteo returned status ${omRes.status}`);
    }

    const data = await omRes.json();
    const current = data.current;
    const temp = Math.round(current.temperature_2m);
    const humidity = Math.round(current.relative_humidity_2m);
    const rain = current.precipitation || 0;
    const wind = Math.round(current.wind_speed_10m);

    let condition = 'સ્વચ્છ આકાશ (Clear Sky)';
    let sprayAdvice = 'પવન શાંત છે. સવારે અથવા સાંજે દવાનો છંટકાવ કરવો અનુકૂળ છે.';
    let irrigationAdvice = 'જમીનમાં સામાન્ય ભેજ જાળવવા હળવું પિયત આપો.';

    if (rain > 0 || current.weather_code >= 51) {
      condition = 'વરસાદી વાતાવરણ / ઝાપટાં';
      sprayAdvice = 'વરસાદની શક્યતા હોવાથી હાલમાં કોઈ દવાનો છંટકાવ કરવો નહીં; દવા ધોવાઈ જશે.';
      irrigationAdvice = 'વરસાદની સ્થિતિ જોતાં હાલ પિયત આપવું મુલતવી રાખો.';
    } else if (wind > 20) {
      condition = 'તેજ પવન (Windy)';
      sprayAdvice = 'તેજ પવનના કારણે દવાનો બગાડ થશે, પવન શાંત થાય તેની રાહ જુઓ.';
      irrigationAdvice = 'ઊંચા પાક (ઘઉં, જુવાર) ઢળી ન પડે તે માટે પિયત ધીમે આપો.';
    } else if (temp > 38) {
      condition = 'તીવ્ર ગરમી (Heat Stress)';
      sprayAdvice = 'બપોરના સમયે છંટકાવ ન કરવો, પાન દાઝી જવાની શક્યતા છે.';
      irrigationAdvice = 'પાકને ગરમીથી બચાવવા સાંજે કે રાત્રે પિયત આપવું.';
    }

    res.json({
      district: districtName,
      district_gu: districtName,
      temperature: temp,
      apparent_temperature: Math.round(current.apparent_temperature || temp),
      humidity,
      rain,
      rain_probability: rain > 0 ? 80 : 15,
      wind_speed: wind,
      weather_code: current.weather_code,
      weather_condition_gu: condition,
      spray_advice_gu: sprayAdvice,
      irrigation_advice_gu: irrigationAdvice,
      updated_at: new Date().toLocaleTimeString('gu-IN', { hour: '2-digit', minute: '2-digit' })
    });
  } catch (error: any) {
    console.error('Weather fetch error:', error);
    res.status(500).json({ error: 'હવામાન ડેટા મેળવવામાં ત્રુટિ આવી.' });
  }
});

/**
 * Static file serving & Vite Dev Server integration
 */
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌱 AI Plant Doctor server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
