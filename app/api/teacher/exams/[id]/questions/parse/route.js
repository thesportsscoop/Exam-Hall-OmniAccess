import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Exam from '@/models/Exam';
import Question from '@/models/Question';
import { getAuthUser } from '@/lib/auth';

/**
 * Intelligent question parser that handles multiple formats:
 * - Natural language: "Question text\nA) Option A\nB) Option B\nC) Option C\nD) Option D"
 * - Table formats: TSV, CSV, semicolon-delimited
 * - Sections with point values: "Section A: Multiple Choice (40 Marks)"
 * - Essay questions with sub-questions: "a) ... b) ... c) ..."
 * - Answer keys in various formats: packed "1B2C3A", table, or list
 * - Auto-generates marking schemes for essay questions
 */

function parseQuestionText(text) {
  const lines = text.trim().split('\n').filter(line => line.trim());
  const result = {
    mcqQuestions: [],
    essayQuestions: [],
    totalMcqMarks: 0,
    totalEssayMarks: 0,
    detectedFormat: 'natural',
  };

  // Step 1: Extract sections and their point values
  const sections = extractSections(lines);
  
  // Step 2: Detect if this is a table format (TSV/CSV)
  const isTableFormat = detectTableFormat(lines);
  
  if (isTableFormat) {
    return parseTableFormat(lines, result);
  }

  // Step 3: Parse natural language format
  return parseNaturalLanguage(lines, sections, result);
}

function extractSections(lines) {
  const sections = [];
  let currentSection = { name: 'main', mcqMarks: 0, essayMarks: 0, startLine: 0 };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const sectionMatch = line.match(/section\s+([A-Z]|[0-9]+)\s*[:.\-–]\s*(.+)/i);
    
    if (sectionMatch) {
      // Save previous section
      if (currentSection.startLine < i) {
        currentSection.endLine = i - 1;
        sections.push(currentSection);
      }
      
      // Extract marks from section title
      const title = sectionMatch[2];
      const marksMatch = title.match(/\(?\s*(\d+)\s*marks?\s*\)?/i);
      const isMCQ = /mcq|multiple\s*choice|objective/i.test(title);
      const isEssay = /essay|theory|written|subjective/i.test(title);
      
      currentSection = {
        name: title.trim(),
        mcqMarks: isMCQ && marksMatch ? parseInt(marksMatch[1]) : 0,
        essayMarks: isEssay && marksMatch ? parseInt(marksMatch[1]) : 0,
        startLine: i + 1,
        endLine: lines.length - 1,
      };
    }
  }
  
  // Save last section
  currentSection.endLine = lines.length - 1;
  sections.push(currentSection);
  
  return sections;
}

function detectTableFormat(lines) {
  const checkLines = lines.slice(0, Math.min(15, lines.length));
  
  let tabCount = 0;
  let commaCount = 0;
  let semicolonCount = 0;
  
  for (const line of checkLines) {
    if (line.includes('\t')) tabCount++;
    if (line.includes(',')) commaCount++;
    if (line.includes(';')) semicolonCount++;
  }
  
  if (tabCount > checkLines.length * 0.4) return true;
  
  const headerPattern = /(no|question|answer|option|a\s|b\s|c\s|d\s)/i;
  for (const line of checkLines) {
    if (headerPattern.test(line) && (line.includes('\t') || line.includes(','))) {
      return true;
    }
  }
  
  return false;
}

function parseTableFormat(lines, result) {
  let delimiter = '\t';
  const tabCount = lines.filter(l => l.includes('\t')).length;
  const commaCount = lines.filter(l => l.includes(',')).length;
  const semicolonCount = lines.filter(l => l.includes(';')).length;
  
  if (commaCount > tabCount) delimiter = ',';
  if (semicolonCount > commaCount && semicolonCount > tabCount) delimiter = ';';
  
  let headerIndex = -1;
  const headerKeywords = ['no', 'question', 'answer', 'option'];
  
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const lower = lines[i].toLowerCase();
    if (headerKeywords.some(k => lower.includes(k))) {
      headerIndex = i;
      break;
    }
  }
  
  let answerKeyIndex = lines.length;
  for (let i = Math.max(headerIndex + 1, 0); i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes('answer key') || lower.includes('answers:')) {
      answerKeyIndex = i;
      break;
    }
  }
  
  const dataRows = [];
  const startRow = headerIndex >= 0 ? headerIndex + 1 : 0;
  
  for (let i = startRow; i < answerKeyIndex; i++) {
    const parts = lines[i].split(delimiter).map(s => s.trim());
    if (parts.length >= 5) {
      dataRows.push({
        number: parts[0],
        text: parts[1],
        options: parts.slice(2, 6),
        answer: null
      });
    }
  }
  
  const answerMap = {};
  for (let i = answerKeyIndex; i < lines.length; i++) {
    const parts = lines[i].split(delimiter).map(s => s.trim());
    if (parts.length >= 2 && /^\d+$/.test(parts[0])) {
      answerMap[parts[0]] = parts[1].toUpperCase().replace(/[^A-D]/g, '');
    }
  }
  
  for (const row of dataRows) {
    const answer = answerMap[row.number] || row.answer || 'A';
    const optionLabels = ['A', 'B', 'C', 'D'];
    const options = row.options.map((text, i) => ({
      label: optionLabels[i],
      text: text
    }));
    
    result.mcqQuestions.push({
      type: 'mcq',
      questionText: row.text,
      options,
      correctAnswer: answer,
      points: 1,
      markingScheme: '',
    });
    result.totalMcqMarks += 1;
  }
  
  result.detectedFormat = 'table';
  return result;
}

function parseNaturalLanguage(lines, sections, result) {
  // Step 1: Find answer key section
  const answerKeyData = extractAnswerKey(lines);
  const answerMap = answerKeyData.map;
  const answerKeyEndLine = answerKeyData.endLine;
  
  // Step 2: Determine the effective lines to parse for questions
  const questionLines = lines.slice(0, answerKeyEndLine);
  
  // Step 3: Pre-process lines to merge "Question N" headers with their content
  const processedLines = preProcessQuestionHeaders(questionLines);
  
  // Step 4: Parse questions from the processed text
  let i = 0;
  let questionNumber = 0;
  
  while (i < processedLines.length) {
    const line = processedLines[i].trim();
    
    // Skip section headers
    if (/^section\s+/i.test(line)) {
      i++;
      continue;
    }
    
    // Skip instruction lines
    if (isInstructionLine(line)) {
      i++;
      continue;
    }
    
    // Try to parse an MCQ question (UPPERCASE A-D options)
    const mcqResult = tryParseMCQ(processedLines, i);
    if (mcqResult) {
      questionNumber++;
      const section = getCurrentSection(sections, findOriginalLineIndex(lines, processedLines[i]));
      const points = section && section.mcqMarks > 0 
        ? Math.max(1, Math.floor(section.mcqMarks / estimateQuestionCount(processedLines, sections, 'mcq')))
        : 1;
      
      const answer = answerMap[questionNumber.toString()] || answerMap[mcqResult.number] || '';
      
      result.mcqQuestions.push({
        type: 'mcq',
        questionText: mcqResult.questionText,
        options: mcqResult.options,
        correctAnswer: answer || 'A',
        points: points,
        markingScheme: '',
      });
      result.totalMcqMarks += points;
      
      i = mcqResult.nextLineIndex;
      continue;
    }
    
    // Try to parse an essay question (lowercase a-e sub-questions or "Question N" header)
    const essayResult = tryParseEssay(processedLines, i);
    if (essayResult) {
      questionNumber++;
      const section = getCurrentSection(sections, findOriginalLineIndex(lines, processedLines[i]));
      const points = section && section.essayMarks > 0
        ? Math.max(1, Math.floor(section.essayMarks / estimateQuestionCount(processedLines, sections, 'essay')))
        : 5;
      
      const markingScheme = generateMarkingScheme(essayResult, points);
      
      result.essayQuestions.push({
        type: 'essay',
        questionText: essayResult.questionText,
        options: [],
        correctAnswer: '',
        points: points,
        markingScheme: markingScheme,
      });
      result.totalEssayMarks += points;
      
      i = essayResult.nextLineIndex;
      continue;
    }
    
    i++;
  }
  
  // If no questions were found, try aggressive parse
  if (result.mcqQuestions.length === 0 && result.essayQuestions.length === 0) {
    return parseAggressive(lines, answerMap, result);
  }
  
  return result;
}

function preProcessQuestionHeaders(lines) {
  // Merge "Question N" header lines with the following sub-questions
  const result = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    const questionMatch = line.match(/^question\s+(\d+)\s*[:.\-]?\s*(.*)/i);
    
    if (questionMatch) {
      const questionNum = questionMatch[1];
      const questionTitle = questionMatch[2].trim();
      
      // Look ahead to see if there are sub-questions (a, b, c) following
      let nextIdx = i + 1;
      let hasSubQuestions = false;
      
      while (nextIdx < lines.length) {
        const nextLine = lines[nextIdx].trim();
        if (/^\(?[a-e]\s*[)\].\s]\s*.+/i.test(nextLine)) {
          hasSubQuestions = true;
          nextIdx++;
        } else {
          break;
        }
      }
      
      if (hasSubQuestions) {
        // Merge the "Question N" header with the sub-questions
        let mergedText = questionTitle || `Question ${questionNum}`;
        for (let j = i + 1; j < nextIdx; j++) {
          mergedText += '\n' + lines[j].trim();
        }
        result.push(mergedText);
        i = nextIdx;
      } else {
        result.push(line);
        i++;
      }
    } else {
      result.push(line);
      i++;
    }
  }
  
  return result;
}

function findOriginalLineIndex(originalLines, processedLine) {
  // Find the approximate original line index for a processed line
  for (let i = 0; i < originalLines.length; i++) {
    if (originalLines[i].trim() === processedLine) return i;
  }
  return 0;
}

function isInstructionLine(line) {
  const trimmed = line.trim();
  
  // Skip very short lines that aren't options
  if (trimmed.length < 10 && !/^[A-D]\s*[)\].\s\-:]/.test(trimmed)) return true;
  
  // Skip common instruction patterns
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

function tryParseMCQ(lines, startIndex) {
  if (startIndex >= lines.length) return null;
  
  const firstLine = lines[startIndex].trim();
  
  // A line is a candidate MCQ question if it:
  // 1. Starts with a number (e.g., "1. What is...")
  // 2. Has a question mark
  // 3. Is at least 10 chars long
  const hasQuestionNumber = /^\d+[.)\s]/.test(firstLine);
  const isQuestionText = firstLine.length >= 10;
  
  if (!hasQuestionNumber && !isQuestionText) return null;
  
  // Extract question number if present
  let questionNumber = '';
  let questionText = firstLine;
  
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
    
    // Match options: A) text, B. text, C - text, D: text, (A) text, etc.
    // Accept both uppercase A-D and lowercase a-d
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
  
  // Must have at least 2 options to be a valid MCQ
  if (options.length < 2) return null;
  
  return {
    number: questionNumber,
    questionText: questionText,
    options: options,
    nextLineIndex: nextIndex
  };
}

function tryParseEssay(lines, startIndex) {
  if (startIndex >= lines.length) return null;
  
  const firstLine = lines[startIndex].trim();
  
  // Essay questions typically have:
  // 1. Starts with a number and has sub-questions (a, b, c)
  // 2. Has sub-questions starting with lowercase a-e
  // 3. Is a longer text (> 30 chars) without MCQ options
  const hasQuestionNumber = /^\d+[.)\s]/.test(firstLine);
  const isLongText = firstLine.length > 30;
  const startsWithSubQuestion = /^\(?[a-e]\s*[)\].\s]\s*.+/i.test(firstLine) && firstLine.length > 20;
  
  if (!hasQuestionNumber && !isLongText && !startsWithSubQuestion) return null;
  
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
    // LOWERCASE a-e (not uppercase A-D which are MCQ options)
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
    else if (!/^[A-D]\s*[)\].\s\-:]/.test(line) && 
             !/^\d+[.)\s]/.test(line) &&
             !/^section\s+/i.test(line) &&
             line.length > 10 &&
             nextIndex - startIndex < 4) {
      questionText += ' ' + line;
      nextIndex++;
    } 
    else {
      break;
    }
  }
  
  // If we found sub-questions, include them in the question text
  if (hasSubQuestions) {
    const subText = subQuestions.map(sq => `\n${sq.label}) ${sq.text}`).join('');
    questionText += subText;
  }
  
  // Must have substantial text to be an essay question
  if (questionText.length < 20) return null;
  
  return {
    number: questionNumber,
    questionText: questionText,
    subQuestions: subQuestions,
    hasSubQuestions: hasSubQuestions,
    nextLineIndex: nextIndex
  };
}

function extractAnswerKey(lines) {
  const answerMap = {};
  let answerKeyEndLine = lines.length;
  
  // Find answer key section
  let answerKeyStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase().trim();
    if (/answer\s*key|answers|marking\s*scheme|answer\s*sheet/i.test(lower)) {
      answerKeyStart = i;
      break;
    }
  }
  
  if (answerKeyStart === -1) return { map: answerMap, endLine: answerKeyEndLine };
  
  // Parse the answer key lines
  for (let i = answerKeyStart + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Skip header lines in answer key (like "QAnsQAnsQAnsQAns")
    if (/^(q|no|question|answer)/i.test(line) && /[a-d]/i.test(line)) continue;
    // Skip lines that don't contain any digits (like decorative headers)
    if (!/\d/.test(line)) continue;
    
    // Format 1: Packed format like "1B11C21B31A" or "10A20C" - variable number of pairs
    // Extract all digit+letter pairs from the line
    const pairs = [];
    let remaining = line;
    const pairRegex = /(\d+)\s*([A-Da-d])\s*/g;
    let pairMatch;
    while ((pairMatch = pairRegex.exec(line)) !== null) {
      const num = pairMatch[1];
      const ans = pairMatch[2].toUpperCase();
      // Only add if the number is reasonable (1-999)
      if (parseInt(num) >= 1 && parseInt(num) <= 999) {
        answerMap[num] = ans;
      }
    }
    
    // If no pairs matched, try other formats for this line
    if (!pairs.length) {
      // Format 2: "Q1 B" or "1. B" or "1 B" or "1-B"
      const qaMatch = line.match(/^(?:Q|q)?\s*(\d+)\s*[.)\s\-]?\s*([A-Da-d])\s*$/);
      if (qaMatch) {
        answerMap[qaMatch[1]] = qaMatch[2].toUpperCase();
        continue;
      }
      
      // Format 3: Table format "1\tB" or "1,B"
      const tableMatch = line.match(/^(\d+)\s*[,;\t]\s*([A-Da-d])/);
      if (tableMatch) {
        answerMap[tableMatch[1]] = tableMatch[2].toUpperCase();
        continue;
      }
      
      // Format 4: Just a letter on its own (sequential)
      const justLetter = line.match(/^([A-Da-d])\s*$/);
      if (justLetter) {
        const nextNum = Object.keys(answerMap).length + 1;
        answerMap[nextNum.toString()] = justLetter[1].toUpperCase();
        continue;
      }
    }
  }
  
  // Find where answer key ends (next section or end)
  for (let i = answerKeyStart + 1; i < lines.length; i++) {
    if (/^section\s+/i.test(lines[i].trim())) {
      answerKeyEndLine = i;
      break;
    }
  }
  
  return { map: answerMap, endLine: answerKeyEndLine };
}

function getCurrentSection(sections, lineIndex) {
  for (const section of sections) {
    if (lineIndex >= section.startLine && lineIndex <= section.endLine) {
      return section;
    }
  }
  return null;
}

function estimateQuestionCount(lines, sections, type) {
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^\d+[.)\s]/.test(line)) {
      let hasOptions = false;
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        if (/^[A-D]\s*[)\].\s\-:]/.test(lines[j].trim())) {
          hasOptions = true;
          break;
        }
      }
      if ((type === 'mcq' && hasOptions) || (type === 'essay' && !hasOptions)) {
        count++;
      }
    }
  }
  return Math.max(count, 1);
}

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

function parseAggressive(lines, answerMap, result) {
  let i = 0;
  let questionNumber = 0;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    if (/^section\s+/i.test(line) || line.length < 10) {
      i++;
      continue;
    }
    
    const mcqResult = tryParseMCQ(lines, i);
    if (mcqResult) {
      questionNumber++;
      const answer = answerMap[questionNumber.toString()] || answerMap[mcqResult.number] || '';
      
      result.mcqQuestions.push({
        type: 'mcq',
        questionText: mcqResult.questionText,
        options: mcqResult.options,
        correctAnswer: answer || 'A',
        points: 1,
        markingScheme: '',
      });
      result.totalMcqMarks += 1;
      
      i = mcqResult.nextLineIndex;
      continue;
    }
    
    const essayResult = tryParseEssay(lines, i);
    if (essayResult) {
      questionNumber++;
      const points = 5;
      const markingScheme = generateMarkingScheme(essayResult, points);
      
      result.essayQuestions.push({
        type: 'essay',
        questionText: essayResult.questionText,
        options: [],
        correctAnswer: '',
        points: points,
        markingScheme: markingScheme,
      });
      result.totalEssayMarks += points;
      
      i = essayResult.nextLineIndex;
      continue;
    }
    
    i++;
  }
  
  return result;
}

export async function POST(request, { params }) {
  try {
    const decoded = await getAuthUser();
    if (!decoded || decoded.role !== 'teacher') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await dbConnect();

    const exam = await Exam.findOne({ _id: params.id, teacherId: decoded.id });
    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    const body = await request.json();
    const { text, examFormat } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Please provide text to parse' },
        { status: 400 }
      );
    }

    // Parse the text using the intelligent parser
    const parsed = parseQuestionText(text);

    const allQuestions = [...parsed.mcqQuestions, ...parsed.essayQuestions];

    if (allQuestions.length === 0) {
      // Fallback: create a single essay question from the raw text
      const fallbackQuestion = await Question.create({
        examId: params.id,
        type: 'essay',
        questionText: text.trim().substring(0, 2000),
        options: [],
        correctAnswer: '',
        markingScheme: `Marking Scheme (Total: 10 marks):\n\n` +
          `Expected Key Points:\n` +
          `- Award marks for each correct key point mentioned\n` +
          `- Credit well-structured and clearly explained answers\n\n` +
          `Marking Guidelines:\n` +
          `- Full marks (10 pts): Complete, accurate, well-explained answer\n` +
          `- 6-9 pts: Good answer with minor omissions\n` +
          `- 3-5 pts: Partial answer, some key points missing\n` +
          `- 1-2 pts: Attempt made but largely incorrect\n` +
          `- 0 pts: No attempt or completely off-topic\n`,
        points: 10,
      });

      return NextResponse.json({
        message: 'Created essay question from text (no structured questions detected)',
        questions: [{
          _id: fallbackQuestion._id.toString(),
          type: fallbackQuestion.type,
          questionText: fallbackQuestion.questionText,
          options: fallbackQuestion.options,
          correctAnswer: fallbackQuestion.correctAnswer,
          markingScheme: fallbackQuestion.markingScheme,
          points: fallbackQuestion.points,
        }],
        parseInfo: {
          detectedFormat: 'fallback',
          totalParsed: 1,
          mcqCount: 0,
          essayCount: 1,
          totalMcqMarks: 0,
          totalEssayMarks: 10,
        }
      }, { status: 201 });
    }

    // Save questions to database
    const createdQuestions = [];
    for (const q of allQuestions) {
      const question = await Question.create({
        examId: params.id,
        type: q.type,
        questionText: q.questionText,
        options: q.type === 'mcq' ? q.options : [],
        correctAnswer: q.type === 'mcq' ? q.correctAnswer : '',
        markingScheme: q.type === 'essay' ? q.markingScheme : '',
        points: q.points,
      });

      createdQuestions.push({
        _id: question._id.toString(),
        type: question.type,
        questionText: question.questionText,
        options: question.options,
        correctAnswer: question.correctAnswer,
        markingScheme: question.markingScheme,
        points: question.points,
      });
    }

    const mcqCount = parsed.mcqQuestions.length;
    const essayCount = parsed.essayQuestions.length;
    let summary = `Successfully imported ${createdQuestions.length} questions`;
    if (mcqCount > 0) summary += ` (${mcqCount} MCQ`;
    if (essayCount > 0) summary += `${mcqCount > 0 ? ', ' : ' ('}${essayCount} Essay`;
    if (mcqCount > 0 || essayCount > 0) summary += ')';

    return NextResponse.json({
      message: summary,
      questions: createdQuestions,
      parseInfo: {
        detectedFormat: parsed.detectedFormat,
        totalParsed: allQuestions.length,
        mcqCount,
        essayCount,
        totalMcqMarks: parsed.totalMcqMarks,
        totalEssayMarks: parsed.totalEssayMarks,
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Parse questions error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}