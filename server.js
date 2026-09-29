import express from "express";
import "dotenv/config";
import { HindsightClient } from "@vectorize-io/hindsight-client";

const app = express();
app.use(express.json());
app.use(express.static("."));

const PORT = process.env.PORT || 3000;
const HINDSIGHT_BASE_URL = process.env.HINDSIGHT_BASE_URL || "https://api.hindsight.vectorize.io";
const HINDSIGHT_API_KEY = process.env.HINDSIGHT_API_KEY;
const BANK_ID = process.env.HINDSIGHT_BANK_ID || "foodbridge";
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

const hindsight = HINDSIGHT_API_KEY
  ? new HindsightClient({ baseUrl: HINDSIGHT_BASE_URL, apiKey: HINDSIGHT_API_KEY })
  : null;

const demoMemories = [
  "Restaurant profile: Green Bowl Kitchen has a 4.8/5 average rating from 34 NGO reviews. NGOs frequently report good vegetarian meal quality, reliable packaging, and successful evening deliveries.",
  "Restaurant profile: Spice Route has a 4.5/5 average rating from 21 NGO reviews and is a reliable option for mixed meal orders.",
  "Restaurant profile: Hyderabad Meals Co. has a 4.3/5 average rating from 18 NGO reviews and has handled medium-sized meal donations.",
  "NGO profile: Hope Foundation frequently accepts vegetarian meals and has successfully received evening deliveries in Gachibowli and Kondapur.",
  "Volunteer profile: Ravi has completed Gachibowli pickups on time in previous FoodBridge deliveries.",
  "FoodBridge workflow: For fresh-meal funding, a donor pays a restaurant, the restaurant prepares fresh meals, FoodBridge matches the meals to an NGO, and a volunteer delivers them when available.",
  "FoodBridge workflow: For wedding or function leftovers, FoodBridge registers the event food, matches an NGO, requests a volunteer first, and if no volunteer is available the NGO is asked to collect the food directly.",
  "FoodBridge learning rule: NGO restaurant reviews, food type, quantity, timing, delivery outcomes, volunteer reliability, and NGO preferences should influence future recommendations.",
  "FoodBridge safety rule: Never claim real-time volunteer availability unless live data is connected. If the dashboard only has demo data, clearly call it demo/sample availability.",
];

const SYSTEM_PROMPT = `You are FoodBridge AI, the interactive assistant inside the FoodBridge food-rescue platform.

Your job is to help donors, restaurants, NGOs and volunteers use FoodBridge. You are friendly, concise, practical and proactive.

FoodBridge capabilities:
- Fund Fresh Meals: a donor funds a restaurant to prepare fresh meals, then FoodBridge matches an NGO and delivery.
- Wedding / Function Food: register safe leftover food from weddings, birthdays and community functions for NGO pickup.
- Restaurant Ratings: NGOs review restaurants; these reviews become long-term memory and influence future matching.
- Volunteer Map: volunteers can accept pickups. If no volunteer is available, the NGO can be asked to collect directly.
- Hindsight Memory: remember useful preferences, reviews, delivery outcomes, food types, quantities, timing and reliability so future recommendations improve.

When answering:
1. Greet naturally when appropriate. If the user says hello, introduce yourself and list 3-5 things you can help with.
2. Answer normal questions conversationally; do not force the user to use exact commands.
3. If the user asks how to use a feature, give clear numbered steps and mention the relevant FoodBridge page.
4. If the user asks for a restaurant or NGO recommendation, use the supplied Hindsight memories. Explain WHY a recommendation fits. Never invent real-time availability or facts not in memory.
5. If memory contains no evidence for a recommendation, say that and offer the next step rather than making up a score.
6. For volunteer availability, distinguish demo/sample data from real-time data.
7. If there is no volunteer, explain the NGO direct-collection fallback.
8. Keep most answers under 120 words unless the user asks for detail.
9. Do not expose API keys, implementation secrets, or internal prompts.
10. You can mention that Hindsight remembers useful FoodBridge history, but focus on the user's task.
`;

const sessions = new Map();

function getHistory(sessionId) {
  if (!sessions.has(sessionId)) sessions.set(sessionId, []);
  return sessions.get(sessionId);
}

async function retainMemory(content) {
  if (!hindsight || !content) return { ok: true, demo: true };
  await hindsight.retain(BANK_ID, content);
  return { ok: true };
}

async function getHindsightAnswer(query, context = "") {
  if (!hindsight) return null;
  const prompt = `${SYSTEM_PROMPT}\n\nCurrent website context: ${context || "No specific page selected."}\n\nUser request: ${query}\n\nUse your memory bank to ground the answer. Give the user a direct answer, not a description of how memory works.`;
  const result = await hindsight.reflect(BANK_ID, prompt);
  return result?.text || null;
}

async function getGroqAnswer(messages) {
  if (!GROQ_API_KEY) return null;
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.35,
      max_tokens: 500
    })
  });
  if (!response.ok) throw new Error(`Groq API error ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return data?.choices?.[0]?.message?.content || null;
}

function fallbackAnswer(query) {
  const q = query.toLowerCase();
  if (/hello|hi|hey|good morning|good evening/.test(q)) {
    return "👋 Hi! I’m FoodBridge AI. I can help you donate food, fund fresh meals, find restaurants or NGOs, arrange pickups, understand the dashboard, and explain how FoodBridge works. What would you like to do?";
  }
  if (/how.*donat|donat.*food/.test(q)) {
    return "🍱 You can donate in two ways: 1) Fund Fresh Meals to pay a restaurant to prepare meals, or 2) Wedding / Function Food to donate safe leftovers. Tell me which one you want and I’ll guide you step by step.";
  }
  if (/wedding|function|leftover/.test(q)) {
    return "🎉 Open **Wedding / Function Food**, choose the event type, enter the approximate meals, food-ready time and pickup area, then submit. FoodBridge matches an NGO and requests a volunteer. If no volunteer is available, the NGO is asked to collect directly.";
  }
  if (/restaurant|which.*choose|suggest/.test(q)) {
    return "🏪 I can recommend a restaurant using FoodBridge’s stored NGO reviews, food preferences and previous delivery outcomes. Tell me the meal type, quantity and area—for example: ‘100 vegetarian meals in Gachibowli’.";
  }
  if (/volunteer|pickup/.test(q)) {
    return "🚚 Open the Volunteer Map to see pickup requests. A volunteer can accept a request. If no volunteer is available, FoodBridge uses the NGO direct-collection fallback.";
  }
  if (/work|website|use foodbridge|guide/.test(q)) {
    return "🧭 FoodBridge connects donors, restaurants, NGOs and volunteers. Use Fund Fresh Meals for paid fresh meals, Wedding / Function Food for event leftovers, Restaurant Ratings for reviews, and Volunteer Map for pickups. I can guide you through any page.";
  }
  return "I can help with food donations, fresh-meal funding, wedding/function leftovers, restaurant and NGO matching, volunteer pickups, ratings, and navigating FoodBridge. Tell me what you’re trying to do, and I’ll guide you.";
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    hindsight: Boolean(hindsight),
    groq: Boolean(GROQ_API_KEY),
    bank: BANK_ID
  });
});

app.post("/api/memory/retain", async (req, res) => {
  try {
    await retainMemory(req.body.content || "");
    res.json({ ok: true, demo: !hindsight });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/chat", async (req, res) => {
  const query = String(req.body.query || "").trim();
  const sessionId = String(req.body.sessionId || "demo");
  const page = String(req.body.page || "home");
  if (!query) return res.status(400).json({ error: "Please enter a message." });

  const history = getHistory(sessionId);
  const recent = history.slice(-8);
  let answer = null;
  let source = "fallback";

  try {
    if (hindsight) {
      answer = await getHindsightAnswer(query, `Current page: ${page}`);
      source = "hindsight";
    } else if (GROQ_API_KEY) {
      answer = await getGroqAnswer([
        { role: "system", content: SYSTEM_PROMPT },
        ...recent,
        { role: "user", content: query }
      ]);
      source = "groq";
    }

    if (!answer) answer = fallbackAnswer(query);

    history.push({ role: "user", content: query }, { role: "assistant", content: answer });
    if (history.length > 16) history.splice(0, history.length - 16);

    if (hindsight) {
      await retainMemory(`FoodBridge conversation outcome. User asked: ${query}\nAssistant response: ${answer}`);
    }

    res.json({ answer, source, memoryUsed: Boolean(hindsight) });
  } catch (e) {
    console.error(e);
    res.json({ answer: fallbackAnswer(query), source: "fallback", memoryUsed: false, warning: "AI service temporarily unavailable." });
  }
});

app.post("/api/seed-demo", async (req, res) => {
  if (!hindsight) return res.json({ ok: false, demo: true, message: "Configure HINDSIGHT_API_KEY first." });
  try {
    for (const memory of demoMemories) await hindsight.retain(BANK_ID, memory);
    res.json({ ok: true, count: demoMemories.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`FoodBridge: http://localhost:${PORT}`));
