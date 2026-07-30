/**
 * Stage 3b: Essay Parser
 * Parses essay/subjective questions from normalized text lines.
 */

/**
 * Parse essay questions from a section of lines
 * @param {string[]} lines - Array of text lines for this section
 * @param {number} totalMarks - Total marks for this section (for distribution)
 * @returns {Array} Array of parsed essay question objects
 */
export function parseEssayQuestions(lines, totalMarks = 0) {
  const questions = [];
  let i = 0;
  let questionNumber = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip instruction lines
    if (isInstructionLine(line)) {
      i++;
      continue;
    }

    // Try to parse an essay question
    const result = tryParseSingleEssay(lines, i);
    if (result) {
      questionNumber++;
      const points = totalMarks > 0
        ? Math.max(1, Math.floor(totalMarks / estimateEssayCount(lines, i)))
        : 5;

      const markingScheme = generateMarkingScheme(result, points);

      questions.push({
        type: 'essay',
        questionText: result.questionText,
        options: [],
        correctAnswer: '',
        points: points,
        markingScheme: markingScheme,
      });

      i = result.nextLineIndex;
      continue;
    }

    i++;
  }

  return questions;
}

/**
 * Try to parse a single essay question starting at the given line index
 */
function tryParseSingleEssay(lines, startIndex) {
  if (startIndex >= lines.length) return null;

  const firstLine = lines[startIndex].trim();

  // Must have at least 15 chars to be an essay question
  if (firstLine.length < 15) return null;

  // Check if it starts with a number
  const hasQuestionNumber = /^\d+[.)\s]/.test(firstLine);

  // Extract question number and text
  let questionNumber = '';
  let questionText = firstLine;

  if (hasQuestionNumber) {
    const match = firstLine.match(/^(\d+)[.)\s]\s*(.*)/);
    if (match) {
      questionNumber = match[1];
      questionText = match[2].trim();
    }
  }

  // Look for sub-questions (lowercase a-e) or additional text
  const subQuestions = [];
  let nextIndex = startIndex + 1;
  let hasSubQuestions = false;

  while (nextIndex < lines.length) {
    const line = lines[nextIndex].trim();

    // Check for sub-question pattern: a) text, b. text, (c) text, etc.
    const subMatch = line.match(/^\(?([a-e])\s*[)\].\s]\s*(.+)/);
    
    if (subMatch) {
      hasSubQuestions = true;
      subQuestions.push({
        label: subMatch[1].toLowerCase(),
        text: subMatch[2].trim()
      });
      nextIndex++;
    }
    // Check if this is a continuation of the question text
    else if (!/^[A-Da-d]\s*[)\].\s\-:]/.test(line) &&
             !/^\d+[.)\s]/.test(line) &&
             line.length > 10 &&
             nextIndex - startIndex < 4) {
      questionText += ' ' + line;
      nextIndex++;
    }
    else {
      break;
    }
  }

  // If we found sub-questions, include them
  if (hasSubQuestions) {
    const subText = subQuestions.map(sq => `\n${sq.label}) ${sq.text}`).join('');
    questionText += subText;
  }

  // Must have substantial text
  if (questionText.length < 20) return null;

  return {
    number: questionNumber,
    questionText: questionText,
    subQuestions: subQuestions,
    hasSubQuestions: hasSubQuestions,
    nextLineIndex: nextIndex
  };
}

/**
 * Generate a marking scheme for an essay question
 */
function generateMarkingScheme(essayData, totalPoints) {
  const subCount = essayData.subQuestions.length;

  if (subCount > 0) {
    const pointsPerSub = Math.floor(totalPoints / subCount);
    const remainder = totalPoints - (pointsPerSub * subCount);

    let scheme = `Marking Scheme (Total: ${totalPoints} marks):\n\n`;

    essayData.subQuestions.forEach((sq, index) => {
      const subPoints = pointsPerSub + (index < remainder ? 1 : 0);
      scheme += `${sq.label}) ${sq.text}\n`;
      scheme += `   - ${subPoints} marks\n`;
      scheme += `   - Award marks for key points and clear explanation\n`;
      scheme += `   - Partial marks available for partially correct answers\n\n`;
    });

    scheme += `General Guidelines:\n`;
    scheme += `- Full marks: Complete, accurate answer with clear explanation\n`;
    scheme += `- Half marks: Partially correct with some key points\n`;
    scheme += `- Quarter marks: Attempt made but mostly incorrect\n`;
    scheme += `- Zero marks: No attempt or completely off-topic\n`;

    return scheme;
  }

  return `Marking Scheme (Total: ${totalPoints} marks):\n\n` +
    `Expected Key Points:\n` +
    `- Award marks for each correct key point mentioned\n` +
    `- Credit well-structured and clearly explained answers\n\n` +
    `Marking Guidelines:\n` +
    `- Full marks (${totalPoints} pts): Complete, accurate, well-explained answer\n` +
    `- ${Math.ceil(totalPoints * 0.6)}-${totalPoints - 1} pts: Good answer with minor omissions\n` +
    `- ${Math.ceil(totalPoints * 0.3)}-${Math.ceil(totalPoints * 0.6) - 1} pts: Partial answer, some key points missing\n` +
    `- 1-${Math.ceil(totalPoints * 0.3) - 1} pts: Attempt made but largely incorrect\n` +
    `- 0 pts: No attempt or completely off-topic\n`;
}

/**
 * Estimate number of essay questions in a set of lines
 */
function estimateEssayCount(lines, startFrom = 0) {
  let count = 0;
  for (let i = startFrom; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^\d+[.)\s]/.test(line) && line.length >= 15) {
      // Check if next lines have sub-questions (lowercase a-e) or are long text
      let hasOptions = false;
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        if (/^[A-D]\s*[)\].\s\-:]/.test(lines[j].trim())) {
          hasOptions = true;
          break;
        }
      }
      if (!hasOptions) count++;
    }
  }
  return Math.max(count, 1);
}

/**
 * Check if a line is an instruction (to skip)
 */
function isInstructionLine(line) {
  const trimmed = line.trim();
  if (trimmed.length < 10 && !/^[a-e]\s*[)\].\s\-:]/.test(trimmed)) return true;

  const instructionPatterns = [
    /^select\s+the/i,
    /^choose\s+the/i,
    /^answer\s+(all|any|the)/i,
    /^read\s+the/i,
    /^use\s+the/i,
    /^write\s+your/i,
    /^this\s+section/i,
    /^total\s+marks?/i,
    /^time\s+allowed/i,
    /^instructions?/i,
    /^section\s+/i,
    /^part\s+/i,
  ];

  return instructionPatterns.some(p => p.test(trimmed));
}