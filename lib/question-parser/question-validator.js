/**
 * Question Validator Module
 * Validates parsed questions for completeness and correctness.
 * Single responsibility: Validate question quality.
 */

/**
 * Validate a single question
 * @param {Object} question - Parsed question object
 * @param {number} index - Question index (for warnings)
 * @returns {Object} { valid, warnings, errors, confidence }
 */
export function validateQuestion(question, index = 0) {
  const warnings = [];
  const errors = [];
  let confidence = 100;

  if (!question) {
    return {
      valid: false,
      warnings: [],
      errors: ['Question object is null or undefined'],
      confidence: 0,
    };
  }

  const qNum = index + 1;

  // Validate question text
  if (!question.questionText || question.questionText.trim().length === 0) {
    errors.push(`Question ${qNum}: Question text is empty`);
    confidence -= 50;
  } else if (question.questionText.trim().length < 5) {
    warnings.push(`Question ${qNum}: Question text is very short (${question.questionText.length} chars)`);
    confidence -= 15;
  }

  // Validate question type
  const validTypes = ['mcq', 'essay', 'true_false', 'fill_blank', 'matching', 'calculation', 'practical', 'diagram', 'short_answer'];
  if (!question.type || !validTypes.includes(question.type)) {
    warnings.push(`Question ${qNum}: Invalid or missing question type, defaulting to 'essay'`);
    question.type = 'essay';
    confidence -= 10;
  }

  // Type-specific validation
  if (question.type === 'mcq') {
    const mcqValidation = validateMCQ(question, qNum);
    warnings.push(...mcqValidation.warnings);
    errors.push(...mcqValidation.errors);
    confidence -= mcqValidation.confidencePenalty;
  }

  if (question.type === 'essay' || question.type === 'short_answer') {
    const essayValidation = validateEssay(question, qNum);
    warnings.push(...essayValidation.warnings);
    errors.push(...essayValidation.errors);
    confidence -= essayValidation.confidencePenalty;
  }

  // Validate points/marks
  if (question.points === undefined || question.points === null || question.points <= 0) {
    warnings.push(`Question ${qNum}: Invalid or missing points value, defaulting to 1`);
    question.points = 1;
    confidence -= 10;
  }

  if (question.points > 100) {
    warnings.push(`Question ${qNum}: Points value (${question.points}) seems unusually high`);
    confidence -= 5;
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
    confidence: Math.max(0, Math.min(100, confidence)),
  };
}

/**
 * Validate MCQ question
 */
function validateMCQ(question, qNum) {
  const warnings = [];
  const errors = [];
  let confidencePenalty = 0;

  // Validate options
  if (!question.options || !Array.isArray(question.options)) {
    errors.push(`Question ${qNum}: MCQ must have an options array`);
    confidencePenalty += 30;
  } else if (question.options.length < 2) {
    errors.push(`Question ${qNum}: MCQ must have at least 2 options (has ${question.options.length})`);
    confidencePenalty += 25;
  } else if (question.options.length > 5) {
    warnings.push(`Question ${qNum}: MCQ has more than 5 options (has ${question.options.length})`);
    confidencePenalty += 5;
  }

  // Validate option labels
  if (question.options && question.options.length > 0) {
    const labels = question.options.map(o => o.label).filter(l => l);
    const uniqueLabels = new Set(labels);
    
    if (uniqueLabels.size !== labels.length) {
      warnings.push(`Question ${qNum}: Duplicate option labels detected`);
      confidencePenalty += 10;
    }

    // Validate option text
    const emptyOptions = question.options.filter(o => !o.text || o.text.trim().length === 0);
    if (emptyOptions.length > 0) {
      warnings.push(`Question ${qNum}: ${emptyOptions.length} option(s) have no text`);
      confidencePenalty += 10;
    }

    // Check for duplicate option text
    const texts = question.options.map(o => (o.text || '').toLowerCase().trim()).filter(t => t);
    const uniqueTexts = new Set(texts);
    if (uniqueTexts.size !== texts.length) {
      warnings.push(`Question ${qNum}: Duplicate option text detected`);
      confidencePenalty += 5;
    }
  }

  // Validate correct answer
  if (!question.correctAnswer || question.correctAnswer.trim().length === 0) {
    warnings.push(`Question ${qNum}: No correct answer specified, will default to first option`);
    confidencePenalty += 10;
  } else if (question.options && question.options.length > 0) {
    const validLabels = question.options.map(o => o.label);
    if (!validLabels.includes(question.correctAnswer)) {
      warnings.push(`Question ${qNum}: Correct answer (${question.correctAnswer}) doesn't match any option label`);
      confidencePenalty += 15;
    }
  }

  return { warnings, errors, confidencePenalty };
}

/**
 * Validate essay/short answer question
 */
function validateEssay(question, qNum) {
  const warnings = [];
  const errors = [];
  let confidencePenalty = 0;

  // Essay questions should have marking scheme
  if (!question.markingScheme || question.markingScheme.trim().length === 0) {
    warnings.push(`Question ${qNum}: No marking scheme/rubric provided`);
    confidencePenalty += 15;
  } else if (question.markingScheme.trim().length < 20) {
    warnings.push(`Question ${qNum}: Marking scheme is very short (${question.markingScheme.length} chars)`);
    confidencePenalty += 5;
  }

  // Check if marking scheme has total points
  if (question.markingScheme && !/total[:\s]+\d+|^\s*\d+\s*(?:marks?|points?)/im.test(question.markingScheme)) {
    warnings.push(`Question ${qNum}: Marking scheme doesn't clearly state total marks`);
    confidencePenalty += 5;
  }

  return { warnings, errors, confidencePenalty };
}

/**
 * Validate an array of questions
 * @param {Array} questions - Array of question objects
 * @returns {Object} { valid, questions, summary, allWarnings, allErrors }
 */
export function validateQuestions(questions) {
  const allWarnings = [];
  const allErrors = [];
  let validCount = 0;
  let lowConfidenceCount = 0;

  const validated = questions.map((q, index) => {
    const result = validateQuestion(q, index);
    allWarnings.push(...result.warnings);
    allErrors.push(...result.errors);
    
    if (result.valid) validCount++;
    if (result.confidence < 50) lowConfidenceCount++;

    return {
      ...q,
      valid: result.valid,
      confidence: result.confidence,
      warnings: result.warnings,
      errors: result.errors,
    };
  });

  return {
    valid: allErrors.length === 0,
    questions: validated,
    summary: {
      total: questions.length,
      valid: validCount,
      invalid: questions.length - validCount,
      lowConfidence: lowConfidenceCount,
      warnings: allWarnings.length,
      errors: allErrors.length,
    },
    allWarnings,
    allErrors,
  };
}

/**
 * Auto-fix common issues in questions
 * @param {Object} question - Question object
 * @returns {Object} Fixed question
 */
export function autoFixQuestion(question) {
  if (!question) return question;

  const fixed = { ...question };

  // Fix empty question text
  if (!fixed.questionText || fixed.questionText.trim().length === 0) {
    fixed.questionText = 'Untitled Question';
  }

  // Fix missing type
  if (!fixed.type) {
    fixed.type = fixed.options && fixed.options.length >= 2 ? 'mcq' : 'essay';
  }

  // Fix MCQ issues
  if (fixed.type === 'mcq') {
    // Ensure options array exists
    if (!fixed.options || !Array.isArray(fixed.options)) {
      fixed.options = [];
    }

    // Normalize option labels
    if (fixed.options.length > 0) {
      fixed.options = fixed.options.map((opt, i) => ({
        label: String.fromCharCode(65 + i),
        text: opt.text || opt.label || `Option ${i + 1}`,
      }));
    }

    // Set default correct answer if missing
    if (!fixed.correctAnswer && fixed.options.length > 0) {
      fixed.correctAnswer = fixed.options[0].label;
    }
  }

  // Fix essay issues
  if (fixed.type === 'essay' || fixed.type === 'short_answer') {
    if (!fixed.markingScheme || fixed.markingScheme.trim().length === 0) {
      fixed.markingScheme = generateBasicRubric(fixed.questionText, fixed.points || 10);
    }
  }

  // Fix points
  if (!fixed.points || fixed.points <= 0) {
    fixed.points = 1;
  }

  return fixed;
}

/**
 * Generate basic rubric for essay questions
 */
function generateBasicRubric(questionText, points) {
  return `Marking Scheme (Total: ${points} marks):

Expected Key Points:
- Award marks for correct understanding of the concept
- Credit relevant examples and explanations
- Look for clear structure and logical flow

Marking Guidelines:
- Full marks (${points} pts): Complete and accurate answer
- ${Math.ceil(points * 0.6)}-${points - 1} pts: Good answer with minor omissions
- ${Math.ceil(points * 0.3)}-${Math.ceil(points * 0.6) - 1} pts: Partial understanding
- 0-${Math.ceil(points * 0.3) - 1} pts: Limited or incorrect response`;
}

/**
 * Calculate overall confidence score for parsed exam
 * @param {Array} questions - Array of validated questions
 * @returns {number} Overall confidence 0-100
 */
export function calculateOverallConfidence(questions) {
  if (!questions || questions.length === 0) {
    return 0;
  }

  const totalConfidence = questions.reduce((sum, q) => {
    return sum + (q.confidence || 0);
  }, 0);

  return Math.round(totalConfidence / questions.length);
}

/**
 * Flag questions for manual review
 * @param {Array} questions - Array of validated questions
 * @param {number} threshold - Confidence threshold (default 70)
 * @returns {Array} Questions flagged for review
 */
export function flagLowConfidenceQuestions(questions, threshold = 70) {
  return questions.filter(q => {
    const confidence = q.confidence || 0;
    const hasErrors = q.errors && q.errors.length > 0;
    const hasWarnings = q.warnings && q.warnings.length > 0;
    
    return confidence < threshold || hasErrors || hasWarnings;
  });
}