/**
 * Answer Extractor Module
 * Extracts answer keys and correct answers from text.
 * Single responsibility: Extract answer information.
 */

/**
 * Extract answer key from text
 * @param {string[]} lines - Array of text lines
 * @param {number} startLine - Starting line index
 * @returns {Object} { answerMap, endLine }
 */
export function extractAnswerKey(lines, startLine = 0) {
  const answerMap = {};
  let answerKeyEndLine = lines.length;

  // Find answer key section
  let answerKeyStart = -1;
  for (let i = startLine; i < lines.length; i++) {
    const lower = lines[i].toLowerCase().trim();
    if (/answer\s*key|answers|marking\s*scheme|answer\s*key\s*and/i.test(lower)) {
      answerKeyStart = i;
      break;
    }
  }

  if (answerKeyStart === -1) {
    return { answerMap, endLine: answerKeyEndLine };
  }

  // Parse answer key lines
  for (let i = answerKeyStart + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip header lines
    if (/^(q|no|question|answer)/i.test(line) && /[a-d]/i.test(line)) continue;
    if (!/\d/.test(line)) continue;

    // Format 1: Packed format "1B2C3A" or "1B 2C 3A"
    const pairRegex = /(\d+)\s*([A-Da-d])\s*/g;
    let pairMatch;
    let hasPairs = false;
    while ((pairMatch = pairRegex.exec(line)) !== null) {
      const num = pairMatch[1];
      const ans = pairMatch[2].toUpperCase();
      if (parseInt(num) >= 1 && parseInt(num) <= 999) {
        answerMap[num] = ans;
        hasPairs = true;
      }
    }

    if (hasPairs) continue;

    // Format 2: "Q1 B" or "1. B" or "1 B"
    const qaMatch = line.match(/^(?:Q|q)?\s*(\d+)\s*[.)\s\-]?\s*([A-Da-d])\s*$/);
    if (qaMatch) {
      answerMap[qaMatch[1]] = qaMatch[2].toUpperCase();
      continue;
    }

    // Format 3: Table "1,B" or "1\tB"
    const tableMatch = line.match(/^(\d+)\s*[,;\t]\s*([A-Da-d])/);
    if (tableMatch) {
      answerMap[tableMatch[1]] = tableMatch[2].toUpperCase();
      continue;
    }

    // Format 4: Just a letter (sequential)
    const justLetter = line.match(/^([A-Da-d])\s*$/);
    if (justLetter) {
      const nextNum = Object.keys(answerMap).length + 1;
      answerMap[nextNum.toString()] = justLetter[1].toUpperCase();
      continue;
    }
  }

  // Find where answer key ends
  for (let i = answerKeyStart + 1; i < lines.length; i++) {
    if (/^section\s+/i.test(lines[i].trim())) {
      answerKeyEndLine = i;
      break;
    }
  }

  return { answerMap, endLine: answerKeyEndLine };
}

/**
 * Extract correct answer from MCQ question text
 * @param {string} questionText - Question text
 * @param {string} answerMap - Map of question numbers to answers
 * @param {number} questionNumber - Question number
 * @returns {string} Correct answer letter
 */
export function getCorrectAnswer(questionText, answerMap, questionNumber) {
  // First check answer map
  if (answerMap && answerMap[questionNumber.toString()]) {
    return answerMap[questionNumber.toString()];
  }

  // Try to find answer in question text (inline answer key)
  const inlineAnswer = questionText.match(/answer[:\s]+([A-Da-d])/i);
  if (inlineAnswer) {
    return inlineAnswer[1].toUpperCase();
  }

  // Try to find "correct: A" pattern
  const correctPattern = questionText.match(/correct[:\s]+([A-Da-d])/i);
  if (correctPattern) {
    return correctPattern[1].toUpperCase();
  }

  return '';
}

/**
 * Infer answer from context (fallback)
 * @param {Array} options - Array of options
 * @param {string} questionText - Question text
 * @returns {string} Inferred answer letter
 */
export function inferAnswer(options, questionText) {
  if (!options || options.length === 0) {
    return 'A';
  }

  // Look for "correct" or "answer" in options
  const correctOption = options.find(opt => 
    /^(correct|right|true|yes|✓)/i.test(opt.text)
  );
  
  if (correctOption) {
    return correctOption.label;
  }

  // Look for "incorrect" or "wrong" - avoid these
  const incorrectOptions = options.filter(opt =>
    /^(incorrect|wrong|false|no|✗)/i.test(opt.text)
  );

  // Return first option that's not explicitly wrong
  if (incorrectOptions.length > 0 && incorrectOptions.length < options.length) {
    const correct = options.find(opt => !incorrectOptions.includes(opt));
    if (correct) return correct.label;
  }

  // Default to first option
  return options[0].label;
}

/**
 * Extract answers from essay marking scheme
 * @param {string} markingScheme - Marking scheme text
 * @returns {Array} Array of { criterion, points }
 */
export function extractEssayAnswers(markingScheme) {
  const answers = [];
  
  if (!markingScheme || markingScheme.trim().length === 0) {
    return answers;
  }

  const lines = markingScheme.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Match bullet points with points
    const match = trimmed.match(/^[-•*]\s*(.+?)[:\s]+(\d+)\s*(?:marks?|points?|pts?)?/i);
    
    if (match) {
      answers.push({
        criterion: match[1].trim(),
        points: parseInt(match[2]) || 0,
      });
    }
  }

  return answers;
}

/**
 * Validate answer key
 * @param {Object} answerMap - Map of question numbers to answers
 * @param {number} totalQuestions - Total number of questions
 * @returns {Object} { valid, warnings, missing }
 */
export function validateAnswerKey(answerMap, totalQuestions) {
  const warnings = [];
  const missing = [];

  if (!answerMap || Object.keys(answerMap).length === 0) {
    return {
      valid: false,
      warnings: ['No answer key found'],
      missing: Array.from({ length: totalQuestions }, (_, i) => i + 1),
    };
  }

  // Check for missing answers
  for (let i = 1; i <= totalQuestions; i++) {
    if (!answerMap[i.toString()]) {
      missing.push(i);
    }
  }

  if (missing.length > 0) {
    warnings.push(`Missing answers for questions: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '...' : ''}`);
  }

  // Validate answer letters
  const invalidAnswers = Object.entries(answerMap).filter(([num, ans]) => {
    return !/^[A-Da-d]$/.test(ans);
  });

  if (invalidAnswers.length > 0) {
    warnings.push(`${invalidAnswers.length} answer(s) have invalid letters`);
  }

  return {
    valid: missing.length === 0,
    warnings,
    missing,
  };
}

/**
 * Merge multiple answer keys
 * @param {Array} answerKeys - Array of answer maps
 * @returns {Object} Merged answer map
 */
export function mergeAnswerKeys(answerKeys) {
  const merged = {};

  for (const answerMap of answerKeys) {
    if (!answerMap || typeof answerMap !== 'object') continue;

    for (const [question, answer] of Object.entries(answerMap)) {
      // Later answer keys override earlier ones
      merged[question] = answer;
    }
  }

  return merged;
}

/**
 * Detect answer key format
 * @param {string[]} lines - Array of text lines
 * @returns {string} Format type ('packed', 'tabular', 'inline', 'unknown')
 */
export function detectAnswerKeyFormat(lines) {
  if (lines.length === 0) return 'unknown';

  const firstLine = lines[0].trim();

  // Packed format: "1B2C3A"
  if (/^\d+[A-Da-d]/.test(firstLine) && firstLine.length < 50) {
    return 'packed';
  }

  // Tabular format: "1, B" or "1 B"
  if (/^\d+[,;\t\s]/.test(firstLine) && /[A-Da-d]/.test(firstLine)) {
    return 'tabular';
  }

  // Inline format: "Q1: B" or "1. B"
  if (/^Q?\d+[.)\s:]/.test(firstLine)) {
    return 'inline';
  }

  return 'unknown';
}