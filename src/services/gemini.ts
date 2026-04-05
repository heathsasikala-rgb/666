import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const geminiService = {
  async recognizeAndAnalyze(base64Image: string) {
    const model = "gemini-3-flash-preview";
    const prompt = `
      Analyze this image of a wrong question. 
      1. Extract the question text.
      2. Identify the core knowledge point (e.g., "Quadratic Equation", "Present Perfect Tense").
      3. Extract options if any.
      4. Extract user answer and correct answer if visible.
      Return the result in JSON format.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { data: base64Image, mimeType: "image/jpeg" } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            knowledgePoint: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            userAnswer: { type: Type.STRING },
            correctAnswer: { type: Type.STRING },
          },
          required: ["text", "knowledgePoint"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  },

  async generateAnalogies(questionText: string, knowledgePoint: string) {
    const model = "gemini-3-flash-preview";
    const prompt = `
      Based on the following question and knowledge point, generate 3 similar "analogy" questions (举一反三).
      Original Question: ${questionText}
      Knowledge Point: ${knowledgePoint}

      Requirements:
      1. Cover different angles or variations of the same knowledge point.
      2. Difficulty should be similar or slightly higher than the original.
      3. Each analogy must include:
         - Question text
         - Correct answer
         - Analysis focusing on common mistakes (易错点分析).
      Return the result in JSON format.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              answer: { type: Type.STRING },
              analysis: { type: Type.STRING },
            },
            required: ["text", "answer", "analysis"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  }
};
