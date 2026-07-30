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
  // Match "Section A: Title (X Marks)" or "SECTION A: Title"
  const sectionMatch = line.match(/^section\s+([A-Z0-9]+)\s*[:.\-–]\s*(.*)/i);
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

  if (/mcq|multiple\s*choice|objective|choose|select/i.test(lower)) {
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

  // If section has marks but no type specified, default to mcq
  if (/\d+\s*marks?/i.test(lower)) {
    return 'mcq';
  }

  return 'unknown';
}

/**
 * Detect answer key lines and build answer map
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

    // Skip header lines
    if (/^(q|no|question|answer)/i.test(line) && /[a-d]/i.test(line)) continue;
    if (!/\d/.test(line)) continue;

    // Format 1: Packed format "1B2C3A" or "1B 2C 3A"
    const pairRegex = /(\d+)\s*([A-Da-d])\s*/g;
    let pairMatch;
    let hasPairs = false;
    while ((pairMatch = pairRegex.exec(line)) !== null) {
      const num = pairMatch[1];
      const ans = pairMatch[2].toUpperCase();
      if (parseInt(num) >= 1 && parseInt(num) <= 999) {
        answerMap[num] = ans;
        hasPairs = true;
      }
    }

    if (hasPairs) continue;

    // Format 2: "Q1 B" or "1. B" or "1 B"
    const qaMatch = line.match(/^(?:Q|q)?\s*(\d+)\s*[.)\s\-]?\s*([A-Da-d])\s*$/);
    if (qaMatch) {
      answerMap[qaMatch[1]] = qaMatch[2].toUpperCase();
      continue;
    }

    // Format 3: Table "1,B" or "1\tB"
    const tableMatch = line.match(/^(\d+)\s*[,;\t]\s*([A-Da-d])/);
    if (tableMatch) {
      answerMap[tableMatch[1]] = tableMatch[2].toUpperCase();
      continue;
    }

    // Format 4: Just a letter (sequential)
    const justLetter = line.match(/^([A-Da-d])\s*$/);
    if (justLetter) {
      const nextNum = Object.keys(answerMap).length + 1;
      answerMap[nextNum.toString()] = justLetter[1].toUpperCase();
      continue;
    }
  }

  // Find where answer key ends
  for (let i = answerKeyStart + 1; i < lines.length; i++) {
    if (/^section\s+/i.test(lines[i].trim())) {
      answerKeyEndLine = i;
      break;
    }
  }

  return { answerMap, endLine: answerKeyEndLine };
}