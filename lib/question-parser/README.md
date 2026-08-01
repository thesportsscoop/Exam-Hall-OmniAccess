# Modular Question Parser Pipeline

## Overview

This is a robust, multi-stage question parsing system designed to handle examination papers from various sources including PDFs, Word documents, OCR software, WhatsApp, emails, websites, and AI tools. The parser uses a staged pipeline approach with independent, single-responsibility modules.

## Architecture

### Pipeline Stages

```
Raw Text → Document Cleaner → Metadata Extractor → Section Detector → 
Question Boundary Detector → Question Classifier → Option/Rubric/Answer Extraction → 
Question Validator → Question Normalizer → Exam Assembler → Structured Output
```

### Modules

#### Stage 0: Document Cleaning
- **Module**: `document-cleaner.js`
- **Purpose**: Handles severe formatting issues from various sources
- **Features**:
  - Normalizes line endings (Windows, Unix, Mac)
  - Removes PDF extraction artifacts (hyphenation, page numbers)
  - Fixes Word document artifacts (smart quotes, track changes)
  - Repairs OCR errors (letter/number confusion)
  - Removes WhatsApp/email artifacts (forwarded headers, signatures)
  - Assesses document quality

#### Stage 1: Metadata Extraction
- **Module**: `metadata-extractor.js`
- **Purpose**: Extracts exam-level metadata
- **Extracts**:
  - Exam title
  - Subject/course
  - Class/grade
  - Duration
  - Instructions

#### Stage 2: Question Boundary Detection
- **Module**: `question-boundary-detector.js`
- **Purpose**: Identifies where questions begin and end
- **Strategies**:
  - Numbering patterns (1., 2), Q1, Question 1)
  - Marker patterns (***, ===)
  - Content analysis (question words, question marks)
- **Features**:
  - Merges overlapping boundaries
  - Validates boundaries
  - Handles missing numbering

#### Stage 3: Question Classification
- **Module**: `question-classifier.js`
- **Purpose**: Automatically classifies question types
- **Supported Types**:
  - MCQ (Multiple Choice)
  - Essay
  - True/False
  - Fill in the Blank
  - Matching
  - Calculation
  - Practical
  - Diagram
  - Short Answer
- **Signals Used**:
  - Option patterns (A, B, C, D)
  - Marking scheme presence
  - Question verbs/keywords
  - Question length
  - Special keywords (diagram, calculate, etc.)

#### Stage 4: Component Extraction
Multiple specialized extractors:

- **Option Extractor** (`option-extractor.js`): Extracts MCQ options, merges split options
- **Mark Extractor** (`mark-extractor.js`): Extracts marks/points, distributes totals
- **Rubric Extractor** (`rubric-extractor.js`): Extracts marking schemes, generates defaults
- **Answer Extractor** (`answer-extractor.js`): Extracts answer keys, infers correct answers

#### Stage 5: Validation & Normalization
- **Validator** (`question-validator.js`): Validates question completeness and correctness
- **Normalizer** (`question-normalizer.js`): Normalizes question data, repairs OCR errors

#### Stage 6: Exam Assembly
- **Module**: `exam-assembler.js`
- **Purpose**: Assembles final exam structure
- **Features**:
  - Combines all parsed components
  - Calculates totals and statistics
  - Generates confidence scores
  - Creates intermediate structured object
  - Validates assembled exam

## Usage

### Basic Usage

```javascript
import { parseQuestions } from '@/lib/question-parser/index.js';

const result = await parseQuestions(rawText);

console.log(result.questions);      // Array of parsed questions
console.log(result.summary);        // Human-readable summary
console.log(result.validation);     // Validation results
console.log(result.metadata);       // Extracted metadata
```

### Advanced Usage (Pipeline Control)

```javascript
import { 
  cleanDocument,
  extractMetadata,
  detectQuestionBoundaries,
  classifyQuestion,
  // ... other modules
} from '@/lib/question-parser';

// Stage 0: Clean
const { cleanedText, warnings } = cleanDocument(rawText);

// Stage 1: Extract metadata
const metadata = extractMetadata(cleanedText);

// Stage 2: Detect boundaries
const boundaries = detectQuestionBoundaries(lines, sectionType);

// Stage 3: Classify
const questionType = classifyQuestion({
  text: questionText,
  options: options,
  hasMarkingScheme: true
});
```

## Question Format

### Input Format (Raw Text)
```
1. What is the capital of France?
A) London
B) Paris
C) Berlin
D) Madrid

2. Explain photosynthesis.
(10 marks)
Marking Scheme:
- Definition: 3 marks
- Process: 5 marks
- Example: 2 marks
```

### Output Format (Structured)
```javascript
{
  type: 'mcq',
  questionText: 'What is the capital of France?',
  options: [
    { label: 'A', text: 'London' },
    { label: 'B', text: 'Paris' },
    { label: 'C', text: 'Berlin' },
    { label: 'D', text: 'Madrid' }
  ],
  correctAnswer: 'B',
  markingScheme: '',
  points: 1,
  confidence: 85,
  warnings: [],
  errors: []
}
```

## Supported Question Types

| Type | Description | Key Indicators |
|------|-------------|----------------|
| MCQ | Multiple choice | Options A/B/C/D, short question |
| Essay | Long-form answer | Marking scheme, long text |
| True/False | Boolean statements | "true/false" keywords |
| Fill Blank | Complete the sentence | "____" or "..." patterns |
| Matching | Match items | "match" keywords + options |
| Calculation | Math problems | "calculate", "compute", numbers |
| Practical | Lab/experiment | "practical", "experiment" |
| Diagram | Drawing/labeling | "diagram", "draw", "label" |
| Short Answer | Brief response | Short question, no options |

## Error Handling

The parser is designed to be resilient:
- Never crashes on malformed input
- Parses all recoverable questions
- Flags problematic questions with warnings
- Allows manual correction in preview stage
- Falls back to simpler parsers if needed

## Performance

- Modular design allows parallel processing
- Each module is independently testable
- Functions are kept under 100 lines
- No duplicated logic
- Efficient regex patterns

## Integration

### API Route
```
POST /api/teacher/exams/placeholder/questions/parse
```

### Request Body
```json
{
  "text": "Raw exam text here..."
}
```

### Response
```json
{
  "success": true,
  "metadata": { ... },
  "questions": [ ... ],
  "sections": [ ... ],
  "summary": "...",
  "validation": { ... },
  "warnings": [ ... ],
  "errors": [ ... ]
}
```

## Testing

Each module can be tested independently:

```javascript
import { cleanDocument } from '@/lib/question-parser/document-cleaner.js';
import { extractMetadata } from '@/lib/question-parser/metadata-extractor.js';
import { classifyQuestion } from '@/lib/question-parser/question-classifier.js';

// Test individual modules
const cleaned = cleanDocument(rawText);
const metadata = extractMetadata(cleaned.cleanedText);
const type = classifyQuestion({ text: 'Question?', options: [...] });
```

## Future Enhancements

- [ ] Machine learning integration for better classification
- [ ] Support for more languages
- [ ] Advanced OCR correction
- [ ] Question difficulty detection
- [ ] Automatic distracter generation for MCQs