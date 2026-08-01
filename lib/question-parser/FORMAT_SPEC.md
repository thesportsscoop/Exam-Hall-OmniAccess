# Question Parser Input Format Specification

## Overview
The question parser accepts text input and automatically structures it into MCQ and Essay questions. Follow the format below for best results.

## Supported Formats

### Format 1: Natural Language (Recommended for pasting formatted exams)

```
SECTION A: OBJECTIVE TEST (30 MARKS)

1. What is 2+2?
A) 3
B) 4
C) 5
D) 6

2. Which organ pumps blood?
A) Lungs
B) Heart
C) Liver
D) Kidney

Answer Key:
1B 2A

SECTION B: ESSAY QUESTIONS (20 MARKS)

Question 1
a) Define photosynthesis
b) State two products of photosynthesis

Question 2
Explain the water cycle in 5 steps
```

### Format 2: Numbered Questions (Simple format)

```
1. What is the capital of France?
A) London
B) Paris
C) Berlin
D) Madrid

2. What is 5 × 6?
A) 20
B) 25
C) 30
D) 35

3. Who wrote Romeo and Juliet?
A) Dickens
B) Shakespeare
C) Austen
D) Orwell
```

### Format 3: With Section Headers and Marks

```
Multiple Choice Questions (10 marks)

1. Which gas do plants absorb?
A) Oxygen
B) Carbon dioxide
C) Nitrogen
D) Hydrogen

2. What is H2O?
A) Salt
B) Water
C) Acid
D) Base
```

### Format 4: Essay Questions

```
Question 1
Explain the process of digestion in humans. Include the role of the stomach and small intestine.

Question 2
a) Define a habitat
b) Give three examples of aquatic habitats
c) State two adaptations of fish

Question 3
Describe the structure of a plant cell and label three main organelles
```

## Key Rules

### For MCQ Questions:
1. Each question MUST start with a number followed by `.` or `)`
   - ✅ `1. Question text`
   - ✅ `2) Question text`
   - ❌ `Question text` (no number)

2. Options MUST use letters A, B, C, D (case-insensitive)
   - ✅ `A) Option text`
   - ✅ `B. Option text`
   - ✅ `C - Option text`
   - ✅ `D: Option text`

3. Each option on its own line
   - ✅ 
     ```
     A) First option
     B) Second option
     ```
   - ❌ `A) First B) Second`

4. At least 2 options per question

### For Essay Questions:
1. Each question starts with `Question N` or just a number
2. Sub-parts use lowercase letters: a), b), c)
3. Can have marking scheme/rubric after the question

### Answer Keys:
Place at the end of the text:
```
Answer Key:
1A 2B 3C 4D
```

Or inline:
```
1. Question text?
A) Option 1
B) Option 2
C) Option 3
D) Option 4
Answer: B
```

## Section Headers (Optional)
The parser automatically detects:
- `Section A`, `Section B`, etc.
- `Part 1`, `Part 2`, etc.
- `Multiple Choice Questions`
- `Essay Questions`
- Total marks in parentheses: `(30 Marks)`

## What NOT to Include
The parser may get confused by:
- Instructions/guidelines text
- Time allowed statements
- Candidate information (Name, Class, etc.)
- Long descriptive paragraphs before questions

## Tips for Best Results

1. **Paste from Word/Docs**: Copy directly from your document. The parser will handle most formatting.

2. **Use the Template**: Click "Use Template" button to get a pre-formatted example you can edit.

3. **One Question per Number**: Don't skip numbers (1, 2, 3...) as the parser uses these to identify questions.

4. **Clear Option Letters**: Always use A, B, C, D for options. Don't use numbers or other symbols.

5. **Answer Key Format**: 
   - Simple: `1B 2C 3A`
   - With spaces: `1 B 2 C 3 A`
   - On separate lines: `1: B` or `1-B`

## Example: Complete Exam Paper

```
GENERAL SCIENCE EXAM

Section A: Multiple Choice Questions (20 Marks)

1. What is the chemical symbol for water?
A) H2O
B) CO2
C) O2
D) NaCl

2. Which planet is closest to the sun?
A) Venus
B) Earth
C) Mercury
D) Mars

3. What process do plants use to make food?
A) Respiration
B) Photosynthesis
C) Digestion
D) Fermentation

Section B: Essay Questions (30 Marks)

Question 1
Explain the water cycle. Describe each stage and its importance to life on Earth.

Question 2
a) Define an ecosystem
b) Give two examples of natural ecosystems
c) State three components of an ecosystem

Answer Key:
1A 2C 3B
```

## Troubleshooting

**Problem**: Questions not detected  
**Solution**: Make sure each question has a number (1., 2., etc.) followed by the question text

**Problem**: Options not detected  
**Solution**: Ensure options use A, B, C, D format, each on its own line

**Problem**: Wrong question count  
**Solution**: Remove instructions, headers, and non-question text. Keep only numbered questions.

**Problem**: Essay questions detected as MCQ  
**Solution**: Add "Essay" or "Question" before the question number, or ensure no A-D options follow