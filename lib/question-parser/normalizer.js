/**
 * Stage 1: Text Normalizer
 * Cleans pasted text, restores line breaks, removes excess whitespace.
 * Ensures consistent formatting before parsing.
 */

/**
 * Normalize pasted text for consistent parsing.
 * Handles:
 * - Restoring line breaks around "A)", "B)", "Question 1", "Section A", etc.
 * - Removing excess whitespace
 * - Fixing common formatting issues
 */
export function normalizeText(text) {
  if (!text || !text.trim()) return '';

  let normalized = text;

  // Step 1: Replace tabs with spaces
  normalized = normalized.replace(/\t/g, ' ');

  // Step 2: Fix line breaks that got merged (no space before option markers)
  // e.g., "What is 2+2?A) 3" -> "What is 2+2?\nA) 3"
  normalized = normalized.replace(/([.!?])\s*([A-Da-d])\s*[)\].\s\-:]/g, (match, p1, p2) => {
    return `${p1}\n${p2})`;
  });

  // Step 3: Ensure line breaks before numbered questions
  // e.g., "text1. What" -> "text\n1. What" (if not already on its own line)
  normalized = normalized.replace(/([^\n])(\d+\s*[.)]\s+[A-Z])/g, '$1\n$2');

  // Step 4: Ensure line breaks before "Question N" headers
  normalized = normalized.replace(/([^\n])(Question\s+\d)/gi, '$1\n$2');

  // Step 5: Ensure line breaks before "Section" headers
  normalized = normalized.replace(/([^\n])(Section\s+[A-Z0-9])/gi, '$1\n$2');

  // Step 6: Ensure line breaks before "Answer Key" or "Answers"
  normalized = normalized.replace(/([^\n])(Answer\s*(Key|s)?\s*:?)/gi, '$1\n$2');

  // Step 7: Remove empty lines (but keep single newlines)
  normalized = normalized.split('\n').map(line => line.trim()).filter(line => line).join('\n');

  // Step 8: Remove excess spaces within lines
  normalized = normalized.replace(/[ \t]+/g, ' ');

  // Step 9: Fix spacing around punctuation
  normalized = normalized.replace(/\s*([.,;:!?)])\s*/g, '$1 ');
  normalized = normalized.replace(/\s+/g, ' ');

  // Step 10: Restore line breaks (we collapsed them in step 9)
  // Re-detect section/question/option markers and add line breaks
  const lines = normalized.split(/(?=Section\s+[A-Z0-9]|Question\s+\d|^\d+\s*[.)]\s|Answer\s*(Key|s)?\s*:?)/gim);
  normalized = lines.filter(l => l.trim()).join('\n');

  // Step 11: Ensure option markers are on their own lines
  // Match A) B) C) D) that might be on same line as question
  normalized = normalized.replace(/([^\n])(\s*[A-Da-d]\s*[)\].\s\-:]\s+)/g, '$1\n$2');

  // Step 12: Final cleanup - remove leading/trailing whitespace from each line
  normalized = normalized.split('\n').map(line => line.trim()).join('\n');

  return normalized.trim();
}

/**
 * Detect if text appears to be a table format (TSV, CSV, etc.)
 */
export function detectTableFormat(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return false;

  const checkLines = lines.slice(0, Math.min(10, lines.length));
  let tabCount = 0;
  let commaCount = 0;

  for (const line of checkLines) {
    if (line.includes('\t')) tabCount++;
    if (line.includes(',')) commaCount++;
  }

  // If more than 40% of lines have tabs, it's a table
  if (tabCount > checkLines.length * 0.4) return true;
  
  // If almost all lines have commas and they look like data rows
  if (commaCount > checkLines.length * 0.7) {
    // Check if first line looks like a header
    const firstLine = checkLines[0].toLowerCase();
    if (/no|question|answer|option/.test(firstLine)) return true;
  }

  return false;
}

/**
 * Add line numbers to text for reference
 */
export function addLineNumbers(text) {
  const lines = text.split('\n');
  return lines.map((line, i) => `${i + 1}: ${line}`).join('\n');
}