/**
 * Stage 2: Section Detector
 * Identifies sections in the normalized text (Section A, B, Answer Key, etc.)
 */

/**
 * Detected section structure
 * @typedef {Object} Section
 * @property {string} name - Section name (e.g., "Multiple Choice Questions", "Answer Key")
 * @property {string} type - 'mcq', 'essay', 'answer_key', 'unknown'
 * @property {number} startLine - Starting line index (inclusive)
 * @property {number} endLine - Ending line index (inclusive)
 * @property {number} totalMarks - Total marks for this section (0 if not specified)
 */

/**
 * Detect sections in normalized text lines
 * @param {string[]} lines - Array of text lines
 * @returns {Section[]} Detected sections
 */
export function detectSections(lines) {
  const sections = [];
  let currentSection = {
    name: 'main',
    type: 'unknown',
    startLine: 0,
    endLine: lines.length - 1,
    totalMarks: 0,
  };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const sectionInfo = parseSectionHeader(line);

      if (sectionInfo) {
        // Save previous section
        if (currentSection.startLine < i) {
          currentSection.endLine = i - 1;
          sections.push(currentSection);
        }

        currentSection = {
          name: sectionInfo.name,
          type: sectionInfo.type,
          startLine: i + 1,
          endLine: lines.length - 1,
          totalMarks: sectionInfo.totalMarks,
        };
      }
    }

  // Save last section
  sections.push(currentSection);

  return sections;
}

/**
 * Parse a line to see if it's a section header
 * @param {string} line - A line of text
 * @returns {Object|null} Section info or null if not a section header
 */
function parseSectionHeader(line) {
  const trimmed = line.trim();
  
  // Match "SECTION A: OBJECTIVE TEST (30 MARKS)" or "Section A - Title" or "Part B: Title"
  const sectionMatch = trimmed.match(/^section\s+([A-Z0-9]+)\s*[:\-–]?\s*(.*)/i);
  
  if (sectionMatch) {
    const title = sectionMatch[2].trim();
    const marksMatch = title.match(/\(?\s*(\d+)\s*marks?\s*\)?/i);
    const totalMarks = marksMatch ? parseInt(marksMatch[1]) : 0;
    const type = detectSectionType(title);

    return {
      name: title,
      type: type,
      totalMarks: totalMarks,
    };
  }
  
  // Match "SECTION A" standalone (no title after)
  const simpleSection = trimmed.match(/^section\s+([A-Z0-9]+)\s*$/i);
  if (simpleSection) {
    return {
      name: `Section ${simpleSection[1]}`,
      type: 'unknown',
      totalMarks: 0,
    };
  }

  // Match "Answer Key" or "Answers" or "Marking Scheme"
  if (/^answer\s*(key|s)?\s*:?/i.test(line) || /^marking\s*scheme/i.test(line)) {
    return {
      name: line.trim(),
      type: 'answer_key',
      totalMarks: 0,
    };
  }

  // Match "Part X: Title"
  const partMatch = line.match(/^part\s+([A-Z0-9]+)\s*[:.\-–]\s*(.*)/i);
  if (partMatch) {
    const title = partMatch[2].trim();
    const marksMatch = title.match(/\(?\s*(\d+)\s*marks?\s*\)?/i);
    return {
      name: title,
      type: detectSectionType(title),
      totalMarks: marksMatch ? parseInt(marksMatch[1]) : 0,
    };
  }

  return null;
}

/**
 * Detect the type of section based on its title
 * @param {string} title - Section title
 * @returns {string} 'mcq', 'essay', 'answer_key', or 'unknown'
 */
function detectSectionType(title) {
  const lower = title.toLowerCase();

  if (/mcq|multiple\s*choice|objective/i.test(lower)) {
    return 'mcq';
  }
  if (/essay|theory|written|subjective|structured/i.test(lower)) {
    return 'essay';
  }
  if (/true\s*\/?\s*false|boolean/i.test(lower)) {
    return 'true_false';
  }
  if (/fill\s*in\s*(the\s*)?blank|completion/i.test(lower)) {
    return 'fill_blank';
  }
  if (/matching|match/i.test(lower)) {
    return 'matching';
  }

  // If section has marks, it's likely a question section (mcq or essay)
  if (/\d+\s*marks?/i.test(lower)) {
    return 'mcq';
  }

  return 'unknown';
}

/**
 * Detect answer key lines and build answer map with robust multi-format support
 * @param {string[]} lines - Array of text lines
 * @param {number} startLine - Line index to start searching from
 * @returns {Object} { answerMap: {questionNumber: answerLetter}, endLine: number }
 */
export function extractAnswerKey(lines, startLine = 0) {
  const answerMap = {};
  let answerKeyEndLine = lines.length;

  // Find answer key section
  let answerKeyStart = -1;
  for (let i = startLine; i < lines.length; i++) {
    const lower = lines[i].toLowerCase().trim();
    if (/answer\s*key|answers|marking\s*scheme/i.test(lower)) {
      answerKeyStart = i;
      break;
    }
  }

  if (answerKeyStart === -1) return { answerMap, endLine: answerKeyEndLine };

  // Parse answer key lines
  for (let i = answerKeyStart + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check if we hit the next section header
    if (/^section\s+/i.test(line)) {
      answerKeyEndLine = i;
      break;
    }

    // Pattern A: Colon mapping like "1: A" or "Q1: B"
    const colonMatches = [...line.matchAll(/(?:q)?(\d+)\s*[:\-]\s*([A-Da-d])/gi)];
    if (colonMatches.length > 0) {
      for (const match of colonMatches) {
        answerMap[match[1]] = match[2].toUpperCase();
      }
      continue;
    }

    // Pattern B: Packed format "1B 2C" or "1B2C3A"
    const pairRegex = /(\d+)\s*([A-Da-d])/g;
    let pairMatch;
    let hasPairs = false;
    while ((pairMatch = pairRegex.exec(line)) !== null) {
      answerMap[pairMatch[1]] = pairMatch[2].toUpperCase();
      hasPairs = true;
    }
    if (hasPairs) continue;

    // Pattern C: Comma separated tokens "1, B" or "1,B, 2, C"
    const commaTokens = line.split(/[,;]/);
    if (commaTokens.length >= 2) {
      for (let token of commaTokens) {
        const tokenMatch = token.trim().match(/(\d+)\s*([A-Da-d])/);
        if (tokenMatch) {
          answerMap[tokenMatch[1]] = tokenMatch[2].toUpperCase();
        }
      }
    }
  }

  return { answerMap, endLine: answerKeyEndLine };
}