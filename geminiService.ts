import { GoogleGenAI } from "@google/genai";
import type { Form } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });


const getPrompt = (textContent: string) => `
You are an expert 'Quiz Architect AI'. Your single, most important mission is to convert the provided text into a perfectly structured JSON object for a Google Form that can be automatically graded. To do this, you MUST identify the correct answer for every gradable question and assign it points.

**CRITICAL RULES:**
1.  Your output MUST be a single, valid JSON object. Do not include any surrounding text, explanations, or markdown fences (like \`\`\`json). The entire response must be raw JSON.
2.  The root of the JSON object MUST have three keys: "title", "description", and "items". You must always generate a suitable title and description.
3.  Strictly follow all JSON syntax rules. No trailing commas.

**JSON STRUCTURE:**
{
  "title": "string",
  "description": "string",
  "items": [
    {
      "title": "string",
      "description": "string", // ONLY for 'SECTION_HEADER'. Holds the passage text. Omit for all other types.
      "type": "ONE_OF_ENUM",
      "options": ["string"], // This key MUST be omitted if 'type' is not 'MULTIPLE_CHOICE', 'CHECKBOXES', or 'DROPDOWN'.
      "points": number,      // MUST include for gradable questions. Default to 1 if not specified.
      "correctAnswer": "string" | ["string"], // MUST include for gradable questions. Use an array of strings ONLY for 'CHECKBOXES'.
      "required": boolean    // Omit if not required.
    }
  ]
}

**VALID ITEM TYPES ('type' field):**
- 'SHORT_ANSWER'
- 'PARAGRAPH'
- 'MULTIPLE_CHOICE'
- 'CHECKBOXES'
- 'DROPDOWN'
- 'SECTION_HEADER' // Use this for text blocks, like reading passages.

**PARSING, GRADING, AND ANSWERING INSTRUCTIONS (MANDATORY):**
1.  **Name Field:** The first item in the "items" array MUST always be a 'Name' question: \`{ "title": "Name", "type": "SHORT_ANSWER", "required": true }\`. It should not have points.
2.  **Required Questions**: All gradable questions (\`MULTIPLE_CHOICE\`, \`CHECKBOXES\`, \`DROPDOWN\`, and gradable \`SHORT_ANSWER\`) MUST be made mandatory by adding \`"required": true\`.
3.  **Prioritize Choice Questions:** Whenever it is reasonable, you MUST convert questions that could be a 'SHORT_ANSWER' into a choice-based question type instead.
    - For questions with a single, factual answer (e.g., "What is the capital of France?"), convert them to \`MULTIPLE_CHOICE\`. You are responsible for creating plausible incorrect options (distractors).
    - Favor \`DROPDOWN\` for fill-in-the-blank style questions.
    - Only use \`SHORT_ANSWER\` if the question is open-ended but still gradable, or if generating choices is not practical.
4.  **Reading Passages:** For reading exercises, use a \`SECTION_HEADER\` item for the passage text itself, followed by the related questions.
5.  **Fill-in-the-Blank Questions:**
    - If you find a passage with blanks (e.g., \`___\` or \`[BLANK]\`) and a list of words (a "word bank"), you MUST handle it as follows:
    - First, create a \`SECTION_HEADER\` item. The \`title\` can be "Passage" or similar, and the \`description\` MUST contain the full passage with the blanks and the word bank.
    - Then, for EACH blank, create a separate \`DROPDOWN\` question.
    - The \`title\` for each dropdown should identify which blank it corresponds to (e.g., "Blank #1: 'The ___ is blue.'").
    - The \`options\` for EACH dropdown MUST be the complete list of words from the word bank.
    - You MUST identify the correct word for that specific blank and set it as the \`correctAnswer\`.
    - These \`DROPDOWN\` questions MUST be gradable: include \`"points": 1\` and \`"required": true\`.
6.  **Cleanliness:** Remove prefixes like "Q1." or "A)" from titles and options.
7.  **GRADING AND ANSWER IDENTIFICATION (YOUR #1 PRIORITY):**
    - Your purpose is to create a quiz, not just a form. Therefore, you must be aggressive in identifying correct answers and making questions gradable.
    - **\`MULTIPLE_CHOICE\` / \`CHECKBOXES\` / \`DROPDOWN\`:**
        - These questions are ALWAYS gradable.
        - You MUST include a \`"points": 1\` (or more, if specified).
        - You MUST include the \`"correctAnswer"\` key. Find the correct answer in the text.
        - For \`CHECKBOXES\`, \`correctAnswer\` MUST be an array of strings (e.g., \`["Answer A", "Answer C"]\`). For others, it's a single string.
        - The value(s) in \`correctAnswer\` must exactly match one of the values in the \`options\` array.
    - **\`SHORT_ANSWER\`:**
        - Make this type gradable whenever possible, but prefer converting to a choice question (see rule #3).
        - If the answer is objective and factual (e.g., "What is the capital of France?", "Solve for x"), you MUST treat it as a gradable question.
        - For gradable \`SHORT_ANSWER\` questions, you MUST include \`"points": 1\`, the \`"correctAnswer"\` key with the precise string answer, and \`"required": true\`.
        - ONLY if the answer is subjective or an opinion (e.g., "What did you think?"), should you OMIT \`points\` and \`correctAnswer\`.
    - **Non-Gradable Types:**
        - \`PARAGRAPH\`, \`SECTION_HEADER\`: These are never graded. You MUST OMIT \`points\` and \`correctAnswer\` for these types.

---
**EXAMPLE 1: Quiz with various questions**
Input Text: "Geography Quiz. 1. What is the capital of Japan? The answer is Tokyo. 2. Which two of the following are continents? A) Asia, B) Pacific, C) Africa. Correct answers are Asia and Africa. 3. What are your thoughts on geography?"
Correct JSON Output:
{
  "title": "Geography Quiz",
  "description": "A quiz about world geography.",
  "items": [
    { "title": "Name", "type": "SHORT_ANSWER", "required": true },
    { "title": "What is the capital of Japan?", "type": "MULTIPLE_CHOICE", "options": ["Tokyo", "Kyoto", "Osaka"], "points": 1, "correctAnswer": "Tokyo", "required": true },
    { "title": "Which two of the following are continents?", "type": "CHECKBOXES", "options": ["Asia", "Pacific", "Africa"], "points": 1, "correctAnswer": ["Asia", "Africa"], "required": true },
    { "title": "What are your thoughts on geography?", "type": "PARAGRAPH" }
  ]
}

---
**EXAMPLE 2: Fill-in-the-Blank Quiz**
Input Text: "Complete the sentences. Use these words: [sky, car]. 1. The ___ is blue. 2. A ___ has four wheels."
Correct JSON Output:
{
  "title": "Sentence Completion",
  "description": "Complete the sentences with the correct words.",
  "items": [
    { "title": "Name", "type": "SHORT_ANSWER", "required": true },
    {
      "title": "Passage",
      "type": "SECTION_HEADER",
      "description": "Complete the sentences using the word bank below.\\n\\n1. The ___ is blue.\\n2. A ___ has four wheels.\\n\\nWord Bank: [sky, car]"
    },
    { "title": "Sentence 1: The ___ is blue.", "type": "DROPDOWN", "options": ["sky", "car"], "points": 1, "correctAnswer": "sky", "required": true },
    { "title": "Sentence 2: A ___ has four wheels.", "type": "DROPDOWN", "options": ["sky", "car"], "points": 1, "correctAnswer": "car", "required": true }
  ]
}

---
**Text to Analyze:**
---
${textContent}
---
`;

/**
 * Attempts to fix common JSON errors from LLM output, like trailing commas.
 */
function sanitizeJsonString(jsonStr: string): string {
    // Remove trailing commas from objects and arrays.
    // Handles cases like { "a": 1, } and [ "b", ]
    return jsonStr.replace(/,(?=\s*?[}\]])/g, '');
}

export const extractTextFromImage = async (base64ImageData: string): Promise<string> => {
  try {
    const imagePart = {
      inlineData: {
        mimeType: 'image/png',
        data: base64ImageData,
      },
    };

    const textPart = {
      text: 'Perform OCR on this image. Extract all visible text exactly as it appears. Maintain paragraph and line breaks.'
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        temperature: 0, // Be very factual for OCR
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    return response.text;
  } catch (error) {
    console.error("Error extracting text from image with Gemini:", error);
    throw new Error("Failed to perform OCR on the image. The service might be unavailable.");
  }
};


export const generateFormFromText = async (textContent: string): Promise<Form> => {
  try {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: getPrompt(textContent),
        config: {
          responseMimeType: "application/json",
          temperature: 0.1, // Lower temperature for more deterministic, structured output
          thinkingConfig: { thinkingBudget: 0 }, // Optimize for speed by disabling thinking
        },
    });

    let jsonStr = response.text.trim();
    
    // 1. Remove markdown fences
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
        jsonStr = match[2].trim();
    }
    
    // 2. Sanitize for common errors like trailing commas
    const sanitizedJsonStr = sanitizeJsonString(jsonStr);

    const parsedData = JSON.parse(sanitizedJsonStr) as Form;

    if (!parsedData.title || !parsedData.description || !Array.isArray(parsedData.items)) {
        throw new Error("AI response is missing required fields (title, description, or items).");
    }

    return parsedData;

  } catch (error) {
    console.error("Error generating form from Gemini:", error);
    if (error instanceof SyntaxError) {
       // Provide a more helpful message for parsing errors
       throw new Error("The AI's response couldn't be processed. This can happen with complex requests. Please try simplifying or rephrasing your input.");
    }
    if (error instanceof Error && error.message.includes("AI response is missing required fields")) {
      throw error;
    }
    throw new Error("Failed to generate form from AI. The service might be temporarily unavailable or the input is too complex.");
  }
};