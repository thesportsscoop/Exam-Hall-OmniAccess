/**
 * Multi-Stage Question Parser Pipeline
 * 
 * Stage 1: Normalize text (fix line breaks, whitespace)
 * Stage 2: Detect sections (Section A, B, Answer Key, etc.)
 * Stage 3: Parse each section with dedicated parsers (MCQ, Essay)
 * Stage 4: AI Validation (optional, fails gracefully)
 * 
 * Returns parse results for preview (does NOT save to database)
 */

import { normalizeText, detectTableFormat } from './normalizer.js';
import { detectSections, extractAnswerKey } from './section-detector.js';
import { parseMCQQuestions } from './mcq-parser.js';
import { parseEssayQuestions } from './essay-parser.js';
import { validateWithAI } from './ai-validator.js';

/**
 * Main pipeline: Parse text into structured questions
 * @param {string} text - Raw pasted text
 * @returns {Object} { questions: Array, warnings: Array, errors: Array, sections: Array }
 */
export async function parseQuestions(text) {
  const result = {
    questions: [],
    warnings: [],
    errors: [],
    sections: [],
    detectedFormat: 'natural',
  };

  if (!text || !text.trim()) {
    result.errors.push('No text provided');
    return result;
  }

  // Stage 1: Normalize
  const normalized = normalizeText(text);
  if (!normalized) {
    result.errors.push('Text normalization produced empty result');
    return result;
  }

  const lines = normalized.split('\n').filter(l => l.trim());

  // Check for table format
  if (detectTableFormat(text)) {
    result.detectedFormat = 'table';
    result.warnings.push('Table format detected. Please use the paste text tab for tabular data.');
    return result;
  }

  // Stage 2: Detect sections
  const sections = detectSections(lines);
  result.sections = sections;

  // Stage 3: Parse each section
  // First, extract answer key from the entire text
  const { answerMap } = extractAnswerKey(lines);

  for (const section of sections) {
    const sectionLines = lines.slice(section.startLine, section.endLine + 1);
    
    if (sectionLines.length === 0) continue;

    // Skip answer key sections (already extracted)
    if (section.type === 'answer_key') continue;

    // Parse based on section type
    let sectionQuestions = [];

    if (section.type === 'mcq' || section.type === 'unknown') {
      // Try MCQ first
      sectionQuestions = parseMCQQuestions(sectionLines, answerMap, section.totalMarks);
    }

    if (section.type === 'essay' || (section.type === 'unknown' && sectionQuestions.length === 0)) {
      // Try essay
      const essayQuestions = parseEssayQuestions(sectionLines, section.totalMarks);
      
      // If we already found MCQs, add essays too
      if (section.type === 'essay') {
        sectionQuestions = essayQuestions;
      } else if (section.type === 'unknown' && sectionQuestions.length === 0) {
        sectionQuestions = essayQuestions;
      }
    }

    // If still no questions found and this is the main section, try both parsers
    if (sectionQuestions.length === 0 && section.type === 'unknown') {
      sectionQuestions = parseMCQQuestions(sectionLines, answerMap, 0);
      if (sectionQuestions.length === 0) {
        sectionQuestions = parseEssayQuestions(sectionLines, 0);
      }
    }

    result.questions.push(...sectionQuestions);
  }

  // If no questions found, try parsing the entire text as a mixed set
  if (result.questions.length === 0) {
    // Try MCQ across all lines
    result.questions = parseMCQQuestions(lines, answerMap, 0);
    
    if (result.questions.length === 0) {
      // Try essay across all lines
      result.questions = parseEssayQuestions(lines, 0);
    }
  }

  // Stage 4: AI Validation (optional)
  if (result.questions.length > 0) {
    try {
      const validation = await validateWithAI(result.questions, text);
      result.warnings.push(...validation.warnings);
      result.errors.push(...validation.errors);
    } catch (e) {
      console.error('AI validation error:', e.message);
    }
  }

  // Add summary
  const mcqCount = result.questions.filter(q => q.type === 'mcq').length;
  const essayCount = result.questions.filter(q => q.type === 'essay').length;

  if (result.questions.length > 0) {
    result.summary = `Found ${result.questions.length} question(s)`;
    if (mcqCount > 0) result.summary += ` (${mcqCount} MCQ`;
    if (essayCount > 0) result.summary += `${mcqCount > 0 ? ', ' : ' ('}${essayCount} Essay`;
    if (mcqCount > 0 || essayCount > 0) result.summary += ')';
  } else {
    result.warnings.push('Could not detect any structured questions. Consider using the AI Generate tab instead.');
  }

  return result;
}

/**
 * Preview parse results (no saving)
 * @param {string} text - Raw text to parse
 * @returns {Object} Parse results for preview
 */
export async function previewParse(text) {
  return await parseQuestions(text);
}