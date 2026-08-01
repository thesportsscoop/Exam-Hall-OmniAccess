/**
 * Mark Extractor Module
 * Extracts marks/points from question text and section headers.
 * Single responsibility: Extract mark values.
 */

/**
 * Extract marks from a line of text
 * @param {string} line - Line of text
 * @returns {number} Number of marks (0 if not found)
 */
export function extractMarks(line) {
  if (!line) return 0;

  // Pattern 1: "(5 marks)" or "(5 Marks)" or "(5 points)"
  const pattern1 = line.match(/\(?\s*(\d+)\s*(?:marks?|points?|pts?)\s*\)?/i);
  if (pattern1) {
    return parseInt(pattern1[1]);
  }

  // Pattern 2: "5 marks" or "5 Marks" or "5 points"
  const pattern2 = line.match(/\b(\d+)\s*(?:marks?|points?|pts?)\b/i);
  if (pattern2) {
    return parseInt(pattern2[1]);
  }

  // Pattern 3: "[5]" or "{5}" marks indicator
  const pattern3 = line.match(/[\[\{]\s*(\d+)\s*[\]\}]/);
  if (pattern3) {
    return parseInt(pattern3[1]);
  }

  return 0;
}

/**
 * Extract marks from question text block
 * @param {string[]} lines - Array of text lines
 * @param {number} startIndex - Starting line index
 * @param {number} endIndex - Ending line index
 * @returns {number} Extracted marks
 */
export function extractMarksFromBlock(lines, startIndex, endIndex) {
  // Check first few lines for marks (usually near question number)
  for (let i = startIndex; i < Math.min(startIndex + 3, endIndex + 1); i++) {
    const marks = extractMarks(lines[i]);
    if (marks > 0) {
      return marks;
    }
  }

  // Check if section has total marks
  // (This would be passed from section detector)

  return 0;
}

/**
 * Distribute total marks among questions
 * @param {number} totalMarks - Total marks for section
 * @param {number} questionCount - Number of questions
 * @returns {number} Marks per question
 */
export function distributeMarks(totalMarks, questionCount) {
  if (totalMarks <= 0 || questionCount <= 0) {
    return 0;
  }

  // Distribute marks evenly
  const baseMarks = Math.floor(totalMarks / questionCount);
  const remainder = totalMarks - (baseMarks * questionCount);

  return baseMarks;
}

/**
 * Extract marks for individual questions with remainder distribution
 * @param {number} totalMarks - Total marks
 * @param {number} questionCount - Number of questions
 * @returns {number[]} Array of marks for each question
 */
export function distributeMarksWithRemainder(totalMarks, questionCount) {
  if (totalMarks <= 0 || questionCount <= 0) {
    return new Array(questionCount).fill(0);
  }

  const baseMarks = Math.floor(totalMarks / questionCount);
  const remainder = totalMarks - (baseMarks * questionCount);
  
  const distribution = new Array(questionCount).fill(baseMarks);
  
  // Distribute remainder to first N questions
  for (let i = 0; i < remainder; i++) {
    distribution[i]++;
  }

  return distribution;
}

/**
 * Validate marks value
 * @param {number} marks - Marks to validate
 * @returns {Object} { valid, warnings }
 */
export function validateMarks(marks) {
  const warnings = [];

  if (!marks || marks <= 0) {
    return { valid: false, warnings: ['Marks must be a positive number'] };
  }

  if (marks > 100) {
    warnings.push('Marks exceed 100 - verify this is correct');
  }

  if (marks % 1 !== 0) {
    warnings.push('Marks should be a whole number');
  }

  return {
    valid: marks > 0 && marks <= 100,
    warnings,
  };
}

/**
 * Detect marks pattern in text
 * @param {string} text - Text to search
 * @returns {Array} Array of found mark values with context
 */
export function detectMarkPatterns(text) {
  const marks = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const markValue = extractMarks(line);
    
    if (markValue > 0) {
      marks.push({
        value: markValue,
        line: i + 1,
        context: line.trim(),
      });
    }
  }

  return marks;
}