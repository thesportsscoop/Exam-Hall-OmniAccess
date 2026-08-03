/**
 * Exam Assembler Module
 * Assembles the final exam structure from parsed components.
 * Single responsibility: Assemble exam object.
 */

import { classifyQuestions } from './question-classifier.js';
import { normalizeQuestions, standardizeForDatabase } from './question-normalizer.js';
import { validateQuestions } from './question-validator.js';

/**
 * Assemble final exam object
 * @param {Object} components - Parsed components
 * @returns {Object} Assembled exam
 */
export function assembleExam(components) {
  const {
    metadata,
    sections,
    questions,
    warnings,
    errors,
  } = components;

  // Step 1: Classify questions
  const classifiedQuestions = classifyQuestions(questions);

  // Step 2: Normalize questions
  const normalizedQuestions = normalizeQuestions(classifiedQuestions);

  // Step 3: Validate questions
  const validationResult = validateQuestions(normalizedQuestions);

  // Step 4: Build sections with questions
  const assembledSections = buildSections(sections, validationResult.questions);

  // Step 5: Calculate totals
  const totalQuestions = validationResult.questions.length;
  const totalMarks = validationResult.questions.reduce((sum, q) => sum + (q.points || 0), 0);
  const overallConfidence = calculateOverallConfidence(validationResult.questions);

  // Step 6: Assemble final exam
  const exam = {
    metadata: {
      title: metadata?.title || 'Untitled Exam',
      subject: metadata?.subject || '',
      className: metadata?.className || '',
      duration: metadata?.duration || 0,
      instructions: metadata?.instructions || [],
    },
    sections: assembledSections,
    questions: validationResult.questions,
    summary: {
      totalQuestions,
      totalMarks,
      mcqCount: validationResult.questions.filter(q => q.type === 'mcq').length,
      essayCount: validationResult.questions.filter(q => q.type === 'essay').length,
      otherCount: validationResult.questions.filter(q => !['mcq', 'essay'].includes(q.type)).length,
      overallConfidence,
    },
    validation: {
      valid: validationResult.valid,
      warnings: [...warnings, ...validationResult.allWarnings],
      errors: [...errors, ...validationResult.allErrors],
      lowConfidenceQuestions: validationResult.questions.filter(q => q.confidence < 70),
    },
    detectedFormat: components.detectedFormat || 'natural',
  };

  return exam;
}

/**
 * Build sections with assigned questions
 */
function buildSections(sections, questions) {
  if (!sections || sections.length === 0) {
    // Default: single section with all questions
    return [{
      name: 'Main Section',
      type: 'unknown',
      questions: questions,
      totalMarks: questions.reduce((sum, q) => sum + (q.points || 0), 0),
    }];
  }

  // Filter out answer_key sections (they don't contain questions)
  const questionSections = sections.filter(s => s.type !== 'answer_key');
  
  if (questionSections.length === 0) {
    // All questions go to a single default section
    return [{
      name: 'Main Section',
      type: 'unknown',
      questions: questions,
      totalMarks: questions.reduce((sum, q) => sum + (q.points || 0), 0),
    }];
  }

  // Distribute questions across sections
  // Since questions are already parsed per-section in the pipeline,
  // we distribute them evenly across the question sections
  const sectionsWithQuestions = questionSections.map(section => ({
    ...section,
    questions: [],
    totalMarks: section.totalMarks || 0,
  }));

  // Distribute questions round-robin across sections
  questions.forEach((question, index) => {
    const sectionIndex = index % sectionsWithQuestions.length;
    sectionsWithQuestions[sectionIndex].questions.push(question);
    sectionsWithQuestions[sectionIndex].totalMarks += question.points || 0;
  });

  // Remove empty sections
  return sectionsWithQuestions.filter(s => s.questions.length > 0);
}

/**
 * Calculate overall confidence
 */
function calculateOverallConfidence(questions) {
  if (!questions || questions.length === 0) {
    return 0;
  }

  const totalConfidence = questions.reduce((sum, q) => {
    return sum + (q.confidence || 0);
  }, 0);

  return Math.round(totalConfidence / questions.length);
}

/**
 * Convert assembled exam to intermediate structured object
 * @param {Object} assembledExam - Assembled exam
 * @returns {Object} Intermediate structured object
 */
export function toIntermediateFormat(assembledExam) {
  return {
    exam: {
      title: assembledExam.metadata.title,
      subject: assembledExam.metadata.subject,
      className: assembledExam.metadata.className,
      duration: assembledExam.metadata.duration,
      instructions: assembledExam.metadata.instructions,
      totalQuestions: assembledExam.summary.totalQuestions,
      totalMarks: assembledExam.summary.totalMarks,
    },
    sections: assembledExam.sections.map(section => ({
      name: section.name,
      type: section.type,
      totalMarks: section.totalMarks,
      questions: section.questions.map(q => ({
        type: q.type,
        text: q.questionText,
        options: q.options,
        answer: q.correctAnswer,
        marks: q.points,
        rubric: q.markingScheme,
        confidence: q.confidence,
        warnings: q.warnings,
        errors: q.errors,
      })),
    })),
    validation: assembledExam.validation,
  };
}

/**
 * Convert intermediate format to database format
 * @param {Object} intermediate - Intermediate format
 * @param {string} examId - Exam ID
 * @returns {Array} Array of database-ready questions
 */
export function toDatabaseFormat(intermediate, examId) {
  const dbQuestions = [];

  for (const section of intermediate.sections) {
    for (const question of section.questions) {
      const dbQuestion = standardizeForDatabase({
        type: question.type,
        questionText: question.text,
        options: question.options,
        correctAnswer: question.answer,
        markingScheme: question.rubric,
        points: question.marks,
      });

      if (dbQuestion) {
        dbQuestions.push({
          ...dbQuestion,
          examId,
        });
      }
    }
  }

  return dbQuestions;
}

/**
 * Merge multiple parsed results
 * @param {Array} results - Array of parse results
 * @returns {Object} Merged result
 */
export function mergeParseResults(results) {
  const merged = {
    questions: [],
    warnings: [],
    errors: [],
    sections: [],
    metadata: {},
  };

  for (const result of results) {
    // Merge questions
    if (result.questions && result.questions.length > 0) {
      merged.questions.push(...result.questions);
    }

    // Merge warnings (avoid duplicates)
    if (result.warnings) {
      for (const warning of result.warnings) {
        if (!merged.warnings.includes(warning)) {
          merged.warnings.push(warning);
        }
      }
    }

    // Merge errors
    if (result.errors) {
      for (const error of result.errors) {
        if (!merged.errors.includes(error)) {
          merged.errors.push(error);
        }
      }
    }

    // Merge metadata (first non-empty value wins)
    if (result.metadata) {
      if (!merged.metadata.title && result.metadata.title) {
        merged.metadata.title = result.metadata.title;
      }
      if (!merged.metadata.subject && result.metadata.subject) {
        merged.metadata.subject = result.metadata.subject;
      }
      if (!merged.metadata.duration && result.metadata.duration) {
        merged.metadata.duration = result.metadata.duration;
      }
    }

    // Merge sections
    if (result.sections && result.sections.length > 0) {
      merged.sections.push(...result.sections);
    }
  }

  return merged;
}

/**
 * Validate assembled exam
 * @param {Object} exam - Assembled exam
 * @returns {Object} Validation result
 */
export function validateAssembledExam(exam) {
  const warnings = [];
  const errors = [];
  let isValid = true;

  // Validate metadata
  if (!exam.metadata.title) {
    warnings.push('Exam title is missing');
  }

  if (exam.summary.totalQuestions === 0) {
    errors.push('No questions were parsed');
    isValid = false;
  }

  if (exam.summary.totalMarks === 0) {
    warnings.push('Total marks is 0 - questions may not have marks assigned');
  }

  // Validate questions
  const lowConfidenceQuestions = exam.questions.filter(q => q.confidence < 50);
  if (lowConfidenceQuestions.length > exam.questions.length * 0.5) {
    warnings.push(`${lowConfidenceQuestions.length} of ${exam.questions.length} questions have low confidence - manual review recommended`);
  }

  // Check for duplicate questions
  const questionTexts = exam.questions.map(q => q.questionText.toLowerCase().trim());
  const uniqueTexts = new Set(questionTexts);
  if (uniqueTexts.size !== questionTexts.length) {
    warnings.push('Duplicate questions detected');
  }

  return {
    valid: isValid,
    warnings,
    errors,
    canSave: isValid && errors.length === 0,
  };
}

/**
 * Generate exam summary for UI
 * @param {Object} exam - Assembled exam
 * @returns {string} Human-readable summary
 */
export function generateExamSummary(exam) {
  const parts = [];

  parts.push(`${exam.summary.totalQuestions} question(s)`);
  
  if (exam.summary.mcqCount > 0) {
    parts.push(`${exam.summary.mcqCount} MCQ`);
  }
  
  if (exam.summary.essayCount > 0) {
    parts.push(`${exam.summary.essayCount} Essay`);
  }
  
  if (exam.summary.otherCount > 0) {
    parts.push(`${exam.summary.otherCount} Other`);
  }

  parts.push(`${exam.summary.totalMarks} total marks`);

  if (exam.summary.overallConfidence >= 80) {
    parts.push('(High confidence)');
  } else if (exam.summary.overallConfidence >= 60) {
    parts.push('(Medium confidence)');
  } else {
    parts.push('(Low confidence - review required)');
  }

  return parts.join(' · ');
}