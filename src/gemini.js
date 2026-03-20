import { optimizeImage } from './utils.js';

let initialized = false;

/**
 * Initialize the Gemini client.
 * Using hardcoded Vertex AI REST URL instead of SDK.
 */
export function initGemini(apiKey) {
  initialized = true;
}

/**
 * Check if Gemini is initialized.
 */
export function isInitialized() {
  return initialized;
}

/**
 * Convert a File to a Gemini-compatible inline data part.
 */
async function fileToGenerativePart(file) {
  const base64 = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: {
      data: base64,
      mimeType: file.type,
    },
  };
}

/**
 * Build the structured prompt for medical document parsing.
 */
function buildPrompt(textInput, voiceTranscript) {
  const userContext = [];
  if (textInput) userContext.push(`Patient's typed notes:\n${textInput}`);
  if (voiceTranscript) userContext.push(`Patient's voice description:\n${voiceTranscript}`);

  return `You are an expert medical records analyst. Analyze ALL provided medical documents (images, text) and any patient-provided context to create a comprehensive, structured medical profile.

${userContext.length > 0 ? userContext.join('\n\n') : ''}

IMPORTANT INSTRUCTIONS:
1. Extract EVERY piece of medical information from the documents and context.
2. Cross-reference medications to identify potential drug interactions.
3. Flag any abnormal lab values.
4. Generate a concise 30-second ER summary that a doctor can read at a glance.
5. If information is unclear or partially visible, make your best inference and note the uncertainty.
6. If certain fields have no data, use empty arrays or "Unknown".

Return your analysis as a JSON object with EXACTLY this structure (no markdown, no code fences, just raw JSON):

{
  "patient": {
    "name": "string or Unknown",
    "age": "string or Unknown",
    "sex": "string or Unknown",
    "bloodType": "string or Unknown",
    "weight": "string or Unknown",
    "height": "string or Unknown",
    "emergencyContact": "string or Unknown"
  },
  "conditions": [
    {
      "name": "condition name",
      "diagnosedDate": "date or Unknown",
      "status": "active | resolved | managed",
      "notes": "brief notes"
    }
  ],
  "medications": [
    {
      "name": "medication name",
      "dosage": "dosage",
      "frequency": "how often",
      "prescribedBy": "doctor name or Unknown",
      "startDate": "date or Unknown",
      "purpose": "what it treats"
    }
  ],
  "allergies": [
    {
      "allergen": "allergen name",
      "severity": "mild | moderate | severe",
      "reaction": "description of reaction"
    }
  ],
  "labResults": [
    {
      "test": "test name",
      "value": "result value",
      "unit": "unit",
      "date": "test date",
      "normalRange": "normal range",
      "flag": "high | low | normal"
    }
  ],
  "procedures": [
    {
      "name": "procedure name",
      "date": "date",
      "hospital": "location or Unknown",
      "notes": "brief notes"
    }
  ],
  "drugInteractions": [
    {
      "drug1": "first medication",
      "drug2": "second medication",
      "severity": "high | moderate | low",
      "description": "description of the interaction and risks"
    }
  ],
  "erSummary": "A concise paragraph that an ER doctor can read in 30 seconds. Include: key conditions, current medications, critical allergies, and any red flags. This should be immediately actionable."
}`;
}

/**
 * Parse medical documents using Gemini.
 * @param {File[]} files - Array of uploaded files (images, etc.)
 * @param {string} textInput - Free-form text input
 * @param {string} voiceTranscript - Voice transcript
 * @param {function} onStatus - Status update callback
 * @returns {Promise<object>} Structured medical profile
 */
export async function parseDocuments(files, textInput, voiceTranscript, onStatus) {
  if (!initialized) throw new Error('Gemini not initialized.');

  onStatus?.('Preparing documents for analysis...');

  // Build content parts
  const parts = [];

  // Add text prompt
  parts.push({ text: buildPrompt(textInput, voiceTranscript) });

  // Convert files to inline data
  if (files && files.length > 0) {
    onStatus?.(`Processing ${files.length} document(s)...`);
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const optimized = await optimizeImage(file);
        const part = await fileToGenerativePart(optimized);
        parts.push(part);
      } else if (file.type === 'application/pdf') {
        const part = await fileToGenerativePart(file);
        parts.push(part);
      } else if (file.type === 'text/plain') {
        const text = await file.text();
        parts.push({ text: `\n\nContent of text file "${file.name}":\n${text}` });
      }
    }
  }

  onStatus?.('Analyzing with Gemini AI...');

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "YOUR_GEMINI_API_KEY";
  const REST_URL = `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash-lite:streamGenerateContent?key=${apiKey}`;
  
  const payload = {
    contents: [
      {
        role: "user",
        parts: parts
      }
    ]
  };

  const response = await fetch(REST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
  }

  // streamGenerateContent returns an array of chunks
  const jsonResponse = await response.json();
  
  let text = '';
  if (Array.isArray(jsonResponse)) {
    for (const chunk of jsonResponse) {
      if (chunk.candidates?.[0]?.content?.parts?.[0]?.text) {
        text += chunk.candidates[0].content.parts[0].text;
      }
    }
  } else {
    // Fallback if not stream format
    text = jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  onStatus?.('Structuring medical profile...');

  // Clean up response — remove markdown code fences if present
  text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  try {
    return JSON.parse(text);
  } catch (e) {
    // If JSON parse fails, try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Failed to parse Gemini response as structured data. Raw response:\n' + text.substring(0, 500));
  }
}
