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

  // Match "Answer Key" or "Answers" or "Marking Scheme" (must be a standalone header)
  if (/^(answer\s*key|answers?)\s*:?\s*$/i.test(line) || /^marking\s*scheme\s*:?\s*$/i.test(line)) {
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

// Note: extractAnswerKey is defined in answer-extractor.js and imported by index.js
// This file (section-detector.js) only handles section detection.
