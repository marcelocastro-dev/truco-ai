
import { GoogleGenAI, Type } from "@google/genai";
import { GameState, AIResponse, Player } from "../types";

// Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getAIAction = async (gameState: GameState, player: Player): Promise<AIResponse> => {
  const prompt = `
    You are a professional Brazilian Truco player (Truco Paulista).
    Game State:
    - Team Scores: Team 1: ${gameState.teamScores[0]}, Team 2: ${gameState.teamScores[1]}
    - Vira: ${gameState.vira?.rank} of ${gameState.vira?.suit}
    - Manilha (Strongest rank): ${gameState.manilhaRank}
    - Your Hand: ${JSON.stringify(player.hand)}
    - Table (Played Cards this round): ${JSON.stringify(gameState.playedCards)}
    - Current Round Status: Mini-round winners: ${gameState.roundResults}
    - Current Truco Value: ${gameState.trucoValue}
    - Waiting for response: ${gameState.waitingForTrucoResponse}

    Rules:
    - 4, 5, 6, 7, Q, J, K, A, 2, 3 is the strength order.
    - Manilha is the next rank after the Vira.
    - Team 1 is Players 0 and 2. Team 2 is Players 1 and 3.

    Your Decision:
    - If someone called Truco and waitingForTrucoResponse is true, you must "accept" or "refuse".
    - Otherwise, you must "play" a card (specify cardIndex) or call "truco" (if value < 12).

    Respond in JSON format.
  `;

  try {
    // Using gemini-3-pro-preview for complex reasoning task (card game strategy)
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING, enum: ['play', 'truco', 'accept', 'refuse'] },
            cardIndex: { type: Type.NUMBER },
            message: { type: Type.STRING }
          },
          required: ['action']
        }
      }
    });

    // Directly access text property from response
    const result = JSON.parse(response.text || '{}') as AIResponse;
    
    // Safety checks
    if (result.action === 'play' && (result.cardIndex === undefined || result.cardIndex >= player.hand.length)) {
      result.cardIndex = 0;
    }
    
    return result;
  } catch (error) {
    console.error("Gemini AI Error:", error);
    // Basic fallback to play first card in case of error
    return { action: 'play', cardIndex: 0 };
  }
};
