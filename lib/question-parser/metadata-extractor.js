/**
 * Stage 1: Metadata Extractor
 * Extracts exam metadata (title, subject, class, duration, instructions) from text.
 * Single responsibility: Extract document-level metadata.
 */

/**
 * Extract exam metadata from text
 * @param {string} text - Cleaned text
 * @returns {Object} { title, subject, className, duration, instructions }
 */
export function extractMetadata(text) {
  const result = {
    title: '',
    subject: '',
    className: '',
    duration: 0,
    instructions: [],
  };

  if (!text || !text.trim()) {
    return result;
  }

  const lines = text.split('\n').filter(l => l.trim());
  
  // Extract title (usually first line or marked with "Title:")
  result.title = extractTitle(lines);
  
  // Extract subject
  result.subject = extractSubject(text);
  
  // Extract class/grade
  result.className = extractClass(text);
  
  // Extract duration
  result.duration = extractDuration(text);
  
  // Extract instructions
  result.instructions = extractInstructions(lines);

  return result;
}

/**
 * Extract exam title
 */
function extractTitle(lines) {
  // Look for explicit title markers
  for (const line of lines.slice(0, 10)) {
    const trimmed = line.trim();
    const titleMatch = trimmed.match(/^(title|exam\s*title|subject)\s*[:.]\s*(.+)/i);
    if (titleMatch) {
      return titleMatch[2].trim();
    }
  }

  // First non-empty line is often the title
  if (lines.length > 0 && lines[0].trim().length > 3) {
    const first = lines[0].trim();
    // Skip if it looks like a section header or instruction
    if (!/^(section|part|question|answer|instructions?|time|duration|marks?)/i.test(first)) {
      return first;
    }
  }

  // Look for all-caps title
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    if (/^[A-Z\s]{5,}$/.test(trimmed) && trimmed.length < 100) {
      return trimmed;
    }
  }

  return '';
}

/**
 * Extract subject
 */
function extractSubject(text) {
  const subjectPatterns = [
    /(?:subject|course|topic)\s*[:.]\s*([^\n]+)/i,
    /(?:subject|course)\s*:\s*([^\n]+)/i,
  ];

  for (const pattern of subjectPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  // Common subjects
  const subjects = [
    'Mathematics', 'English', 'Science', 'Physics', 'Chemistry', 'Biology',
    'History', 'Geography', 'Economics', 'Commerce', 'Accounting',
    'Literature', 'Government', 'Civic', 'Computer', 'ICT', 'Art',
    'Music', 'French', 'Spanish', 'Religious Studies', 'RME'
  ];

  for (const subject of subjects) {
    if (text.toLowerCase().includes(subject.toLowerCase())) {
      return subject;
    }
  }

  return '';
}

/**
 * Extract class/grade
 */
function extractClass(text) {
  const classPatterns = [
    /(?:class|grade|year)\s*[:.]?\s*([A-Z0-9\s]+?)(?:\n|$)/i,
    /(?:form|level)\s*[:.]?\s*([A-Z0-9\s]+?)(?:\n|$)/i,
  ];

  for (const pattern of classPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  // Pattern like "SS 2", "JHS 3", "Grade 10"
  const gradeMatch = text.match(/\b(SS|JHS|Grade|Form|Year)\s*(\d+)\b/i);
  if (gradeMatch) {
    return gradeMatch[0];
  }

  return '';
}

/**
 * Extract duration in minutes
 */
function extractDuration(text) {
  // Pattern: "Duration: 60 minutes" or "Time: 1 hour"
  const durationPatterns = [
    /(?:duration|time\s*allowed|time)\s*[:.]?\s*(\d+)\s*(?:minutes?|mins?|hours?|hrs?)/i,
    /(\d+)\s*(?:minutes?|mins?|hours?|hrs?)\s*(?:duration|time)/i,
  ];

  for (const pattern of durationPatterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseInt(match[1]);
      // Convert hours to minutes
      if (/hour|hr/i.test(match[0])) {
        return value * 60;
      }
      return value;
    }
  }

  // Look for standalone duration numbers (1-480)
  const durationMatch = text.match(/(?:duration|time)\s*[:.]?\s*(\d+)/i);
  if (durationMatch) {
    return parseInt(durationMatch[1]);
  }

  return 0;
}

/**
 * Extract instructions
 */
function extractInstructions(lines) {
  const instructions = [];
  const instructionMarkers = [
    /^(instructions?|note|general\s*instructions?|directions?)\s*[:.]?/i,
    /^read\s+the\s+following/i,
    /^answer\s+(all|the\s+following|questions?)/i,
  ];

  let inInstructionBlock = false;
  let instructionText = '';

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Check if this line starts instructions
    if (instructionMarkers.some(pattern => pattern.test(trimmed))) {
      inInstructionBlock = true;
      instructionText = trimmed;
      continue;
    }

    // If in instruction block, collect lines
    if (inInstructionBlock) {
      // Stop at section headers or first question
      if (/^(section|part|question\s+\d)/i.test(trimmed) || /^\d+[.)]\s/.test(trimmed)) {
        if (instructionText.trim()) {
          instructions.push(instructionText.trim());
        }
        inInstructionBlock = false;
        instructionText = '';
        continue;
      }
      
      // Continue collecting instruction text
      if (trimmed.length > 0) {
        instructionText += ' ' + trimmed;
      }
    }
  }

  // Add last instruction block if exists
  if (instructionText.trim()) {
    instructions.push(instructionText.trim());
  }

  return instructions.slice(0, 10); // Limit to 10 instruction blocks
}

/**
 * Detect if text has clear metadata structure
 */
export function hasMetadataStructure(text) {
  const metadataPatterns = [
    /(?:title|subject|duration|time|class|grade)/i,
    /(?:section|part)\s+[A-Z]/i,
    /(?:instructions?|directions?)/i,
  ];

  const matchCount = metadataPatterns.filter(pattern => pattern.test(text)).length;
  return matchCount >= 2;
}