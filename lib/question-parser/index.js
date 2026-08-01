/**
 * Multi-Stage Question Parser Pipeline
 * 
 * Stage 0: Document Cleaning (handle PDF, Word, OCR, WhatsApp artifacts)
 * Stage 1: Metadata Extraction (title, subject, class, duration, instructions)
 * Stage 2: Question Boundary Detection (find where questions begin/end)
 * Stage 3: Question Classification (determine question types)
 * Stage 4: Option/Mark/Rubric/Answer Extraction
 * Stage 5: Question Validation and Normalization
 * Stage 6: Exam Assembly
 * 
 * Returns parse results for preview (does NOT save to database)
 */

import { cleanDocument, assessDocumentQuality } from './document-cleaner.js';
import { extractMetadata, hasMetadataStructure } from './metadata-extractor.js';
import { detectQuestionBoundaries, mergeBoundaries } from './question-boundary-detector.js';
import { classifyQuestion } from './question-classifier.js';
import { extractOptions, mergeSplitOptions } from './option-extractor.js';
import { extractMarks, distributeMarksWithRemainder } from './mark-extractor.js';
import { extractRubric, generateDefaultRubric } from './rubric-extractor.js';
import { extractAnswerKey } from './answer-extractor.js';
import { normalizeQuestions, standardizeForDatabase } from './question-normalizer.js';
import { validateQuestions, autoFixQuestion } from './question-validator.js';
import { assembleExam, toIntermediateFormat, generateExamSummary } from './exam-assembler.js';

/**
 * Main pipeline: Parse text into structured questions
 * @param {string} text - Raw pasted text
 * @returns {Promise<Object>} Parsed exam structure
 */
export async function parseQuestions(text) {
  const result = {
    questions: [],
    warnings: [],
    errors: [],
    sections: [],
    metadata: {},
    detectedFormat: 'natural',
    summary: '',
  };

  if (!text || !text.trim()) {
    result.errors.push('No text provided');
    return result;
  }

  try {
    // Stage 0: Clean document
    const { cleanedText, warnings: cleanWarnings } = cleanDocument(text);
    result.warnings.push(...cleanWarnings);

    // Assess document quality
    const quality = assessDocumentQuality(cleanedText);
    if (quality.score < 30) {
      result.errors.push('Document quality is too low to parse reliably');
      return result;
    }

    const lines = cleanedText.split('\n').filter(l => l.trim());

    // Stage 1: Extract metadata
    result.metadata = extractMetadata(cleanedText);

    // Stage 2: Detect sections (reuse existing section detector)
    const sections = detectSections(lines);
    result.sections = sections;

    // Extract answer key first
    const { answerMap } = extractAnswerKey(lines);

    // Stage 3-4: Parse questions from each section
    const allQuestions = [];

    for (const section of sections) {
      if (section.type === 'answer_key') continue;

      const sectionLines = lines.slice(section.startLine, section.endLine + 1);
      if (sectionLines.length === 0) continue;

      // Detect question boundaries
      const boundaries = detectQuestionBoundaries(sectionLines, section.type);
      const mergedBoundaries = mergeBoundaries(boundaries);

      // Parse each question
      for (const boundary of mergedBoundaries) {
        const questionLines = sectionLines.slice(boundary.startLine, boundary.endLine + 1);
        const questionText = questionLines.join(' ').trim();

        if (questionText.length < 10) continue;

        // Extract options
        const { options } = extractOptions(questionLines, 0);

        // Extract marks
        const marks = extractMarks(questionLines[0]) || section.totalMarks || 1;

        // Extract rubric
        const { rubric } = extractRubric(questionLines, 0, questionLines.length - 1);

        // Classify question
        const questionType = classifyQuestion({
          text: questionText,
          options,
          hasMarkingScheme: rubric.length > 0,
        });

        // Get correct answer
        const correctAnswer = extractAnswerKey.getCorrectAnswer 
          ? extractAnswerKey.getCorrectAnswer(questionText, answerMap, boundary.questionNumber)
          : answerMap[boundary.questionNumber.toString()] || '';

        allQuestions.push({
          questionText,
          type: questionType,
          options,
          correctAnswer,
          markingScheme: rubric || generateDefaultRubric(questionText, marks),
          points: marks,
          confidence: boundary.confidence === 'high' ? 80 : boundary.confidence === 'medium' ? 60 : 40,
          questionNumber: boundary.questionNumber,
        });
      }
    }

    // If no questions found from sections, try whole document
    if (allQuestions.length === 0) {
      const fallbackQuestions = parseFallback(lines, answerMap);
      result.questions.push(...fallbackQuestions);
    } else {
      result.questions.push(...allQuestions);
    }

    // Stage 5: Normalize and validate
    const normalizedQuestions = normalizeQuestions(result.questions);
    const validationResult = validateQuestions(normalizedQuestions);

    result.questions = validationResult.questions;
    result.warnings.push(...validationResult.allWarnings);
    result.errors.push(...validationResult.allErrors);

    // Stage 6: Assemble final exam
    const assembledExam = assembleExam({
      metadata: result.metadata,
      sections: result.sections,
      questions: result.questions,
      warnings: result.warnings,
      errors: result.errors,
      detectedFormat: result.detectedFormat,
    });

    // Convert to intermediate format
    const intermediate = toIntermediateFormat(assembledExam);
    
    result.questions = assembledExam.questions;
    result.sections = intermediate.sections;
    result.validation = assembledExam.validation;
    result.summary = generateExamSummary(assembledExam);

  } catch (error) {
    console.error('Parsing error:', error);
    result.errors.push(`Parsing failed: ${error.message}`);
  }

  return result;
}

/**
 * Fallback parser for unstructured text
 */
function parseFallback(lines, answerMap) {
  const questions = [];
  
  // Try existing MCQ parser
  const mcqQuestions = parseMCQQuestions(lines, answerMap, 0);
  if (mcqQuestions.length > 0) {
    return mcqQuestions;
  }

  // Try existing essay parser
  const essayQuestions = parseEssayQuestions(lines, 0);
  if (essayQuestions.length > 0) {
    return essayQuestions;
  }

  return questions;
}

/**
 * Preview parse results (no saving)
 * @param {string} text - Raw text to parse
 * @returns {Promise<Object>} Parse results for preview
 */
export async function previewParse(text) {
  return await parseQuestions(text);
}
