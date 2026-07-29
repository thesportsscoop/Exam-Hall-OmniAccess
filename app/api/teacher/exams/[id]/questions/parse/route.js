import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Exam from '@/models/Exam';
import Question from '@/models/Question';
import { getAuthUser } from '@/lib/auth';

// Parse pasted question text into structured questions
function parseQuestionText(text) {
  const lines = text.trim().split('\n').filter(line => line.trim());
  
  // Detect format: look for headers
  const headers = ['No', 'Question', 'A', 'B', 'C', 'D', 'Answer', 'answer key', 'options'];
  const lowerLines = lines.map(l => l.toLowerCase());
  
  // Find header row
  let headerRowIndex = -1;
  let detectedFormat = null;
  
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lowerLines[i];
    if (line.includes('no.') || line.includes('no ') || line.includes('question') || 
        line.includes('answer') || line.includes('a\t') || line.includes('a,')) {
      headerRowIndex = i;
      
      // Detect delimiter
      if (line.includes('\t')) detectedFormat = 'tsv';
      else if (line.includes(',')) detectedFormat = 'csv';
      else if (line.includes(';')) detectedFormat = 'semicolon';
      else detectedFormat = 'unknown';
      
      break;
    }
  }
  
  // If no header found, try to detect from first data row
  if (headerRowIndex === -1) {
    headerRowIndex = -1; // No header
    if (lines[0].includes('\t')) detectedFormat = 'tsv';
    else if (lines[0].includes(',')) detectedFormat = 'csv';
    else if (lines[0].includes(';')) detectedFormat = 'semicolon';
    else detectedFormat = 'unknown';
  }
  
  // Split lines based on detected format
  const splitLine = (line) => {
    if (detectedFormat === 'tsv') return line.split('\t').map(s => s.trim());
    if (detectedFormat === 'csv') return line.split(',').map(s => s.trim());
    if (detectedFormat === 'semicolon') return line.split(';').map(s => s.trim());
    // Fallback: try tab first, then comma
    if (line.includes('\t')) return line.split('\t').map(s => s.trim());
    return line.split(',').map(s => s.trim());
  };
  
  const questions = [];
  let answerKeyStartIndex = lines.length;
  
  // Find answer key section
  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    const line = lowerLines[i];
    if (line.includes('answer key') || line.includes('answers') || 
        (line.match(/^\s*\d+\s*$/) && i > headerRowIndex + lines.length / 2)) {
      answerKeyStartIndex = i;
      break;
    }
  }
  
  // Parse questions
  const questionRows = [];
  const answerRows = [];
  
  // Try to parse as table first
  if (headerRowIndex >= 0) {
    for (let i = headerRowIndex + 1; i < answerKeyStartIndex; i++) {
      const parts = splitLine(lines[i]);
      if (parts.length >= 5) {
        questionRows.push({
          number: parts[0],
          text: parts[1],
          options: parts.slice(2, 6),
          answer: null
        });
      }
    }
    
    // Parse answer key
    if (answerKeyStartIndex < lines.length) {
      for (let i = answerKeyStartIndex; i < lines.length; i++) {
        const parts = splitLine(lines[i]);
        if (parts.length >= 2) {
          answerRows.push({
            number: parts[0],
            answer: parts[1].toUpperCase()
          });
        }
      }
    }
  } else {
    // No header - try to parse as plain text with numbered questions
    let currentQuestion = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const parts = splitLine(line);
      
      // Check if this looks like a question (starts with number)
      if (parts[0].match(/^\d+\.?$/)) {
        if (currentQuestion) {
          questionRows.push(currentQuestion);
        }
        currentQuestion = {
          number: parts[0].replace('.', ''),
          text: parts[1] || line,
          options: [],
          answer: null
        };
      } else if (parts.length >= 4 && parts[0].match(/^[A-D]$/)) {
        // This is an option line
        if (currentQuestion) {
          currentQuestion.options.push(parts[1] || parts[0]);
        }
      } else if (parts.length === 1 && parts[0].match(/^[A-D]$/)) {
        // Just the answer letter
        if (currentQuestion) {
          currentQuestion.answer = parts[0].toUpperCase();
        }
      } else if (parts.length >= 2 && parts[0].match(/^[A-D]$/)) {
        if (currentQuestion) {
          currentQuestion.options.push(parts[1]);
        }
      }
    }
    
    if (currentQuestion) {
      questionRows.push(currentQuestion);
    }
  }
  
  // Match questions with answers
  for (const qRow of questionRows) {
    const answerMatch = answerRows.find(a => a.number === qRow.number || 
                                            a.number === qRow.number + '.' ||
                                            a.number === parseInt(qRow.number).toString());
    if (answerMatch) {
      qRow.answer = answerMatch.answer;
    }
  }
  
  // Convert to structured format
  const structuredQuestions = questionRows
    .filter(q => q.text && q.text.length > 5)
    .map(q => {
      const optionLabels = ['A', 'B', 'C', 'D', 'E'];
      const options = q.options.filter(o => o && o.length > 0);
      
      // Ensure we have at least 4 options
      while (options.length < 4) {
        options.push('');
      }
      
      const structuredOptions = options.map((text, i) => ({
        label: optionLabels[i],
        text: text
      }));
      
      return {
        type: 'mcq',
        questionText: q.text,
        options: structuredOptions,
        correctAnswer: q.answer || 'A',
        points: 1
      };
    });
  
  return {
    questions: structuredQuestions,
    detectedFormat,
    totalParsed: structuredQuestions.length,
    totalLines: lines.length
  };
}

export async function POST(request, { params }) {
  try {
    const decoded = await getAuthUser();
    if (!decoded || decoded.role !== 'teacher') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await dbConnect();

    const exam = await Exam.findOne({ _id: params.id, teacherId: decoded.id });
    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    const body = await request.json();
    const { text, examFormat } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Please provide text to parse' },
        { status: 400 }
      );
    }

    // Parse the text
    const parsed = parseQuestionText(text);

    if (parsed.questions.length === 0) {
      return NextResponse.json(
        { error: 'Could not detect any valid questions in the provided text', details: 'Please ensure the format includes: Question number, question text, options A-D, and answer key.' },
        { status: 400 }
      );
    }

    // If examFormat is essay/hybrid, convert MCQ to hybrid or mark as essay
    const finalFormat = examFormat || exam.format;
    
    // Save questions to database
    const createdQuestions = [];
    for (const q of parsed.questions) {
      const question = await Question.create({
        examId: params.id,
        type: finalFormat === 'essay' ? 'essay' : 'mcq',
        questionText: q.questionText,
        options: finalFormat === 'essay' ? [] : q.options,
        correctAnswer: finalFormat === 'essay' ? '' : q.correctAnswer,
        markingScheme: finalFormat === 'essay' ? 'Please provide marking rubric for essay questions.' : '',
        points: q.points
      });
      
      createdQuestions.push({
        _id: question._id.toString(),
        type: question.type,
        questionText: question.questionText,
        options: question.options,
        correctAnswer: question.correctAnswer,
        markingScheme: question.markingScheme,
        points: question.points
      });
    }

    return NextResponse.json({
      message: `Successfully imported ${createdQuestions.length} questions`,
      questions: createdQuestions,
      parseInfo: {
        detectedFormat: parsed.detectedFormat,
        totalParsed: parsed.totalParsed,
        totalLines: parsed.totalLines
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Parse questions error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}