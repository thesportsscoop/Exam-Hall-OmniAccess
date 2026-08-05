/**
 * Answer Extractor Module
 * Extracts answer keys and correct answers from text.
 * Smart detection of multiple answer formats:
 *
 * 1. Inline answers: "Answer: B" following each question's options
 * 2. Dedicated answer key sections ("Answer Key", "Answers", "Marking Scheme")
 * 3. In-question answer hints: "Ans:", "Correct:", "The answer is"
 * 4. Packed format: "1B2C3A"
 * 5. Tabular format: "1, B" or "1\tB" or "Q1 B"
 * 6. Just letters column (sequential)
 *
 * Single responsibility: Extract answer information.
 */

/**
 * Extract answers from text using multiple strategies.
 * This is the main entry point that intelligently merges all answer sources.
 *
 * @param {string[]} lines - Array of text lines
 * @returns {Object} { answerMap, inlineAnswerMap, warnings }
 */
export function extractAnswers(lines) {
  const warnings = [];

  // Strategy 1: Dedicated answer key section (e.g., "Answer Key:", "Answers:")
  const { answerMap: keySectionMap, endLine, found: keySectionFound } = extractAnswerKey(lines);
  const usedLines = new Set();
  
  // Only mark lines as used if an actual answer key section was found.
  // If no section header was found, endLine defaults to lines.length,
  // and we must NOT exclude all lines from inline answer scanning.
  if (keySectionFound) {
    for (let i = 0; i <= endLine && i < lines.length; i++) {
      usedLines.add(i);
    }
  }

  // Strategy 2: Inline "Answer: X" lines scattered throughout the document
  // (exclude lines already consumed by the answer key section)
  const { answerMap: inlineMap, answerLines } = extractInlineAnswers(lines, usedLines);

  // Strategy 3: Try to infer from question number context
  // (e.g., if question 3 says "Answer the following" and options have hints)

  const mergedAnswerMap = mergeAnswerKeys([keySectionMap, inlineMap]);

  // Report what we found
  const keySectionCount = Object.keys(keySectionMap).length;
  const inlineCount = Object.keys(inlineMap).length;
  if (keySectionCount > 0) {
    warnings.push(`Found ${keySectionCount} answer(s) in dedicated answer key section`);
  }
  if (inlineCount > 0) {
    warnings.push(`Found ${inlineCount} inline answer(s) marked with "Answer:"`);
  }

  return {
    answerMap: mergedAnswerMap,
    inlineAnswerMap: inlineMap,
    keySectionMap,
    answerLines,
    warnings,
  };
}

/**
 * Scan lines for inline "Answer: X" / "Ans: X" / "Answer - X" / "Correct answer: X"
 * patterns that follow question blocks.
 *
 * @param {string[]} lines - Array of text lines
 * @param {Set<number>} excludeLines - Line indices to skip (already consumed by answer key)
 * @returns {Object} { answerMap, answerLines }
 */
export function extractInlineAnswers(lines, excludeLines = new Set()) {
  const answerMap = {};
  const answerLines = [];

  for (let i = 0; i < lines.length; i++) {
    if (excludeLines.has(i)) continue;

    const line = lines[i].trim();
    const answer = extractAnswerFromLine(line);

    if (answer && answer.letter) {
      // Try to determine the question number this answer belongs to.
      // Look backwards for the most recent numbered question line.
      const questionNumber = findAssociatedQuestionNumber(lines, i,
        answer.letter, answer.questionNumber);

      // Also verify the answer letter is valid (A-E)
      if (/^[A-E]$/i.test(answer.letter)) {
        // Store both by the detected question number and the sequential fallback
        if (questionNumber) {
          answerMap[questionNumber.toString()] = answer.letter.toUpperCase();
        }
        answerLines.push({
          lineIndex: i,
          letter: answer.letter.toUpperCase(),
          questionNumber,
          raw: line,
        });
      }
    }
  }

  return { answerMap, answerLines };
}

/**
 * Extract a single answer letter from a line.
 * Supports formats:
 *   "Answer: B"          "ANSWER: B"        "Answer: (B)"
 *   "Ans: C"             "ANS - D"          "Answer = A"
 *   "Correct Answer: B"  "Correct answer is D"  "The answer is C"
 *   "Key: A"             "REVISION: B"      "  B" (bare letter, sequential)
 *   "Q1: B"              "1. B"             "1) B"
 *
 * @param {string} line - Single line of text
 * @returns {Object|null} { letter, questionNumber } or null
 */
export function extractAnswerFromLine(line) {
  if (!line || line.trim().length === 0) return null;
  const trimmed = line.trim();

  // Pattern 1: "Answer: B", "ANSWER : B", "Answer - B", "Answer = B"
  let match = trimmed.match(
    /^(?:the\s+)?(?:correct\s+)?(?:answer|ans|key|revision)\s*[:=\-–—]\s*\(?\s*([A-Ea-e])\s*\)?\.?\s*$/i
  );
  if (match) return { letter: match[1].toUpperCase(), questionNumber: null };

  // Pattern 2: "Answer is B", "The answer is B", "Correct answer is C"
  match = trimmed.match(
    /^(?:the\s+)?(?:correct\s+)?answer\s+is\s+\(?\s*([A-Ea-e])\s*\)?\.?\s*$/i
  );
  if (match) return { letter: match[1].toUpperCase(), questionNumber: null };

  // Pattern 3: "Q1: B", "Q1 - B", "1: B", "1. B", "1) B", "1- B"
  match = trimmed.match(
    /^(?:Q|q|Question|QUESTION)?\s*(\d+)\s*[:.)\-\–—\s]\s*\(?\s*([A-Ea-e])\s*\)?\.?\s*$/i
  );
  if (match) {
    return {
      letter: match[2].toUpperCase(),
      questionNumber: parseInt(match[1]),
    };
  }

  // Pattern 4: "1. B " with trailing content after the letter (e.g., "1. B - Explanation")
  match = trimmed.match(
    /^(?:Q|q|Question|QUESTION)?\s*(\d+)\s*[:.)\-\–—\s]\s*\(?\s*([A-Ea-e])\s*\)?\.?\s+(?:is\s+)?(?:the\s+)?(?:correct\s+)?answer/i
  );
  if (match) {
    return {
      letter: match[2].toUpperCase(),
      questionNumber: parseInt(match[1]),
    };
  }

  return null;
}

/**
 * Find the question number associated with an inline answer line.
 * Looks backwards for the nearest numbered question (e.g., "3.", "Question 4", "Q5:")
 * and also handles the case where the answer line explicitly states the question number.
 *
 * @param {string[]} lines - All lines
 * @param {number} answerLineIndex - Index of the "Answer: X" line
 * @param {string} letter - The answer letter
 * @param {number|null} explicitQuestionNumber - Question number from the answer line itself
 * @returns {number|null} Question number
 */
function findAssociatedQuestionNumber(lines, answerLineIndex, letter, explicitQuestionNumber) {
  // If the answer line explicitly includes a question number (e.g., "Q3: B"), use it
  if (explicitQuestionNumber) return explicitQuestionNumber;

  // Scan backwards from the answer line for the most recent numbered question
  for (let i = answerLineIndex - 1; i >= 0; i--) {
    const line = lines[i].trim();

    // Match "1.", "2)", "Q3:", "Question 4:", "6." number patterns
    const questionMatch = line.match(
      /^(?:question\s+)?(\d+)[.):]\s*(.+)/i
    ) || line.match(/^q(\d+)[.:]\s*(.+)/i);

    if (questionMatch) {
      return parseInt(questionMatch[1]);
    }

    // Don't scan too far backwards (only within ~15 lines previous)
    if (answerLineIndex - i > 15) break;
  }

  return null;
}

/**
 * Extract answer key from a dedicated answer key section
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
    if (/answer\s*key|answers\s*$|marking\s*scheme|answer\s*key\s*and|answer\s*key\s*:/i.test(lower) ||
        /^\s*(?:answer|answers)\s*[:]\s*$/i.test(lower)) {
      // Make sure this is a section header line, not an inline "Answer: B"
      const inlineCheck = extractAnswerFromLine(lines[i]);
      if (!inlineCheck) {
        answerKeyStart = i;
        break;
      }
    }
  }

  if (answerKeyStart === -1) {
    return { answerMap, endLine: answerKeyEndLine, found: false };
  }

  // Parse answer key lines
  for (let i = answerKeyStart + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip header lines
    if (/^(q|no|question|answer)\b/i.test(line) && /[a-d]/i.test(line)) continue;
    if (!/\d/.test(line) && !/^[A-Da-d]$/.test(line)) continue;

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

    if (hasPairs && line.replace(/\d\s*[A-Da-d]\s*/g, '').trim().length === 0) continue;

    // Format 2: "Q1 B" or "1. B" or "1 B"
    const qaMatch = line.match(/^(?:Q|q|Question|QUESTION)?\s*(\d+)\s*[.)\s\-–—:]?\s*([A-Da-d])\s*$/);
    if (qaMatch && qaMatch[1] && qaMatch[2]) {
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

    // Format 5: Inline "Answer: B" inside the answer key section
    const inlineAnswer = extractAnswerFromLine(line);
    if (inlineAnswer && inlineAnswer.letter) {
      // If explicit question number is present, use it
      if (inlineAnswer.questionNumber) {
        answerMap[inlineAnswer.questionNumber.toString()] = inlineAnswer.letter.toUpperCase();
      } else {
        // Otherwise use sequential next number
        const nextNum = Object.keys(answerMap).length + 1;
        answerMap[nextNum.toString()] = inlineAnswer.letter.toUpperCase();
      }
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

  return { answerMap, endLine: answerKeyEndLine, found: true };
}

/**
 * Strip "Answer: X" style lines from question text
 * @param {string} text - Question text that may contain an answer line
 * @returns {string} Cleaned question text
 */
export function stripAnswerFromText(text) {
  if (!text) return '';
  
  // Remove standalone "Answer: X" lines/patterns from question text
  let cleaned = text
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      // Skip dedicated answer marker lines (not part of question content)
      return !/^(?:the\s+)?(?:correct\s+)?(?:answer|ans|key)\s*[:=\-–—]\s*\(?\s*[A-Ea-e]\s*\)?\.?\s*$/i.test(trimmed) &&
             !/^(?:the\s+)?(?:correct\s+)?answer\s+is\s+\(?\s*[A-Ea-e]\s*\)?\.?\s*$/i.test(trimmed);
    })
    .join('\n')
    .trim();

  // Also remove inline answer text like "Answer: B" at the end of a question block
  cleaned = cleaned.replace(
    /[\s]*\(?(?:the\s+)?(?:correct\s+)?(?:answer|ans|key)\s*[:=\-–—]\s*\(?\s*([A-Ea-e])\s*\)?\.?\s*$/i,
    ''
  );

  return cleaned.trim();
}

/**
 * Get correct answer from MCQ question text
 * @param {string} questionText - Question text
 * @param {Object} answerMap - Map of question numbers to answers
 * @param {number|string} questionNumber - Question number
 * @returns {string} Correct answer letter
 */
export function getCorrectAnswer(questionText, answerMap, questionNumber) {
  // First check answer map
  if (answerMap && answerMap[questionNumber.toString()]) {
    return answerMap[questionNumber.toString()];
  }

  // Try numeric lookup with different formats
  if (answerMap && questionNumber) {
    const numericKey = String(questionNumber).replace(/^0+/, '');
    if (answerMap[numericKey]) {
      return answerMap[numericKey];
    }
  }

  // Try to find answer in question text (inline answer key)
  const inlineAnswer = questionText.match(/answer\s*[:=\-]\s*\(?\s*([A-Da-d])\s*\)?/i);
  if (inlineAnswer) {
    return inlineAnswer[1].toUpperCase();
  }

  // Try "answer is X" pattern
  const answerIsPattern = questionText.match(/answer\s+is\s+\(?\s*([A-Da-d])\s*\)?/i);
  if (answerIsPattern) {
    return answerIsPattern[1].toUpperCase();
  }

  // Try to find "correct: A" pattern
  const correctPattern = questionText.match(/correct\s*[:=\-]\s*([A-Da-d])/i);
  if (correctPattern) {
    return correctPattern[1].toUpperCase();
  }

  // Try "Ans:" pattern
  const ansPattern = questionText.match(/(?:^|\s)(?:ans|answer)\s*[:=\-]\s*\(?\s*([A-Da-d])\s*\)?/i);
  if (ansPattern) {
    return ansPattern[1].toUpperCase();
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

  // Look for answer hints in question text (e.g., "the correct answer is B")
  if (questionText) {
    const hintMatch = questionText.match(
      /(?:the\s+)?correct\s+answer\s+is\s+\(?\s*([A-Ea-e])\s*\)?/i
    );
    if (hintMatch) return hintMatch[1].toUpperCase();
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
    return !/^[A-Ea-e]$/.test(ans);
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
 * Later answer keys override earlier ones.
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
  if (/^\d+[A-Da-e]/.test(firstLine) && firstLine.length < 50) {
    return 'packed';
  }

  // Tabular format: "1, B" or "1 B"
  if (/^\d+[,;\t\s]/.test(firstLine) && /[A-Da-e]/.test(firstLine)) {
    return 'tabular';
  }

  // Inline format: "Q1: B" or "1. B" or "Answer: B"
  if (/^Q?\d+[.)\s:]/i.test(firstLine) || /^answer\s*[:=\-]/i.test(firstLine)) {
    return 'inline';
  }

  return 'unknown';
}

/**
 * Apply inline answers to parsed questions.
 * For each question, check if there's an "Answer: X" line in its boundary.
 *
 * @param {Array} questions - Parsed question objects
 * @param {Object} inlineAnswerMap - Map from question number to answer letter
 * @param {Array} questionBoundaries - Boundary objects with line ranges
 * @param {string[]} allLines - All document lines
 * @returns {Array} Questions with correctAnswer populated
 */
export function applyInlineAnswersToQuestions(questions, inlineAnswerMap, questionBoundaries, allLines) {
  if (!questions || questions.length === 0) return questions;

  return questions.map((question, idx) => {
    if (question.correctAnswer && question.correctAnswer.length > 0) {
      // Already has an answer from answer key section - don't override
      return question;
    }

    const qNum = question.questionNumber || (idx + 1);
    
    // Try the merged inline answer map first
    if (inlineAnswerMap && inlineAnswerMap[qNum.toString()]) {
      return {
        ...question,
        correctAnswer: inlineAnswerMap[qNum.toString()],
        answerSource: 'inline',
      };
    }

    // Also check for answer in the question's own lines
    if (questionBoundaries && allLines && questionBoundaries[idx]) {
      const boundary = questionBoundaries[idx];
      const questionLines = allLines.slice(boundary.startLine, boundary.endLine + 1);
      
      // Scan the question's own lines for an inline answer
      for (const line of questionLines) {
        const answerInfo = extractAnswerFromLine(line);
        if (answerInfo && answerInfo.letter) {
          return {
            ...question,
            correctAnswer: answerInfo.letter.toUpperCase(),
            answerSource: 'inline',
          };
        }
      }
    }

    // Also check the question text itself
    const selfAnswer = getCorrectAnswer(question.questionText || '', {}, qNum);
    if (selfAnswer) {
      return {
        ...question,
        correctAnswer: selfAnswer,
        answerSource: 'inline',
      };
    }

    return question;
  });
}

/**
 * Remove "Answer: X" lines from question text
 * @param {Array} questions - Parsed question objects
 * @returns {Array} Questions with answer lines removed from text
 */
export function removeAnswersFromQuestionText(questions) {
  if (!questions || questions.length === 0) return questions;

  return questions.map(question => {
    if (!question.questionText) return question;

    const cleanedText = stripAnswerFromText(question.questionText);
    
    // Also handle case where "Answer: B" is in the middle of the text
    const cleanedWithInline = cleanedText.replace(
      /\s+(?:the\s+)?(?:correct\s+)?(?:answer|ans|key)\s*[:=\-]\s*\(?\s*[A-Ea-e]\s*\)?\.?\s*/gi,
      ' '
    ).trim();

    if (cleanedWithInline !== question.questionText) {
      return {
        ...question,
        questionText: cleanedWithInline,
        warnings: [...(question.warnings || []), 'Removed inline answer marker from question text'],
      };
    }

    return question;
  });
}