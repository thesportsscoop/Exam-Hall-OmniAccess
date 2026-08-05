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
import { detectSections } from './section-detector.js';
import { detectQuestionBoundaries, mergeBoundaries } from './question-boundary-detector.js';
import { classifyQuestion } from './question-classifier.js';
import { extractOptions, mergeSplitOptions } from './option-extractor.js';
import { extractMarks, distributeMarksWithRemainder } from './mark-extractor.js';
import { extractRubric, generateDefaultRubric } from './rubric-extractor.js';
import { 
  extractAnswers, 
  extractAnswerKey, 
  applyInlineAnswersToQuestions,
  removeAnswersFromQuestionText,
} from './answer-extractor.js';
import { normalizeQuestions, standardizeForDatabase } from './question-normalizer.js';
import { validateQuestions, autoFixQuestion } from './question-validator.js';
import { assembleExam, toIntermediateFormat, generateExamSummary } from './exam-assembler.js';
import { parseMCQQuestions } from './mcq-parser.js';
import { parseEssayQuestions } from './essay-parser.js';

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
    result.qualityScore = quality.score;
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

    // Extract answers smartly - handles both dedicated answer keys
    // AND inline "Answer: X" patterns after each question
    const { answerMap, inlineAnswerMap, answerLines, warnings: answerWarnings } = extractAnswers(lines);
    result.warnings.push(...answerWarnings);

    // Stage 3-4: Parse questions from each section
    const allQuestions = [];

    console.log(`Found ${sections.length} sections`);
    console.log('Section types:', sections.map(s => `${s.type} (lines ${s.startLine}-${s.endLine})`).join(', '));

    // Determine if we have real question sections (mcq/essay)
    const hasQuestionSections = sections.some(s => s.type === 'mcq' || s.type === 'essay' || s.type === 'true_false' || s.type === 'fill_blank');

    for (const section of sections) {
      if (section.type === 'answer_key') continue;
      
      // For unknown sections, check if they actually contain questions before skipping.
      // Topic headers like "Acids, Bases and Salts" are detected as 'mcq' sections,
      // but the initial "main" section (Q1-5) may be 'unknown' if it has no header.
      if (section.type === 'unknown' && hasQuestionSections) {
        const sectionLines = lines.slice(section.startLine, section.endLine + 1);
        const hasNumberedQuestions = sectionLines.some(l => /^\d+[.)]\s*/.test(l.trim()));
        if (!hasNumberedQuestions) continue;
      }

      const sectionLines = lines.slice(section.startLine, section.endLine + 1);
      console.log(`Processing section type=${section.type}, lines=${sectionLines.length}`);
      
      if (sectionLines.length === 0) continue;

      // Detect question boundaries
      const boundaries = detectQuestionBoundaries(sectionLines, section.type);
      console.log(`Detected ${boundaries.length} boundaries`);
      const mergedBoundaries = mergeBoundaries(boundaries);
      console.log(`After merge: ${mergedBoundaries.length} boundaries`);

      // Parse each question
      for (const boundary of mergedBoundaries) {
        // IMPORTANT: Trim boundary to exclude "Answer: X" lines
        // The boundary detector already handles this, but we double-check here
        let boundaryEnd = boundary.endLine;
        
        // Parse the question
        const questionLines = sectionLines.slice(boundary.startLine, boundaryEnd + 1);
        const questionText = questionLines.join(' ').trim();

        console.log(`Question ${boundary.questionNumber}: ${questionText.substring(0, 50)}...`);
        
        if (questionText.length < 10) {
          console.log(`Skipping question ${boundary.questionNumber}: too short (${questionText.length} chars)`);
          continue;
        }

        // Extract options (start from line 1 since line 0 is the question text)
        const { options } = extractOptions(questionLines, 1);

        // Extract marks - individual marks if specified, otherwise default to 1
        // (section.totalMarks is the total for the whole section, not per-question)
        const marks = extractMarks(questionLines[0]) || 1;

        // Extract rubric
        const { rubric } = extractRubric(questionLines, 0, questionLines.length - 1);

        // Classify question
        const questionType = classifyQuestion({
          text: questionText,
          options,
          hasMarkingScheme: rubric.length > 0,
        });

        // Get correct answer from merged answer map (answer key sections OR inline "Answer: X")
        const correctAnswer = questionType === 'mcq'
          ? (answerMap[boundary.questionNumber.toString()] || inlineAnswerMap[boundary.questionNumber.toString()] || '')
          : '';

        allQuestions.push({
          questionText,
          type: questionType,
          options,
          correctAnswer,
          markingScheme: rubric || (questionType === 'essay' ? generateDefaultRubric(questionText, marks) : ''),
          points: marks,
          confidence: boundary.confidence === 'high' ? 80 : boundary.confidence === 'medium' ? 60 : 40,
          questionNumber: boundary.questionNumber,
        });
      }
    }

    console.log(`Total questions from sections: ${allQuestions.length}`);

    // If no questions found from sections, try whole document
    if (allQuestions.length === 0) {
      console.log('No questions from sections, using fallback parser...');
      const fallbackBoundaries = parseFallback(lines, answerMap);
      console.log(`Fallback found ${fallbackBoundaries.length} boundaries`);
      
      // Convert boundaries to full question objects
      for (const boundary of fallbackBoundaries) {
        const questionLines = lines.slice(boundary.startLine, boundary.endLine + 1);
        const questionText = questionLines.join(' ').trim();
        
        if (questionText.length < 10) continue;
        
        const { options } = extractOptions(questionLines, 1);
        const marks = extractMarks(questionLines[0]) || 1;
        const { rubric } = extractRubric(questionLines, 0, questionLines.length - 1);
        
        const questionType = classifyQuestion({ text: questionText, options, hasMarkingScheme: rubric.length > 0 });
        result.questions.push({
          questionText,
          type: questionType,
          options,
          correctAnswer: questionType === 'mcq' ? (answerMap[boundary.questionNumber.toString()] || inlineAnswerMap[boundary.questionNumber.toString()] || '') : '',
          markingScheme: rubric || (questionType === 'essay' ? generateDefaultRubric(questionText, marks) : ''),
          points: marks,
          confidence: boundary.confidence === 'high' ? 80 : 60,
          questionNumber: boundary.questionNumber,
        });
      }
    } else {
      result.questions.push(...allQuestions);
    }

    // Post-processing: Apply inline answers that may have been missed
    // (e.g., when the question boundary absorbed the "Answer: X" line)
    result.questions = applyInlineAnswersToQuestions(
      result.questions,
      inlineAnswerMap,
      null, // question boundaries are processed per-section, not available globally
      lines
    );

    // Clean question text - remove any "Answer: X" markers that slipped through
    result.questions = removeAnswersFromQuestionText(result.questions);

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
    
    result.questions = intermediate.questions || assembledExam.questions;
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
  
  // Try numbered question detection (most reliable)
  const numberedQuestions = detectByNumberingFallback(lines);
  if (numberedQuestions.length > 0) {
    return numberedQuestions;
  }

  // Try existing MCQ parser
  try {
    const mcqQuestions = parseMCQQuestions(lines, answerMap, 0);
    if (mcqQuestions.length > 0) {
      return mcqQuestions;
    }
  } catch (e) {
    console.error('MCQ parser error:', e);
  }

  // Try existing essay parser
  try {
    const essayQuestions = parseEssayQuestions(lines, 0);
    if (essayQuestions.length > 0) {
      return essayQuestions;
    }
  } catch (e) {
    console.error('Essay parser error:', e);
  }

  return questions;
}

/**
 * Detect questions by numbering patterns (fallback)
 */
function detectByNumberingFallback(lines) {
  const questions = [];
  let currentQuestion = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip "Answer: X" lines - they are not question starts
    if (/^(?:the\s+)?(?:correct\s+)?(?:answer|ans|key)\s*[:=\-–—]/i.test(line)) {
      continue;
    }

    // Match numbered questions: "1.", "2)", "Q1:", "Question 1", etc.
    const numberMatch = line.match(/^(?:question\s+)?(\d+)[.)]\s*(.+)/i) ||
                        line.match(/^q(\d+)[.:]\s*(.+)/i) ||
                        line.match(/^(\d+)\.\s*(.+)/i);
    
    if (numberMatch && numberMatch[2].length > 3) {
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
  }

  // Save last question
  if (currentQuestion) {
    questions.push(currentQuestion);
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