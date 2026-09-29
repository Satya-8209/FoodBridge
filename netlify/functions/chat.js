import { HindsightClient } from "@vectorize-io/hindsight-client";

const client = new HindsightClient({
  baseUrl:
    process.env.HINDSIGHT_BASE_URL ||
    "https://api.hindsight.vectorize.io",
  apiKey: process.env.HINDSIGHT_API_KEY
});

export default async (request) => {
  try {
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({
          error: "Only POST requests are allowed"
        }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const body = await request.json();

    const message = body.message?.trim();

    if (!message) {
      return new Response(
        JSON.stringify({
          error: "Please enter a message."
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const bankId =
      process.env.HINDSIGHT_BANK_ID || "foodbridge";

    /*
     * Store the user's latest message in Hindsight.
     * This is important because the agent should learn
     * from FoodBridge interactions.
     */
    await client.retain(
      bankId,
      `FoodBridge user interaction: ${message}`
    );

    /*
     * Ask Hindsight to reason over relevant memories.
     */
    const response = await client.reflect(
      bankId,
      `
You are FoodBridge AI, a friendly assistant for the FoodBridge
food-donation platform.

FoodBridge connects restaurants, NGOs, donors and volunteers.

You help users with:

- Donating leftover restaurant food
- Donating wedding/function leftover food
- Funding fresh meals
- Finding suitable restaurants
- Finding NGOs
- Understanding volunteer delivery
- Explaining what happens when no volunteer is available
- Restaurant ratings and reviews
- Explaining how to use the FoodBridge website

IMPORTANT:
Use relevant memories from previous FoodBridge interactions
when answering.

If a restaurant has previously performed successfully,
mention that history when it is relevant.

If an NGO has previously rated a restaurant positively,
use that information when appropriate.

Do not invent real-time volunteer availability.

Do not claim that a payment or donation was completed unless
the website actually confirms it.

Be friendly, clear and concise.

If the user asks how to use FoodBridge, give simple
step-by-step instructions.

User's latest message:
${message}
      `,
      {
        budget: "mid"
      }
    );

    return new Response(
      JSON.stringify({
        answer:
          response?.text ||
          "I couldn't generate a response right now.",
        memoryUsed: true,
        basedOn: response?.based_on || []
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    console.error("FoodBridge Hindsight error:", error);

    return new Response(
      JSON.stringify({
        error: "FoodBridge AI service error",
        details: error.message
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
};