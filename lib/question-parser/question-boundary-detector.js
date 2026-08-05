/**
 * Stage 2: Question Boundary Detector
 * Identifies where questions begin and end using multiple signals.
 * Single responsibility: Detect question boundaries in text.
 */

/**
 * Detect question boundaries in text lines
 * @param {string[]} lines - Array of text lines
 * @param {string} sectionType - Type of section ('mcq', 'essay', 'unknown')
 * @returns {Array} Array of {startLine, endLine, questionNumber} objects
 */
export function detectQuestionBoundaries(lines, sectionType = 'unknown') {
  const boundaries = [];
  
  if (!lines || lines.length === 0) {
    return boundaries;
  }

  // Try multiple detection strategies
  const numberedQuestions = detectByNumbering(lines);
  const markerQuestions = detectByMarkers(lines);
  
  // Use the strategy that found more questions
  let questions = numberedQuestions;
  if (markerQuestions.length > numberedQuestions.length) {
    questions = markerQuestions;
  }

  // If still no questions found, try content-based detection
  if (questions.length === 0) {
    questions = detectByContent(lines);
  }

  // If still nothing, treat entire section as one question
  if (questions.length === 0 && lines.length > 0) {
    questions = [{
      startLine: 0,
      endLine: lines.length - 1,
      questionNumber: 1,
      confidence: 'low',
    }];
  }

  // Post-process: Trim boundaries that end with "Answer: X" lines
  // so answer markers don't get absorbed into question text
  questions = trimAnswerLines(lines, questions);

  return questions;
}

/**
 * Trim question boundaries that end with "Answer: X" lines.
 * The answer marker is a separator, not part of the question content.
 *
 * @param {string[]} lines - All lines
 * @param {Array} boundaries - Detected boundaries
 * @returns {Array} Trimmed boundaries
 */
function trimAnswerLines(lines, boundaries) {
  return boundaries.map(boundary => {
    let endLine = boundary.endLine;

    // Trim from the end: stop at "Answer: X" lines
    for (let i = endLine; i >= boundary.startLine; i--) {
      const line = lines[i]?.trim() || '';
      
      // Check if this line is an answer marker ("Answer: B", "Ans: C", etc.)
      if (
        /^(?:the\s+)?(?:correct\s+)?(?:answer|ans|key)\s*[:=\-–—]\s*\(?\s*[A-Ea-e]\s*\)?\.?\s*$/i.test(line) ||
        /^(?:the\s+)?(?:correct\s+)?answer\s+is\s+\(?\s*[A-Ea-e]\s*\)?\.?\s*$/i.test(line)
      ) {
        endLine = i - 1;
        continue;
      }
      
      // Skip blank lines between answer and next content
      if (line.length === 0) {
        if (i === endLine) {
          endLine = i - 1;
          continue;
        }
        break;
      }

      // Also stop at option-like boundary (e.g., a trailing "B" alone)
      if (/^[A-Ea-e]\s*\)?\s*$/.test(line) && i === endLine && i > boundary.startLine) {
        const prevLine = lines[i - 1]?.trim() || '';
        // Only trim if previous line is an option or answer context
        if (/^[A-Ea-e]\s*[)\]\s.\-:]/.test(prevLine)) {
          endLine = i - 1;
          continue;
        }
      }

      break;
    }

    // Validate we still have a valid range
    if (endLine < boundary.startLine) {
      endLine = boundary.startLine;
    }

    return { ...boundary, endLine };
  });
}

/**
 * Detect questions by numbering patterns (1., 2., Q1, Q2, etc.)
 */
function detectByNumbering(lines) {
  const questions = [];
  let currentQuestion = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip "Answer: X" lines - they are not question starts
    if (/^(?:the\s+)?(?:correct\s+)?(?:answer|ans|key)\s*[:=\-–—]/i.test(line)) {
      continue;
    }
    
    // Match numbered questions: "1.", "2)", "Q1:", "Question 1", "Question 1:", "Question 1.", "Question 1 (12 Marks)"
    const numberMatch = line.match(/^(?:question\s+)?(\d+)[.):]\s*(.+)/i) ||
                        line.match(/^q(\d+)[.:]\s*(.+)/i) ||
                        line.match(/^question\s+(\d+)\s*(?:\([^)]*\))?\.?\s*$/i) ||
                        line.match(/^question\s+(\d+)\s*\((\d+)\s*marks?\)/i);
    
    if (numberMatch && (numberMatch[2] ? numberMatch[2].length > 5 : true)) {
      // Save previous question
      if (currentQuestion) {
        currentQuestion.endLine = i - 1;
        questions.push(currentQuestion);
      }
      
      // Start new question
      currentQuestion = {
        startLine: i,
        endLine: lines.length - 1,
        questionNumber: parseInt(numberMatch[1]),
        confidence: 'high',
      };
    }
    // Match sub-questions: "a)", "b.", "(c)", etc.
    else if (line.match(/^[a-e][.)]\s*/i)) {
      // Part of current question
      continue;
    }
  }

  // Save last question
  if (currentQuestion) {
    questions.push(currentQuestion);
  }

  return questions;
}

/**
 * Detect questions by marker patterns (***, ===, etc.)
 */
function detectByMarkers(lines) {
  const questions = [];
  const markerPatterns = [
    /^[-=_]{3,}\s*$/,
    /^\*{3,}\s*$/,
    /^#{3,}\s*$/,
  ];

  let currentStart = 0;
  let questionNumber = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip "Answer: X" lines - they are not markers
    if (/^(?:the\s+)?(?:correct\s+)?(?:answer|ans|key)\s*[:=\-–—]/i.test(line)) {
      continue;
    }

    // Check if this is a marker line
    if (markerPatterns.some(pattern => pattern.test(line))) {
      // Save previous question
      if (i > currentStart) {
        questionNumber++;
        questions.push({
          startLine: currentStart,
          endLine: i - 1,
          questionNumber,
          confidence: 'medium',
        });
      }
      currentStart = i + 1;
    }
  }

  // Save last question
  if (currentStart < lines.length) {
    questionNumber++;
    questions.push({
      startLine: currentStart,
      endLine: lines.length - 1,
      questionNumber,
      confidence: 'medium',
    });
  }

  return questions;
}

/**
 * Detect questions by content analysis (fallback for unstructured text)
 */
function detectByContent(lines) {
  const questions = [];
  
  // Look for lines that look like questions (end with ? or have question words)
  const questionWords = /^(what|which|who|when|where|why|how|describe|explain|discuss|analyze|calculate|find|determine|state|list|name|identify|compare|contrast|evaluate|assess)/i;
  const questionMark = /\?\s*$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip "Answer: X" lines - they are not question starts
    if (/^(?:the\s+)?(?:correct\s+)?(?:answer|ans|key)\s*[:=\-–—]/i.test(line)) {
      continue;
    }

    if ((questionWords.test(line) || questionMark.test(line)) && line.length > 15) {
      questions.push({
        startLine: i,
        endLine: findQuestionEnd(lines, i),
        questionNumber: questions.length + 1,
        confidence: 'low',
      });
    }
  }

  return questions;
}

/**
 * Find where a question ends (helper for content-based detection)
 */
function findQuestionEnd(lines, startIndex) {
  const questionEndPatterns = [
    /^[a-e][.)]\s*/,  // Sub-questions
    /^(question|q)\s*\d/i,  // Next numbered question
    /^(section|part)\s+[a-z]/i,  // Next section
    /^answer\s*(key|s)?/i,  // Answer key
    /^(?:the\s+)?(?:correct\s+)?(?:answer|ans|key)\s*[:=\-–—]\s*\(?\s*[A-Ea-e]/i, // Inline answer
  ];

  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (questionEndPatterns.some(pattern => pattern.test(line))) {
      return i - 1;
    }
  }

  // Default: question ends within next 15 lines
  return Math.min(startIndex + 15, lines.length - 1);
}

/**
 * Merge overlapping or adjacent question boundaries
 * Only merges if boundaries actually overlap (not just close together),
 * to avoid merging distinct questions that are adjacent.
 */
export function mergeBoundaries(boundaries, maxGap = 0) {
  if (boundaries.length <= 1) return boundaries;

  const merged = [];
  let current = { ...boundaries[0] };

  for (let i = 1; i < boundaries.length; i++) {
    const next = boundaries[i];
    
    // Only merge if boundaries actually overlap (next starts before current ends)
    // or are truly adjacent (next starts exactly at current end + 1)
    if (next.startLine <= current.endLine) {
      current.endLine = Math.max(current.endLine, next.endLine);
      current.confidence = current.confidence === 'high' ? 'high' : next.confidence;
    } else {
      merged.push(current);
      current = { ...next };
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Validate question boundaries
 */
export function validateBoundaries(boundaries, totalLines) {
  return boundaries.filter(b => {
    // Must have valid start and end
    if (b.startLine < 0 || b.endLine < b.startLine) return false;
    
    // Must be within document bounds
    if (b.endLine >= totalLines) return false;
    
    // Question number must be positive
    if (!b.questionNumber || b.questionNumber < 1) return false;
    
    return true;
  });
}