/**
 * Option Extractor Module
 * Extracts MCQ options from question text using multiple patterns.
 * Single responsibility: Extract answer options.
 */

/**
 * Extract options from question text
 * @param {string[]} lines - Lines of text
 * @param {number} startIndex - Starting line index
 * @returns {Object} { options, nextIndex }
 */
export function extractOptions(lines, startIndex) {
  const options = [];
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Match option patterns: A) text, B. text, C - text, D: text, (A) text
    const optionMatch = line.match(/^\(?([A-Da-d])\s*[)\].\s\-:]\s*(.+)/i);
    
    if (optionMatch) {
      const label = optionMatch[1].toUpperCase();
      const text = optionMatch[2].trim();
      
      // Validate option has content
      if (text.length > 0) {
        options.push({ label, text });
      }
      i++;
    } else if (line.length > 0 && !isOptionLine(line)) {
      // Not an option line and not empty - stop
      break;
    } else {
      i++;
    }
  }

  return { options, nextIndex: i };
}

/**
 * Check if a line looks like an option
 */
function isOptionLine(line) {
  if (!line || line.trim().length === 0) return false;
  
  // Empty option markers
  if (/^[A-Da-d]\s*[)\].\s\-:]\s*$/.test(line)) return true;
  
  // Check if it's continuation of previous option
  if (line.length > 0 && !/^[A-Da-d]\s*[)\].\s\-:]/.test(line)) {
    // Could be continuation - but we'll treat it as stop for now
    return false;
  }
  
  return false;
}

/**
 * Extract options from a single string block (for AI-parsed questions)
 * @param {string} text - Text containing options
 * @returns {Array} Array of {label, text}
 */
export function extractOptionsFromText(text) {
  const options = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  for (const line of lines) {
    const match = line.match(/^([A-Da-d])\s*[)\].\s\-:]\s*(.+)/i);
    if (match) {
      options.push({
        label: match[1].toUpperCase(),
        text: match[2].trim(),
      });
    }
  }

  return options;
}

/**
 * Merge split options (option text on multiple lines)
 * @param {string[]} lines - Lines of text
 * @param {number} startIndex - Starting index
 * @returns {Object} { mergedOptions, nextIndex }
 */
export function mergeSplitOptions(lines, startIndex) {
  const merged = [];
  let i = startIndex;
  let currentOption = null;

  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Check for new option marker
    const optionMatch = line.match(/^([A-Da-d])\s*[)\].\s\-:]\s*(.*)/i);
    
    if (optionMatch) {
      // Save previous option if exists
      if (currentOption) {
        merged.push(currentOption);
      }
      
      // Start new option
      currentOption = {
        label: optionMatch[1].toUpperCase(),
        text: optionMatch[2].trim(),
      };
    } else if (currentOption && line.length > 0) {
      // Continue previous option
      currentOption.text += ' ' + line;
    } else if (line.length === 0) {
      // Empty line - might end options
      if (currentOption) {
        merged.push(currentOption);
        currentOption = null;
      }
      i++;
      break;
    } else {
      // Not part of options
      break;
    }
    
    i++;
  }

  // Save last option
  if (currentOption) {
    merged.push(currentOption);
  }

  return { mergedOptions: merged, nextIndex: i };
}

/**
 * Validate extracted options
 * @param {Array} options - Array of options
 * @returns {Object} { valid, warnings }
 */
export function validateOptions(options) {
  const warnings = [];
  
  if (!options || options.length === 0) {
    return { valid: false, warnings: ['No options found'] };
  }

  if (options.length < 2) {
    warnings.push('Only 1 option found - MCQ questions need at least 2');
  }

  // Check for duplicate labels
  const labels = options.map(o => o.label);
  const uniqueLabels = new Set(labels);
  if (uniqueLabels.size !== labels.length) {
    warnings.push('Duplicate option labels detected');
  }

  // Check for empty option text
  const emptyOptions = options.filter(o => !o.text || o.text.trim().length === 0);
  if (emptyOptions.length > 0) {
    warnings.push(`${emptyOptions.length} option(s) have no text`);
  }

  // Check for duplicate text
  const texts = options.map(o => o.text.toLowerCase().trim());
  const uniqueTexts = new Set(texts);
  if (uniqueTexts.size !== texts.length) {
    warnings.push('Duplicate option text detected');
  }

  return {
    valid: options.length >= 2,
    warnings,
  };
}

/**
 * Normalize option labels (A, B, C, D, E)
 * @param {Array} options - Array of options
 * @returns {Array} Normalized options
 */
export function normalizeOptionLabels(options) {
  if (!options || options.length === 0) return [];
  
  const labels = ['A', 'B', 'C', 'D', 'E'];
  
  return options.map((opt, index) => ({
    label: labels[index] || String.fromCharCode(65 + index),
    text: opt.text || '',
  }));
}

/**
 * Recover split options from malformed text
 * @param {string} text - Malformed text
 * @returns {Array} Recovered options
 */
export function recoverSplitOptions(text) {
  const options = [];
  
  // Pattern 1: A) B) C) D) on same line separated by spaces
  const inlinePattern = /\b([A-Da-d])[)\]\s.\-:]\s*([^A-Da-d]{3,}?)(?=\s*[A-Da-d][)\]\s.\-:]|$)/g;
  let match;
  
  while ((match = inlinePattern.exec(text)) !== null) {
    options.push({
      label: match[1].toUpperCase(),
      text: match[2].trim(),
    });
  }

  // Pattern 2: Numbered options 1) 2) 3) 4)
  if (options.length === 0) {
    const numberedPattern = /\b(\d+)[)\]\s.\-:]\s*([^\d]{3,}?)(?=\s*\d+[)\]\s.\-:]|$)/g;
    while ((match = numberedPattern.exec(text)) !== null) {
      const label = String.fromCharCode(64 + parseInt(match[1])); // 1->A, 2->B, etc.
      options.push({
        label: Math.min(label, 'E'),
        text: match[2].trim(),
      });
    }
  }

  return options;
}