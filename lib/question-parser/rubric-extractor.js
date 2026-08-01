/**
 * Rubric Extractor Module
 * Extracts marking rubrics/schemes from question text.
 * Single responsibility: Extract marking rubrics.
 */

/**
 * Extract marking rubric from question text
 * @param {string[]} lines - Array of text lines
 * @param {number} startIndex - Starting line index
 * @param {number} endIndex - Ending line index
 * @returns {Object} { rubric, found }
 */
export function extractRubric(lines, startIndex, endIndex) {
  const rubricPatterns = [
    /^(marking\s*(?:scheme|rubric|guidelines?|criteria))/i,
    /^(rubric|scheme|guidelines?)\s*:/i,
    /^expected\s*(?:answers?|points?)/i,
    /^award\s*(?:marks?|points?)/i,
    /^scoring\s*(?:criteria|guide)/i,
  ];

  let rubricLines = [];
  let collecting = false;

  for (let i = startIndex; i <= endIndex && i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if this line starts a rubric
    if (!collecting && rubricPatterns.some(pattern => pattern.test(line))) {
      collecting = true;
      rubricLines.push(line);
      continue;
    }

    // If collecting, continue until we hit something that's not part of rubric
    if (collecting) {
      // Stop conditions
      if (/^(question|q)\s*\d/i.test(line) || /^(section|part)\s+[a-z]/i.test(line)) {
        break;
      }
      
      // Continue if line looks like rubric content
      if (line.length > 0 && (
        /^[-•*]\s/.test(line) ||
        /^\d+[.)]\s/.test(line) ||
        /^(full|partial|half|zero|no)\s*(marks?|points?)?/i.test(line) ||
        /^\d+\s*(?:marks?|points?|pts?)/i.test(line) ||
        collecting // Continue collecting if we've started
      )) {
        rubricLines.push(line);
      } else if (line.length === 0) {
        // Empty line - might still be part of rubric
        rubricLines.push(line);
      } else {
        // Non-rubric content - stop
        break;
      }
    }
  }

  if (rubricLines.length === 0) {
    return { rubric: '', found: false };
  }

  const rubric = rubricLines.join('\n').trim();
  return {
    rubric,
    found: rubric.length > 10,
  };
}

/**
 * Extract rubric from text block (for AI-parsed questions)
 * @param {string} text - Full question text
 * @returns {string} Extracted rubric
 */
export function extractRubricFromText(text) {
  const lines = text.split('\n');
  const result = extractRubric(lines, 0, lines.length - 1);
  return result.rubric;
}

/**
 * Generate a default rubric for essay questions
 * @param {string} questionText - Question text
 * @param {number} totalPoints - Total points for this question
 * @returns {string} Generated rubric
 */
export function generateDefaultRubric(questionText, totalPoints) {
  if (totalPoints <= 0) {
    totalPoints = 10;
  }

  const fullMarks = totalPoints;
  const partialMarks = Math.ceil(totalPoints * 0.6);
  const halfMarks = Math.ceil(totalPoints * 0.3);
  const lowMarks = Math.max(1, Math.ceil(totalPoints * 0.2));

  return `Marking Scheme (Total: ${totalPoints} marks):

Expected Key Points:
- Award marks for each correct key point mentioned
- Credit well-structured and clearly explained answers
- Look for understanding of core concepts

Marking Guidelines:
- Full marks (${fullMarks} pts): Complete, accurate, well-explained answer with all key points
- ${partialMarks}-${fullMarks - 1} pts: Good answer with most key points, minor omissions
- ${halfMarks}-${partialMarks - 1} pts: Partial answer, some key points missing
- ${lowMarks}-${halfMarks - 1} pts: Attempt made but largely incorrect or incomplete
- 0 pts: No attempt or completely off-topic

Question: ${questionText.substring(0, 100)}${questionText.length > 100 ? '...' : ''}`;
}

/**
 * Parse rubric into structured format
 * @param {string} rubricText - Raw rubric text
 * @returns {Object} Structured rubric
 */
export function parseRubric(rubricText) {
  const result = {
    totalPoints: 0,
    criteria: [],
    raw: rubricText,
  };

  if (!rubricText || rubricText.trim().length === 0) {
    return result;
  }

  const lines = rubricText.split('\n').filter(l => l.trim());
  
  // Extract total points
  const totalMatch = rubricText.match(/total[:\s]+(\d+)\s*(?:marks?|points?|pts?)/i);
  if (totalMatch) {
    result.totalPoints = parseInt(totalMatch[1]);
  }

  // Extract criteria (lines with bullet points or numbered items)
  for (const line of lines) {
    const trimmed = line.trim();
    const criteriaMatch = trimmed.match(/^[-•*]\s*(.+?)[:\s]+(\d+)\s*(?:marks?|points?|pts?)?/i);
    
    if (criteriaMatch) {
      result.criteria.push({
        description: criteriaMatch[1].trim(),
        points: criteriaMatch[2] ? parseInt(criteriaMatch[2]) : 0,
      });
    } else if (/^\d+[.)]\s/.test(trimmed)) {
      const numMatch = trimmed.match(/^\d+[.)]\s*(.+)/);
      if (numMatch) {
        result.criteria.push({
          description: numMatch[1].trim(),
          points: 0,
        });
      }
    }
  }

  return result;
}

/**
 * Validate rubric
 * @param {string} rubric - Rubric text
 * @param {number} expectedPoints - Expected total points
 * @returns {Object} { valid, warnings }
 */
export function validateRubric(rubric, expectedPoints = 0) {
  const warnings = [];

  if (!rubric || rubric.trim().length === 0) {
    return {
      valid: false,
      warnings: ['No marking rubric provided'],
    };
  }

  if (rubric.trim().length < 10) {
    warnings.push('Rubric is very short - may not provide adequate guidance');
  }

  // Check if rubric mentions total points
  if (!/total[:\s]+\d+|total\s*\n?\s*\d+|^\s*\d+\s*(?:marks?|points?|pts?)/im.test(rubric)) {
    warnings.push('Rubric does not clearly state total marks');
  }

  // Check if rubric has criteria
  const criteriaCount = (rubric.match(/^[-•*]/gm) || []).length;
  if (criteriaCount === 0) {
    warnings.push('Rubric should include marking criteria');
  }

  return {
    valid: rubric.trim().length >= 10,
    warnings,
  };
}

/**
 * Merge duplicate rubric entries
 * @param {string[]} rubrics - Array of rubric texts
 * @returns {string} Merged rubric
 */
export function mergeRubrics(rubrics) {
  if (!rubrics || rubrics.length === 0) {
    return '';
  }

  if (rubrics.length === 1) {
    return rubrics[0];
  }

  // Merge rubrics, removing duplicates
  const lines = new Set();
  const headerAdded = new Set();

  for (const rubric of rubrics) {
    const rubricLines = rubric.split('\n');
    
    for (const line of rubricLines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;

      // Skip duplicate headers
      if (/^(marking|rubric|scheme|guidelines?)/i.test(trimmed)) {
        if (!headerAdded.has(trimmed.toLowerCase())) {
          lines.add(trimmed);
          headerAdded.add(trimmed.toLowerCase());
        }
        continue;
      }

      lines.add(trimmed);
    }
  }

  return Array.from(lines).join('\n');
}

/**
 * Detect rubric in text
 * @param {string} text - Text to search
 * @returns {boolean} True if rubric detected
 */
export function hasRubric(text) {
  if (!text) return false;

  const rubricIndicators = [
    /marking\s*(?:scheme|rubric|guidelines?)/i,
    /scoring\s*(?:criteria|guide)/i,
    /expected\s*(?:answers?|key\s*points?)/i,
    /award\s*(?:marks?|points?)/i,
    /^(?:full|partial|zero)\s*(?:marks?|points?)?\s*[:–-]/im,
  ];

  return rubricIndicators.some(pattern => pattern.test(text));
}