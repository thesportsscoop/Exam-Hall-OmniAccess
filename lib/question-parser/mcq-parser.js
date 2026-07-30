/**
 * Stage 3a: MCQ Parser
 * Parses multiple choice questions from normalized text lines.
 */

/**
 * Parse MCQ questions from a section of lines
 * @param {string[]} lines - Array of text lines for this section
 * @param {Object} answerMap - Map of question numbers to answer letters
 * @param {number} totalMarks - Total marks for this section (for distribution)
 * @returns {Array} Array of parsed MCQ question objects
 */
export function parseMCQQuestions(lines, answerMap = {}, totalMarks = 0) {
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

    // Try to parse a question with options
    const result = tryParseSingleMCQ(lines, i);
    if (result) {
      questionNumber++;
      const answer = answerMap[questionNumber.toString()] || answerMap[result.number] || '';
      const points = totalMarks > 0
        ? Math.max(1, Math.floor(totalMarks / estimateMCQCount(lines)))
        : 1;

      questions.push({
        type: 'mcq',
        questionText: result.questionText,
        options: result.options,
        correctAnswer: answer || result.options[0]?.label || 'A',
        points: points,
        markingScheme: '',
      });

      i = result.nextLineIndex;
      continue;
    }

    i++;
  }

  return questions;
}

/**
 * Try to parse a single MCQ question starting at the given line index
 */
function tryParseSingleMCQ(lines, startIndex) {
  if (startIndex >= lines.length) return null;

  const firstLine = lines[startIndex].trim();

  // Must have at least 10 chars to be a question
  if (firstLine.length < 10) return null;

  // Extract question number if present
  let questionNumber = '';
  let questionText = firstLine;

  const hasQuestionNumber = /^\d+[.)\s]/.test(firstLine);
  if (hasQuestionNumber) {
    const match = firstLine.match(/^(\d+)[.)\s]\s*(.*)/);
    if (match) {
      questionNumber = match[1];
      questionText = match[2].trim();
    }
  }

  // Look for options in the next lines
  const options = [];
  let nextIndex = startIndex + 1;

  while (nextIndex < lines.length) {
    const line = lines[nextIndex].trim();

    // Match options: A) text, B. text, C - text, D: text, (A) text, a) text, etc.
    const optionMatch = line.match(/^\(?([A-Da-d])\s*[)\].\s\-:]\s*(.+)/);
    
    if (optionMatch) {
      options.push({
        label: optionMatch[1].toUpperCase(),
        text: optionMatch[2].trim()
      });
      nextIndex++;
    } else {
      break;
    }
  }

  // Must have at least 2 options
  if (options.length < 2) return null;

  return {
    number: questionNumber,
    questionText: questionText,
    options: options,
    nextLineIndex: nextIndex
  };
}

/**
 * Estimate number of MCQ questions in a set of lines
 */
function estimateMCQCount(lines) {
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^\d+[.)\s]/.test(line) && line.length >= 10) {
      // Check if next lines have options
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        if (/^[A-Da-d]\s*[)\].\s\-:]/.test(lines[j].trim())) {
          count++;
          break;
        }
      }
    }
  }
  return Math.max(count, 1);
}

/**
 * Check if a line is an instruction (to skip)
 */
function isInstructionLine(line) {
  const trimmed = line.trim();
  if (trimmed.length < 10 && !/^[A-Da-d]\s*[)\].\s\-:]/.test(trimmed)) return true;

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