/**
 * Stage 3: Question Classifier
 * Automatically classifies questions by type based on multiple signals.
 * Single responsibility: Determine question type.
 */

/**
 * Question types supported
 */
export const QUESTION_TYPES = {
  MCQ: 'mcq',
  ESSAY: 'essay',
  TRUE_FALSE: 'true_false',
  FILL_BLANK: 'fill_blank',
  MATCHING: 'matching',
  CALCULATION: 'calculation',
  PRACTICAL: 'practical',
  DIAGRAM: 'diagram',
  SHORT_ANSWER: 'short_answer',
};

/**
 * Classify a question based on its content
 * @param {Object} questionData - { text, options, hasMarkingScheme }
 * @returns {string} Question type
 */
export function classifyQuestion(questionData) {
  const { text, options = [], hasMarkingScheme = false } = questionData;
  const lowerText = text.toLowerCase();

  // Signal 1: Options present with A/B/C/D pattern
  const hasABCOptions = options.some(o => /^[A-D]$/i.test(o.label));
  
  // Signal 2: Marking scheme present
  const hasRubric = hasMarkingScheme || /rubric|marking\s*scheme|marking\s*guideline/i.test(lowerText);
  
  // Signal 3: Question verbs and keywords
  const mcqKeywords = /\b(which|what|choose|select|identify|best|correct|following)\b/i;
  const essayKeywords = /\b(discuss|explain|analyze|evaluate|describe|calculate|find|determine|prove|derive|write|outline|account)\b/i;
  const trueFalseKeywords = /\b(true|false|correct|incorrect|statement)\b/i;
  const fillBlankKeywords = /_{3,}|\.{3,}|fill\s*in|complete|blank/i;
  const matchingKeywords = /\b(match|column|pair|correspond)\b/i;
  const calculationKeywords = /\b(calculate|compute|solve|find\s+the\s+value|determine\s+the|what\s+is\s+\d)/i;
  const practicalKeywords = /\b(practical|experiment|laboratory|procedure|observation|result)\b/i;
  const diagramKeywords = /\b(diagram|draw|label|sketch|figure|illustrate|chart)\b/i;

  // Signal 4: Question length
  const isShortQuestion = text.length < 50;
  const isLongQuestion = text.length > 150;

  // Decision tree with multiple signals

  // Diagram questions: explicit diagram keywords
  if (diagramKeywords.test(lowerText)) {
    return QUESTION_TYPES.DIAGRAM;
  }

  // Practical questions: explicit practical keywords
  if (practicalKeywords.test(lowerText)) {
    return QUESTION_TYPES.PRACTICAL;
  }

  // Matching questions: explicit matching keywords + typically has options
  if (matchingKeywords.test(lowerText) && hasABCOptions) {
    return QUESTION_TYPES.MATCHING;
  }

  // Calculation questions: explicit calculation keywords
  if (calculationKeywords.test(lowerText)) {
    return QUESTION_TYPES.CALCULATION;
  }

  // Fill in the blank: blank patterns
  if (fillBlankKeywords.test(text)) {
    return QUESTION_TYPES.FILL_BLANK;
  }

  // True/False: explicit true/false keywords
  if (trueFalseKeywords.test(lowerText) && isShortQuestion) {
    return QUESTION_TYPES.TRUE_FALSE;
  }

  // MCQ: has options and short question
  if (hasABCOptions && options.length >= 2 && !hasRubric) {
    return QUESTION_TYPES.MCQ;
  }

  // Essay: has marking scheme or long question with essay verbs
  if (hasRubric || (essayKeywords.test(lowerText) && isLongQuestion)) {
    return QUESTION_TYPES.ESSAY;
  }

  // Short answer: short question without options
  if (isShortQuestion && !hasABCOptions) {
    return QUESTION_TYPES.SHORT_ANSWER;
  }

  // Default to MCQ if has options, otherwise essay
  if (hasABCOptions && options.length >= 2) {
    return QUESTION_TYPES.MCQ;
  }

  // Fallback
  return QUESTION_TYPES.ESSAY;
}

/**
 * Classify multiple questions
 * @param {Array} questions - Array of question objects
 * @returns {Array} Questions with type field added
 */
export function classifyQuestions(questions) {
  return questions.map(q => ({
    ...q,
    type: classifyQuestion({
      text: q.questionText || '',
      options: q.options || [],
      hasMarkingScheme: !!(q.markingScheme && q.markingScheme.length > 0),
    }),
  }));
}

/**
 * Get confidence score for classification
 * @param {Object} questionData - Question data
 * @param {string} detectedType - Detected type
 * @returns {number} Confidence 0-100
 */
export function getClassificationConfidence(questionData, detectedType) {
  let confidence = 50; // Base confidence

  const { text, options = [] } = questionData;
  const lowerText = text.toLowerCase();

  // Boost confidence based on strong signals
  if (options.length >= 4 && detectedType === QUESTION_TYPES.MCQ) {
    confidence += 30;
  }

  if (/rubric|marking\s*scheme/i.test(text) && detectedType === QUESTION_TYPES.ESSAY) {
    confidence += 25;
  }

  if (/diagram|draw/i.test(lowerText) && detectedType === QUESTION_TYPES.DIAGRAM) {
    confidence += 30;
  }

  if (/calculate|compute/i.test(lowerText) && detectedType === QUESTION_TYPES.CALCULATION) {
    confidence += 25;
  }

  // Reduce confidence for ambiguous cases
  if (options.length === 0 && detectedType === QUESTION_TYPES.MCQ) {
    confidence -= 20;
  }

  if (text.length < 20) {
    confidence -= 15;
  }

  return Math.min(100, Math.max(0, confidence));
}

/**
 * Validate classification makes sense
 * @param {Object} question - Question object
 * @returns {Array} Warnings array
 */
export function validateClassification(question) {
  const warnings = [];
  const { type, questionText, options, markingScheme } = question;

  // MCQ should have options
  if (type === QUESTION_TYPES.MCQ && (!options || options.length < 2)) {
    warnings.push('MCQ question has fewer than 2 options');
  }

  // Essay should have marking scheme
  if (type === QUESTION_TYPES.ESSAY && (!markingScheme || markingScheme.length < 10)) {
    warnings.push('Essay question has no or minimal marking scheme');
  }

  // True/False should have clear statement
  if (type === QUESTION_TYPES.TRUE_FALSE && questionText.length < 10) {
    warnings.push('True/False question text is very short');
  }

  return warnings;
}