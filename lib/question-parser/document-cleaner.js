/**
 * Stage 0: Document Cleaner
 * Handles severe formatting issues from PDFs, Word docs, OCR, WhatsApp, emails, etc.
 * Single responsibility: Clean raw input before any parsing.
 */

/**
 * Clean raw document text for parsing
 * @param {string} text - Raw text from any source
 * @returns {Object} { cleanedText, warnings }
 */
export function cleanDocument(text) {
  const warnings = [];
  
  if (!text || !text.trim()) {
    return { cleanedText: '', warnings: ['Empty text provided'] };
  }

  let cleaned = text;

  // Detect and warn about common issues
  if (cleaned.includes('\r\n')) {
    warnings.push('Windows line endings detected and normalized');
  }

  // Count and warn about very long lines (possible OCR or table data)
  const lines = cleaned.split('\n');
  const longLines = lines.filter(l => l.length > 200).length;
  if (longLines > 0) {
    warnings.push(`${longLines} very long line(s) detected - possible OCR artifacts or table data`);
  }

  // Step 1: Normalize all line endings
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Step 2: Remove null bytes and other control characters (except newlines)
  cleaned = cleaned.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');

  // Step 3: Fix common PDF extraction artifacts
  cleaned = fixPDFArtifacts(cleaned);

  // Step 4: Fix common Word document artifacts
  cleaned = fixWordArtifacts(cleaned);

  // Step 5: Fix common OCR artifacts
  cleaned = fixOCRArtifacts(cleaned);

  // Step 6: Fix WhatsApp/email artifacts
  cleaned = fixMessagingArtifacts(cleaned);

  // Step 7: Remove page numbers and headers/footers
  cleaned = removePageArtifacts(cleaned);

  // Step 8: Normalize whitespace within lines (preserve newlines)
  cleaned = cleaned.split('\n').map(line => line.replace(/\s+/g, ' ').trim()).join('\n');

  // Step 9: Remove excessive consecutive newlines (more than 2)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Step 10: Final trim
  cleaned = cleaned.trim();

  return { cleanedText: cleaned, warnings };
}

/**
 * Fix PDF-specific extraction artifacts
 */
function fixPDFArtifacts(text) {
  let fixed = text;

  // Remove hyphenation at line breaks (word-\nword -> wordword)
  fixed = fixed.replace(/([a-zA-Z])-\n([a-zA-Z])/g, '$1$2');

  // Remove "Page X" patterns
  fixed = fixed.replace(/Page\s+\d+\s+of\s+\d+/gi, '');
  fixed = fixed.replace(/-\s*\d+\s*-/g, '');

  // Remove form feed characters
  fixed = fixed.replace(/\f/g, '\n');

  // Fix common PDF extraction issues with special characters
  fixed = fixed.replace(/â/g, 'â');
  fixed = fixed.replace(/ë/g, 'ë');
  fixed = fixed.replace(/ï/g, 'ï');
  fixed = fixed.replace(/ü/g, 'ü');

  return fixed;
}

/**
 * Fix Word document artifacts
 */
function fixWordArtifacts(text) {
  let fixed = text;

  // Remove track changes marks
  fixed = fixed.replace(/\[.*?\]/g, ''); // Remove [text] markers

  // Remove comments
  fixed = fixed.replace(/\{.*?\}/g, '');

  // Fix smart quotes to regular quotes
  fixed = fixed.replace(/[""]/g, '"').replace(/['']/g, "'");

  // Remove field codes
  fixed = fixed.replace(/\{=[^}]+\}/g, '');

  return fixed;
}

/**
 * Fix OCR-specific artifacts
 */
function fixOCRArtifacts(text) {
  let fixed = text;

  // Fix common OCR mistakes in letters/numbers
  fixed = fixed.replace(/\b0([A-Za-z])\b/g, 'O$1'); // 0A -> OA
  fixed = fixed.replace(/\b([A-Za-z])0\b/g, '$1O'); // A0 -> AO
  fixed = fixed.replace(/\bl\b/g, '1'); // l -> 1 (in numbers)
  fixed = fixed.replace(/\bI\b/g, '1'); // I -> 1 (in numbers)

  // Fix broken option markers from OCR
  fixed = fixed.replace(/([A-D])\s*\.\s*/g, '$1) '); // A. -> A)
  fixed = fixed.replace(/([A-D])\s*\-\s*/g, '$1) '); // A- -> A)

  // Fix common OCR letter confusion
  fixed = fixed.replace(/\bQ\s*(\d)/g, 'Q$1'); // Q 1 -> Q1

  return fixed;
}

/**
 * Fix WhatsApp, email, and messaging artifacts
 */
function fixMessagingArtifacts(text) {
  let fixed = text;

  // Remove forwarded message headers
  fixed = fixed.replace(/^Forwarded message$/gim, '');
  fixed = fixed.replace(/^>\s*/gm, ''); // Remove quote markers

  // Remove email signatures
  fixed = fixed.replace(/^--+\s*$/gm, '\n');
  fixed = fixed.replace(/^Sent from my.*$/gim, '');

  // Remove WhatsApp-specific patterns
  fixed = fixed.replace(/\[.*?\]/g, ''); // Remove [timestamp] etc.

  return fixed;
}

/**
 * Remove page numbers, headers, footers
 */
function removePageArtifacts(text) {
  let fixed = text;

  const lines = fixed.split('\n');
  const cleanedLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip obvious page numbers
    if (/^\d+$/.test(line) && parseInt(line) > 0 && parseInt(line) < 1000) {
      continue;
    }

    // Skip common header/footer patterns
    if (/^(Page|Página|Seite|Page)\s+\d+/i.test(line)) {
      continue;
    }

    // Skip lines that are just dashes or equals (separators)
    if (/^[-=_]{3,}$/.test(line)) {
      continue;
    }

    cleanedLines.push(lines[i]);
  }

  return cleanedLines.join('\n');
}

/**
 * Detect document quality issues
 * @param {string} text - Text to analyze
 * @returns {Object} { score, issues }
 */
export function assessDocumentQuality(text) {
  const issues = [];
  let score = 100;

  if (!text || text.trim().length === 0) {
    return { score: 0, issues: ['Empty document'] };
  }

  const lines = text.split('\n');

  // Check for very short lines (possible OCR errors)
  const shortLines = lines.filter(l => l.trim().length > 0 && l.trim().length < 3).length;
  if (shortLines > lines.length * 0.3) {
    issues.push('Many very short lines detected - possible OCR errors');
    score -= 20;
  }

  // Check for garbled characters
  const garbledMatches = text.match(/[^\x00-\x7f]/g);
  if (garbledMatches && garbledMatches.length > text.length * 0.1) {
    issues.push('High non-ASCII character count - possible encoding issues');
    score -= 15;
  }

  // Check for consistent line structure
  const hasStructure = /^\d+[.)]\s/.test(text) || /^[A-D][)\]\s.]\s/.test(text);
  if (!hasStructure) {
    issues.push('No clear question or option structure detected');
    score -= 10;
  }

  // Check for reasonable length
  if (text.trim().length < 50) {
    issues.push('Text is very short - may not contain complete questions');
    score -= 20;
  }

  return { score: Math.max(0, score), issues };
}