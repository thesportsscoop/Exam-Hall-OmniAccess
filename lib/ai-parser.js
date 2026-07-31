/**
 * AI-Powered Question Parser
 *
 * Uses Gemini API to parse raw text (pasted, extracted from PDF/DOCX, or OCR'd from images)
 * into structured exam questions (MCQ and/or Essay).
 *
 * Features:
 * - Parses pasted text into MCQ and Essay questions
 * - Extracts marking schemes if provided in the text
 * - Auto-generates marking schemes for essay questions when not provided
 * - Accepts text extracted from PDF, DOCX, TXT, and image files (OCR)
 * - Returns structured JSON for teacher review
 *
 * API Key: AIzaSyA00QoG1hY8uweGRGKDJ-NSH9tk20R3GUc (primary)
 * Fallback Key: Q.Ab8RN6J1ClIPWs6UAlYF3SEEwF1hEzgsdwGD634TrlmvO1ppdA
 */

// Gemini API configuration - prioritize environment variables, fall back to hardcoded keys
const GEMINI_API_KEYS = [
  process.env.GEMINI_API_KEY || 'AIzaSyA00QoG1hY8uweGRGKDJ-NSH9tk20R3GUc',
  process.env.GEMINI_API_KEY_BACKUP || 'Q.Ab8RN6J1ClIPWs6UAlYF3SEEwF1hEzgsdwGD634TrlmvO1ppdA',
].filter(Boolean);

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Rate limiting state (shared with ai-generator for consistency)
let currentKeyIndex = 0;
let lastRequestTime = 0;
const minRequestInterval = 1000; // 1 second between requests

/**
 * Build the AI parsing prompt
 * @param {string} text - Raw text to parse
 * @param {string} examFormat - 'mcq', 'essay', or 'hybrid'
 * @returns {string} The full prompt for Gemini
 */
function buildParsePrompt(text, examFormat = 'hybrid') {
  const formatContext =
    examFormat === 'mcq'
      ? 'This exam is Multiple Choice format. Parse all questions as MCQ.'
      : examFormat === 'essay'
      ? 'This exam is Essay format. Parse all questions as Essay.'
      : 'This exam is Hybrid format. Parse questions as a mix of MCQ and Essay.';

  return `You are an expert exam question parser. Your task is to parse the following text into structured exam questions.

${formatContext}

INSTRUCTIONS:
1. Identify each question and its type (mcq or essay).
2. For MCQ questions:
   - Extract the question text
   - Extract all options (A, B, C, D, E)
   - Identify the correct answer letter (from an answer key if provided, otherwise infer from context or mark the first option as correct)
   - Set points to 1 (or the value specified in the text)
   - markingScheme should be empty string ""
3. For Essay questions:
   - Extract the question text (including any sub-questions like a), b), c))
   - Extract the marking scheme/rubric if provided in the text
   - If no marking scheme is provided, GENERATE a detailed marking scheme with point distribution
   - Set points based on the marking scheme total, or default to 10
   - options should be empty array [], correctAnswer should be empty string ""
4. If an answer key section is present, use it to determine correct answers for MCQs.
5. If the text contains sections (e.g., "Section A: Multiple Choice Questions"), respect the section structure.

Return ONLY valid JSON. Do not include any explanatory text, markdown, or code fences.

JSON format:
{
  "questions": [
    {
      "type": "mcq",
      "questionText": "question here",
      "options": [{"label": "A", "text": "option a"}, {"label": "B", "text": "option b"}],
      "correctAnswer": "A",
      "markingScheme": "",
      "points": 1
    },
    {
      "type": "essay",
      "questionText": "question here",
      "options": [],
      "correctAnswer": "",
      "markingScheme": "Marking Scheme (Total: 10 marks):\n- Key point 1: 3 pts\n- Key point 2: 4 pts\n- Key point 3: 3 pts",
      "points": 10
    }
  ],
  "warnings": ["any issues or concerns about the parsing"],
  "errors": ["any critical errors that prevented parsing"]
}

Text to parse:
${text}`;
}

/**
 * Call the Gemini API with retry logic and key rotation
 * @param {string} prompt - The full prompt
 * @returns {Promise<string>} The AI response text
 */
async function callGeminiAPI(prompt) {
  // Enforce minimum interval between requests
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < minRequestInterval) {
    await new Promise((resolve) =>
      setTimeout(resolve, minRequestInterval - timeSinceLastRequest)
    );
  }

  let lastError = null;

  for (let attempt = 0; attempt < GEMINI_API_KEYS.length; attempt++) {
    const keyIndex = (currentKeyIndex + attempt) % GEMINI_API_KEYS.length;
    const apiKey = GEMINI_API_KEYS[keyIndex];

    try {
      lastRequestTime = Date.now();

      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192,
            topP: 0.95,
            topK: 40,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Gemini API error (key ${keyIndex}):`, response.status, errorText);

        if (response.status === 429) {
          // Rate limited, try next key
          currentKeyIndex = (keyIndex + 1) % GEMINI_API_KEYS.length;
          continue;
        }

        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid Gemini response format');
      }

      // Rotate key for next request
      currentKeyIndex = (keyIndex + 1) % GEMINI_API_KEYS.length;

      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error(`Gemini API call failed (key ${keyIndex}):`, error.message);
      lastError = error;
      currentKeyIndex = (keyIndex + 1) % GEMINI_API_KEYS.length;
    }
  }

  throw lastError || new Error('All Gemini API keys exhausted');
}

/**
 * Clean up AI response - remove markdown code fences if present
 * @param {string} text - Raw AI response
 * @returns {string} Cleaned text
 */
function cleanAIResponse(text) {
  if (!text) return '';

  let cleaned = text.trim();

  // Remove markdown code fences
  if (cleaned.startsWith('```json') || cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\n/, '');
    cleaned = cleaned.replace(/\n```$/, '');
  }

  // Remove leading/trailing whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Parse AI response text into structured question objects
 * @param {string} aiText - The AI response text (JSON)
 * @returns {Object} { questions, warnings, errors }
 */
function parseAIResponse(aiText) {
  const warnings = [];
  const errors = [];

  try {
    const cleaned = cleanAIResponse(aiText);
    const parsed = JSON.parse(cleaned);

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      errors.push('AI response did not contain a valid questions array');
      return { questions: [], warnings, errors };
    }

    const questions = parsed.questions.map((q, index) => {
      const normalized = {
        type: q.type === 'essay' ? 'essay' : 'mcq',
        questionText: (q.questionText || '').trim(),
        options: q.type === 'mcq' ? (q.options || []) : [],
        correctAnswer: q.correctAnswer || '',
        markingScheme: q.markingScheme || '',
        points: q.points || (q.type === 'essay' ? 10 : 1),
      };

      // Validation warnings
      if (normalized.questionText.length < 5) {
        warnings.push(`Question ${index + 1}: Question text is too short`);
      }

      if (normalized.type === 'mcq') {
        if (!normalized.options || normalized.options.length < 2) {
          warnings.push(`Question ${index + 1}: MCQ has fewer than 2 options`);
        }
        if (!normalized.correctAnswer) {
          warnings.push(`Question ${index + 1}: No correct answer specified, defaulting to first option`);
          normalized.correctAnswer = normalized.options[0]?.label || 'A';
        }
      }

      if (normalized.type === 'essay' && normalized.markingScheme.length < 10) {
        warnings.push(`Question ${index + 1}: Marking scheme is missing or too short`);
      }

      return normalized;
    });

    // Merge any warnings/errors from the AI response
    if (Array.isArray(parsed.warnings)) {
      warnings.push(...parsed.warnings);
    }
    if (Array.isArray(parsed.errors)) {
      errors.push(...parsed.errors);
    }

    return { questions, warnings, errors };
  } catch (parseError) {
    console.error('Failed to parse AI response as JSON:', parseError.message);
    errors.push(`Failed to parse AI response: ${parseError.message}`);
    return { questions: [], warnings, errors };
  }
}

/**
 * Main function: Parse text into structured questions using AI
 * @param {string} text - Raw text to parse (pasted, extracted from PDF/image, etc.)
 * @param {string} examFormat - 'mcq', 'essay', or 'hybrid'
 * @returns {Promise<Object>} { questions, warnings, errors, sections, detectedFormat }
 */
export async function parseQuestionsWithAI(text, examFormat = 'hybrid') {
  if (!text || !text.trim()) {
    return {
      questions: [],
      warnings: [],
      errors: ['No text provided to parse'],
      sections: [],
      detectedFormat: 'natural',
    };
  }

  const result = {
    questions: [],
    warnings: [],
    errors: [],
    sections: [],
    detectedFormat: 'natural',
  };

  // Build and send the prompt to Gemini
  const prompt = buildParsePrompt(text, examFormat);

  try {
    const aiResponse = await callGeminiAPI(prompt);
    const { questions, warnings, errors } = parseAIResponse(aiResponse);

    result.questions = questions;
    result.warnings = warnings;
    result.errors = errors;

    // Build section info for compatibility with frontend
    if (questions.length > 0) {
      const mcqCount = questions.filter((q) => q.type === 'mcq').length;
      const essayCount = questions.filter((q) => q.type === 'essay').length;

      result.sections = [
        {
          name: 'Parsed Questions',
          type: mcqCount > 0 && essayCount > 0 ? 'unknown' : mcqCount > 0 ? 'mcq' : 'essay',
          startLine: 0,
          endLine: 0,
          totalMarks: questions.reduce((sum, q) => sum + q.points, 0),
        },
      ];

      let summary = `Found ${questions.length} question(s)`;
      if (mcqCount > 0) summary += ` (${mcqCount} MCQ`;
      if (essayCount > 0) summary += `${mcqCount > 0 ? ', ' : ' ('}${essayCount} Essay`;
      if (mcqCount > 0 || essayCount > 0) summary += ')';
      result.summary = summary;
    } else {
      result.warnings.push(
        'Could not detect any structured questions. Try rephrasing or using the AI Generate tab.'
      );
    }

    return result;
  } catch (error) {
    console.error('AI parsing error:', error.message);
    result.errors.push(
      `AI parsing failed: ${error.message}. Please try again or use the AI Generate tab.`
    );
    return result;
  }
}

/**
 * Parse text with AI, with fallback to rule-based parser
 * @param {string} text - Raw text to parse
 * @param {string} examFormat - 'mcq', 'essay', or 'hybrid'
 * @returns {Promise<Object>} Parse results
 */
export async function parseQuestions(text, examFormat = 'hybrid') {
  try {
    return await parseQuestionsWithAI(text, examFormat);
  } catch (aiError) {
    console.error('AI parser failed, attempting fallback:', aiError.message);

    // Fallback to rule-based parser
    try {
      const { parseQuestions: parseQuestionsRuleBased } = await import(
        './question-parser/index.js'
      );
      return await parseQuestionsRuleBased(text);
    } catch (fallbackError) {
      console.error('Fallback parser also failed:', fallbackError.message);
      return {
        questions: [],
        warnings: [],
        errors: [
          `AI parsing failed: ${aiError.message}`,
          `Fallback parser also failed: ${fallbackError.message}`,
        ],
        sections: [],
        detectedFormat: 'natural',
      };
    }
  }
}
