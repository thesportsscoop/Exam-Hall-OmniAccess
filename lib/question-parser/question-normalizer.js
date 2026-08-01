/**
 * Question Normalizer Module
 * Normalizes parsed questions to ensure consistency.
 * Single responsibility: Normalize question data.
 */

import { normalizeOptionLabels } from './option-extractor.js';
import { generateDefaultRubric } from './rubric-extractor.js';

/**
 * Normalize a single question
 * @param {Object} question - Raw parsed question
 * @returns {Object} Normalized question
 */
export function normalizeQuestion(question) {
  if (!question) return null;

  const normalized = {
    type: normalizeType(question.type),
    questionText: normalizeText(question.questionText || ''),
    options: normalizeOptions(question.options || []),
    correctAnswer: normalizeAnswer(question.correctAnswer || '', question.options || []),
    markingScheme: normalizeMarkingScheme(question.markingScheme || '', question.points || 10),
    points: normalizePoints(question.points),
    confidence: question.confidence || 50,
    warnings: question.warnings || [],
    errors: question.errors || [],
  };

  return normalized;
}

/**
 * Normalize question type
 */
function normalizeType(type) {
  if (!type) return 'essay';
  
  const typeMap = {
    'mcq': 'mcq',
    'multiple_choice': 'mcq',
    'multiple choice': 'mcq',
    'essay': 'essay',
    'subjective': 'essay',
    'written': 'essay',
    'theory': 'essay',
    'true_false': 'true_false',
    'true/false': 'true_false',
    'boolean': 'true_false',
    'fill_blank': 'fill_blank',
    'fill_in_blank': 'fill_blank',
    'completion': 'fill_blank',
    'matching': 'matching',
    'match': 'matching',
    'calculation': 'calculation',
    'calculate': 'calculation',
    'practical': 'practical',
    'diagram': 'diagram',
    'drawing': 'diagram',
    'short_answer': 'short_answer',
    'short': 'short_answer',
    'brief': 'short_answer',
  };

  const normalized = typeMap[type.toLowerCase().trim()];
  return normalized || 'essay';
}

/**
 * Normalize question text
 */
function normalizeText(text) {
  if (!text) return '';
  
  let normalized = text;
  
  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ');
  
  // Remove leading/trailing whitespace
  normalized = normalized.trim();
  
  // Ensure ends with punctuation for questions
  if (normalized.length > 0 && !/[.!?]$/.test(normalized)) {
    normalized += '?';
  }

  // Truncate if too long
  if (normalized.length > 2000) {
    normalized = normalized.substring(0, 1997) + '...';
  }

  return normalized;
}

/**
 * Normalize options array
 */
function normalizeOptions(options) {
  if (!options || !Array.isArray(options)) {
    return [];
  }

  // Filter out empty options
  let filtered = options.filter(o => o && o.text && o.text.trim().length > 0);
  
  // Normalize labels
  filtered = normalizeOptionLabels(filtered);
  
  // Limit to 5 options
  if (filtered.length > 5) {
    filtered = filtered.slice(0, 5);
  }

  return filtered;
}

/**
 * Normalize correct answer
 */
function normalizeAnswer(answer, options) {
  if (!answer || answer.trim().length === 0) {
    // Default to first option if available
    if (options && options.length > 0) {
      return options[0].label;
    }
    return 'A';
  }

  const normalized = answer.trim().toUpperCase();
  
  // Validate against options
  if (options && options.length > 0) {
    const validLabels = options.map(o => o.label.toUpperCase());
    if (!validLabels.includes(normalized)) {
      // Return first option if answer is invalid
      return options[0].label;
    }
  }

  return normalized;
}

/**
 * Normalize marking scheme
 */
function normalizeMarkingScheme(scheme, points) {
  if (!scheme || scheme.trim().length === 0) {
    // Generate default rubric if missing
    return generateDefaultRubric('Question', points || 10);
  }

  let normalized = scheme.trim();
  
  // Ensure it mentions total points
  if (!/total[:\s]+\d+|^\s*\d+\s*(?:marks?|points?)/im.test(normalized)) {
    // Prepend total points
    normalized = `Marking Scheme (Total: ${points || 10} marks):\n\n` + normalized;
  }

  // Truncate if too long
  if (normalized.length > 500) {
    normalized = normalized.substring(0, 497) + '...';
  }

  return normalized;
}

/**
 * Normalize points/marks
 */
function normalizePoints(points) {
  if (!points || points <= 0) {
    return 1;
  }

  // Round to nearest integer
  const rounded = Math.round(points);
  
  // Clamp to reasonable range
  return Math.min(100, Math.max(1, rounded));
}

/**
 * Normalize an array of questions
 * @param {Array} questions - Array of raw questions
 * @returns {Array} Normalized questions
 */
export function normalizeQuestions(questions) {
  if (!questions || !Array.isArray(questions)) {
    return [];
  }

  return questions
    .map(q => normalizeQuestion(q))
    .filter(q => q !== null);
}

/**
 * Merge duplicate questions (based on similar text)
 * @param {Array} questions - Array of questions
 * @returns {Array} Merged questions
 */
export function mergeDuplicateQuestions(questions) {
  if (!questions || questions.length <= 1) {
    return questions;
  }

  const merged = [];
  const seen = new Set();

  for (const question of questions) {
    if (!question || !question.questionText) continue;

    // Create a simple hash of the question text
    const textHash = question.questionText.toLowerCase().trim().substring(0, 50);
    
    if (!seen.has(textHash)) {
      seen.add(textHash);
      merged.push(question);
    }
  }

  return merged;
}

/**
 * Reconstruct broken question text from multiple lines
 * @param {string[]} lines - Lines of text
 * @param {number} startIndex - Starting index
 * @param {number} endIndex - Ending index
 * @returns {string} Reconstructed text
 */
export function reconstructQuestionText(lines, startIndex, endIndex) {
  if (!lines || lines.length === 0) {
    return '';
  }

  const textLines = lines.slice(startIndex, endIndex + 1);
  
  // Join lines and normalize whitespace
  let text = textLines.join(' ').replace(/\s+/g, ' ').trim();
  
  // Remove option markers from question text
  text = text.replace(/\s*[A-Da-d][)\]\s.\-:]\s*/g, ' ');
  
  // Clean up
  text = text.trim();
  
  return text;
}

/**
 * Infer missing question numbers
 * @param {Array} questions - Array of questions
 * @returns {Array} Questions with inferred numbers
 */
export function inferQuestionNumbers(questions) {
  if (!questions || questions.length === 0) {
    return questions;
  }

  let nextNumber = 1;

  return questions.map(q => {
    if (!q.questionNumber || q.questionNumber <= 0) {
      return { ...q, questionNumber: nextNumber++ };
    }
    
    // Update nextNumber to be greater than current
    nextNumber = Math.max(nextNumber, q.questionNumber + 1);
    return q;
  });
}

/**
 * Repair common OCR errors in question text
 * @param {string} text - Question text
 * @param {number} confidence - Confidence threshold
 * @returns {string} Repaired text
 */
export function repairOCRText(text, confidence = 0.7) {
  if (!text || text.trim().length === 0) {
    return text;
  }

  let repaired = text;

  // Common OCR error corrections
  const ocrFixes = [
    // Letter/number confusion
    { pattern: /\b0([A-Za-z])/g, replacement: 'O$1', confidence: 0.9 },
    { pattern: /\b([A-Za-z])0\b/g, replacement: '$1O', confidence: 0.9 },
    { pattern: /\bl\b/g, replacement: '1', confidence: 0.8 },
    { pattern: /\bI\b/g, replacement: '1', confidence: 0.8 },
    
    // Common word errors
    { pattern: /teh\b/gi, replacement: 'the', confidence: 0.95 },
    { pattern: /\bwat\b/gi, replacement: 'what', confidence: 0.9 },
    { pattern: /\bwih\b/gi, replacement: 'with', confidence: 0.9 },
  ];

  for (const fix of ocrFixes) {
    if (Math.random() < confidence) { // Only apply if confidence is high enough
      repaired = repaired.replace(fix.pattern, fix.replacement);
    }
  }

  return repaired;
}

/**
 * Standardize question format for database
 * @param {Object} question - Normalized question
 * @returns {Object} Database-ready question
 */
export function standardizeForDatabase(question) {
  if (!question) return null;

  return {
    type: question.type,
    questionText: question.questionText,
    options: question.options || [],
    correctAnswer: question.correctAnswer || '',
    markingScheme: question.markingScheme || '',
    points: question.points || 1,
  };
}

/**
 * Convert database question to UI format
 * @param {Object} dbQuestion - Question from database
 * @returns {Object} UI-ready question
 */
export function convertToUIFormat(dbQuestion) {
  if (!dbQuestion) return null;

  return {
    _id: dbQuestion._id?.toString() || '',
    examId: dbQuestion.examId?.toString() || '',
    type: dbQuestion.type || 'essay',
    questionText: dbQuestion.questionText || '',
    options: dbQuestion.options || [],
    correctAnswer: dbQuestion.correctAnswer || '',
    markingScheme: dbQuestion.markingScheme || '',
    points: dbQuestion.points || 1,
  };
}