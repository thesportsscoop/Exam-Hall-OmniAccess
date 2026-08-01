/**
 * Stage 4: AI Validator
 * Uses Gemini API to validate parsed questions, checking for:
 * - Missing options
 * - Malformed questions
 * - Numbering inconsistencies
 * - Suggests improvements
 * 
 * This is a VALIDATOR, not a primary extractor.
 * Falls back gracefully if AI is unavailable.
 */

const GEMINI_API_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_BACKUP,
].filter(Boolean);

if (GEMINI_API_KEYS.length === 0) {
  console.error('No Gemini API keys configured. Please set GEMINI_API_KEY or GEMINI_API_KEY_BACKUP in .env.local');
}

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

/**
 * Validate parsed questions using AI
 * @param {Array} questions - Parsed questions array
 * @param {string} originalText - Original text for context
 * @returns {Object} { validated: Array, warnings: Array, errors: Array }
 */
export async function validateWithAI(questions, originalText) {
  const result = {
    validated: [...questions],
    warnings: [],
    errors: [],
  };

  if (!questions || questions.length === 0) {
    return result;
  }

  // Run basic validation (always works)
  runBasicValidation(questions, result);

  // Try AI validation (optional - fails gracefully)
  try {
    const aiResult = await runAIValidation(questions, originalText);
    if (aiResult) {
      result.warnings.push(...aiResult.warnings);
      if (aiResult.suggestions && aiResult.suggestions.length > 0) {
        result.warnings.push('AI suggestions: ' + aiResult.suggestions.join('; '));
      }
    }
  } catch (error) {
    console.error('AI validation failed (non-critical):', error.message);
  }

  return result;
}

/**
 * Run basic validation (no AI needed)
 */
function runBasicValidation(questions, result) {
  const seenNumbers = new Set();

  questions.forEach((q, index) => {
    // Check for empty question text
    if (!q.questionText || q.questionText.trim().length < 5) {
      result.warnings.push(`Question ${index + 1}: Question text is too short or empty`);
    }

    // Check MCQ options and answers
    if (q.type === 'mcq') {
      if (!q.options || q.options.length < 2) {
        result.errors.push(`Question ${index + 1}: Must have at least 2 options`);
      } else {
        q.options.forEach((opt) => {
          if (!opt.text || opt.text.trim().length === 0) {
            result.warnings.push(`Question ${index + 1}: Option ${opt.label} is empty`);
          }
        });

        const optionTexts = q.options.map(o => o.text.toLowerCase().trim());
        const duplicates = optionTexts.filter((t, i) => optionTexts.indexOf(t) !== i);
        if (duplicates.length > 0) {
          result.warnings.push(`Question ${index + 1}: Has duplicate options`);
        }
      }

      // Verify correct answer maps to an actual choice option
      if (q.correctAnswer) {
        const validLabels = q.options.map(o => o.label);
        if (!validLabels.includes(q.correctAnswer.toUpperCase())) {
          result.warnings.push(`Question ${index + 1}: Correct answer '${q.correctAnswer}' does not match any choice label (${validLabels.join(', ')})`);
        }
      } else {
        result.warnings.push(`Question ${index + 1}: MCQ is missing a designated correct answer key`);
      }
    }

    // Check essay marking scheme
    if (q.type === 'essay' && (!q.markingScheme || q.markingScheme.trim().length < 10)) {
      result.warnings.push(`Question ${index + 1}: Marking scheme is missing or too short`);
    }

    // Check for duplicate question numbers
    if (q.number) {
      if (seenNumbers.has(q.number)) {
        result.warnings.push(`Question ${index + 1}: Duplicate question number ${q.number}`);
      }
      seenNumbers.add(q.number);
    }
  });
}

/**
 * Run AI-powered validation
 */
async function runAIValidation(questions, originalText) {
  const questionSummary = questions.map((q, i) => {
    if (q.type === 'mcq') {
      return `Q${i + 1}: [MCQ] "${q.questionText.substring(0, 100)}" Options: ${q.options.map(o => `${o.label}) ${o.text}`).join(', ')} Answer: ${q.correctAnswer || '?'}`;
    } else {
      return `Q${i + 1}: [ESSAY] "${q.questionText.substring(0, 100)}" Points: ${q.points}`;
    }
  }).join('\n');

  const prompt = `You are a question validation assistant. Review these parsed exam questions and identify any issues.

Original Text:
${originalText.substring(0, 500)}

Parsed Questions:
${questionSummary}

Check for:
1. Missing options (MCQ questions with fewer than 2 options)
2. Incorrect answer keys (answers that don't match any option)
3. Questions that seem to be mis-parsed (e.g., essay labeled as MCQ or vice versa)
4. Numbering inconsistencies
5. Questions that seem incomplete or truncated

If everything looks correct, respond with "OK".
If there are issues, list them as bullet points.

Be brief and specific. Only flag actual issues.`;

  for (let attempt = 0; attempt < GEMINI_API_KEYS.length; attempt++) {
    const apiKey = GEMINI_API_KEYS[attempt];
    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 512,
          },
        }),
      });

      if (!response.ok) continue;

      const data = await response.json();
      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (aiText.trim() === 'OK') {
        return { warnings: [], suggestions: [] };
      }

      const warnings = [];
      const suggestions = [];
      const lines = aiText.split('\n').filter(l => l.trim());

      for (const line of lines) {
        const cleanLine = line.replace(/^[-*\d.]+\s*/, '').trim();
        if (cleanLine.length > 5) {
          if (cleanLine.toLowerCase().includes('suggest') || cleanLine.toLowerCase().includes('recommend')) {
            suggestions.push(cleanLine);
          } else {
            warnings.push(cleanLine);
          }
        }
      }

      return { warnings, suggestions };

    } catch (error) {
      console.error(`AI validation attempt ${attempt + 1} failed:`, error.message);
    }
  }

  return null;
}