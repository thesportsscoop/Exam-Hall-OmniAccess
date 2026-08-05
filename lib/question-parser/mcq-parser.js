/**
 * Stage 3a: MCQ Parser
 * Parses multiple choice questions from normalized text lines.
 */

import { extractAnswerFromLine } from './answer-extractor.js';

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

    // Skip "Answer: X" lines (treated as separators)
    if (isAnswerLine(line)) {
      i++;
      continue;
    }

    // Try to parse a question with options
    const result = tryParseSingleMCQ(lines, i);
    if (result) {
      questionNumber++;
      const lookupKey = result.number || questionNumber.toString();
      const answer = answerMap[lookupKey] || answerMap[questionNumber.toString()] || implicitAnswerFromText(result);
      
      const points = totalMarks > 0
        ? Math.max(1, Math.floor(totalMarks / estimateMCQCount(lines)))
        : 1;

      const correctAnswer = answer || result.inlineAnswer || '';

      questions.push({
        type: 'mcq',
        questionText: result.questionText,
        options: result.options,
        correctAnswer: correctAnswer, // Left unfilled if missing to prevent silent wrong keys
        points: points,
        markingScheme: '',
        answerSource: result.inlineAnswer ? 'inline' : (answer ? 'answer_key' : ''),
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

  // Skip answer lines
  if (isAnswerLine(firstLine)) return null;

  // Must have at least 5 chars to be a question
  if (firstLine.length < 5) return null;

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
  let inlineAnswer = '';

  while (nextIndex < lines.length) {
    const line = lines[nextIndex].trim();

    // Check for "Answer: X" line - stop parsing here
    const answerMatch = extractAnswerFromLine(line);
    if (answerMatch && answerMatch.letter && options.length > 0) {
      inlineAnswer = answerMatch.letter.toUpperCase();
      nextIndex++;
      break;
    }

    // Stop at answer key lines
    if (isAnswerLine(line) && options.length > 0) {
      // Even without a letter, stop the options parsing
      nextIndex++;
      break;
    }

    // Enhanced regex to safely capture options with varying punctuation/spacing artifacts
    const optionMatch = line.match(/^\(?([A-Da-d])\s*[\)\.\-\:]\s*(.+)/);
    
    if (optionMatch) {
      options.push({
        label: optionMatch[1].toUpperCase(),
        text: optionMatch[2].trim()
      });
      nextIndex++;
    } else if (line === '' && options.length > 0) {
      // Allow single blank lines between options without breaking sequence
      nextIndex++;
    } else {
      break;
    }
  }

  // Must have at least 2 options
  if (options.length < 2) return null;

  // Clean the question text - remove any answer markers
  const cleanedQuestionText = stripInlineAnswers(questionText);

  return {
    number: questionNumber,
    questionText: cleanedQuestionText,
    options: options,
    nextLineIndex: nextIndex,
    inlineAnswer: inlineAnswer,
  };
}

/**
 * Strip inline answer markers from question text
 */
function stripInlineAnswers(text) {
  if (!text) return '';
  
  return text
    .replace(/(?:the\s+)?(?:correct\s+)?(?:answer|ans|key)\s*[:=\-]\s*\(?\s*[A-Ea-e]\s*\)?\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract implicit answer from parsed question (inside questionText)
 */
function implicitAnswerFromText(result) {
  if (!result || !result.questionText) return '';
  
  const match = result.questionText.match(
    /(?:the\s+)?(?:correct\s+)?(?:answer|ans|key)\s*[:=\-]\s*\(?\s*([A-Ea-e])\s*\)?/i
  );
  return match ? match[1].toUpperCase() : '';
}

/**
 * Check if a line is an answer marker line ("Answer: B", "Ans:", etc.)
 */
function isAnswerLine(line) {
  return (
    /^(?:the\s+)?(?:correct\s+)?(?:answer|ans|key|revision)\s*[:=\-–—]\s*\(?\s*[A-Ea-e]\s*\)?\.?\s*$/i.test(line) ||
    /^(?:the\s+)?(?:correct\s+)?answer\s+is\s+\(?\s*[A-Ea-e]\s*\)?\.?\s*$/i.test(line)
  );
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
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        if (/^[A-Da-d]\s*[\)\.\-\:]/.test(lines[j].trim())) {
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
  if (trimmed.length < 10 && !/^[A-Da-d]\s*[\)\.\-\:]/.test(trimmed)) return true;

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