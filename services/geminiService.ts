
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult, SentimentType } from "../types";

const MODEL_NAME = "gemini-2.5-flash";

// JSON Schema for structured output
const sentimentSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      sentiment: {
        type: Type.STRING,
        enum: ["Positive", "Negative", "Neutral"],
        description: "The general sentiment classification.",
      },
      emotion: {
        type: Type.STRING,
        description: "The primary specific emotion (e.g., Joy, Anger, Sadness, Surprise, Frustration, Gratitude).",
      },
      emotionEmoji: {
        type: Type.STRING,
        description: "A single unicode emoji representing the specific emotion detected (e.g., 😠, 😂, 😭, 🤩).",
      },
      isSarcastic: {
        type: Type.BOOLEAN,
        description: "True if the text contains sarcasm or irony, false otherwise.",
      },
      confidence: {
        type: Type.NUMBER,
        description: "Confidence score between 0.0 and 1.0.",
      },
      keywords: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "List of key words or phrases that influenced the sentiment decision.",
      },
      explanation: {
        type: Type.STRING,
        description: "A concise, one-sentence explanation of why this sentiment and emotion were chosen.",
      },
    },
    required: ["sentiment", "emotion", "emotionEmoji", "isSarcastic", "confidence", "keywords", "explanation"],
  },
};

// Custom Error Class for categorized handling
export class GeminiError extends Error {
  constructor(
    message: string, 
    public code: 'AUTH_ERROR' | 'RATE_LIMIT' | 'SERVER_ERROR' | 'SAFETY_BLOCK' | 'PARSE_ERROR' | 'INVALID_REQUEST' | 'UNKNOWN',
    public solution?: string,
    public status?: number
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

/**
 * cleans the response string to ensure it is valid JSON
 * sometimes models return markdown code blocks ```json ... ```
 */
const cleanJsonString = (str: string): string => {
  let clean = str.replace(/```json\n?|```/g, '').trim();
  // Attempt to find the first '[' and last ']' to handle extra text
  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']');
  if (start !== -1 && end !== -1) {
    clean = clean.substring(start, end + 1);
  }
  return clean;
};

export const analyzeSentimentBatch = async (
  texts: string[],
  apiKey: string
): Promise<Omit<AnalysisResult, 'id' | 'timestamp' | 'text'>[]> => {
  if (!apiKey) {
    throw new GeminiError(
      "API Key is missing", 
      "AUTH_ERROR", 
      "Please configure your API key in the settings menu."
    );
  }
  if (texts.length === 0) return [];

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Analyze the sentiment of the following texts. 
    For each text:
    1. Identify the Sentiment (Positive, Negative, Neutral).
    2. Identify the specific Primary Emotion (one word, e.g., Joy, Anger, Disappointment).
    3. Select a single Emoji that best represents that emotion.
    4. Detect if it is Sarcastic (boolean).
    5. Provide a confidence score (0.0 to 1.0).
    6. Extract key phrases that drove the analysis.
    7. Provide a concise explanation (1 sentence) for the classification.
    
    Texts to analyze:
    ${JSON.stringify(texts)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: sentimentSchema,
        systemInstruction: "You are an expert NLP sentiment analysis engine. Detect nuance, sarcasm, and specific emotions accurately.",
        temperature: 0.2, 
      },
    });

    // 1. Check for empty candidates (Safety Blocking)
    if (!response.candidates || response.candidates.length === 0) {
      throw new GeminiError(
        "Analysis blocked by safety filters.", 
        "SAFETY_BLOCK",
        "The content may violate safety policies (harassment, hate speech, etc.). Try rephrasing the text."
      );
    }

    const jsonText = response.text;
    if (!jsonText) {
       throw new GeminiError(
         "Received empty response from AI model.", 
         "SERVER_ERROR",
         "The model returned an empty result. Please try again."
       );
    }

    // 2. Parse JSON safely
    let parsedData;
    try {
      parsedData = JSON.parse(cleanJsonString(jsonText));
    } catch (e) {
      console.error("JSON Parse Error", jsonText);
      throw new GeminiError(
        "Failed to process model response.", 
        "PARSE_ERROR",
        "The AI returned malformed JSON. This is usually temporary, please retry."
      );
    }

    if (!Array.isArray(parsedData)) {
      throw new GeminiError(
        "Invalid response structure.", 
        "PARSE_ERROR",
        "Expected a list of results but got something else."
      );
    }

    // 3. Normalize Data
    return parsedData.map((item) => ({
      sentiment: (item.sentiment as SentimentType) || SentimentType.NEUTRAL,
      emotion: item.emotion || "Neutral",
      emotionEmoji: item.emotionEmoji || "😐",
      isSarcastic: !!item.isSarcastic,
      confidence: typeof item.confidence === 'number' ? item.confidence : 0.5,
      keywords: Array.isArray(item.keywords) ? item.keywords : [],
      explanation: item.explanation || "No explanation provided.",
    }));

  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);

    if (error instanceof GeminiError) throw error;

    // Map SDK/HTTP errors to user friendly codes
    const msg = error.message || '';
    const status = error.status || error.response?.status; // generic attempt to find status

    if (msg.includes('401') || msg.includes('403') || msg.includes('API key') || status === 401 || status === 403) {
      throw new GeminiError(
        "Invalid API Key or Permissions.", 
        "AUTH_ERROR",
        "Please verify your API key. Ensure it is valid, active, and has access to the Gemini API.",
        status
      );
    }
    
    if (msg.includes('429') || msg.includes('Quota') || status === 429) {
      throw new GeminiError(
        "Rate limit exceeded.", 
        "RATE_LIMIT",
        "You are sending requests too quickly. Please wait a moment before trying again, or reduce the batch size.",
        429
      );
    }
    
    if (msg.includes('503') || msg.includes('Overloaded') || status === 503) {
      throw new GeminiError(
        "AI Service Unavailable.", 
        "SERVER_ERROR",
        "The Gemini service is currently overloaded. Please try again in a few minutes.",
        503
      );
    }

    if (status === 400 || msg.includes('400')) {
       throw new GeminiError(
        "Invalid Request.",
        "INVALID_REQUEST",
        "The request was malformed. Please check your input text for unsupported characters or format.",
        400
       );
    }

    if (status === 404 || msg.includes('404')) {
        throw new GeminiError(
         "Model Not Found.",
         "INVALID_REQUEST",
         `The model '${MODEL_NAME}' was not found. It may be deprecated or not available in your region.`,
         404
        );
     }

    throw new GeminiError(
      "An unexpected network or API error occurred.", 
      "UNKNOWN",
      "Check your internet connection and try again. If the issue persists, check the console for logs.",
      status
    );
  }
};