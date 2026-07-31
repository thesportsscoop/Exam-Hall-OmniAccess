import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Exam from '@/models/Exam';
import { getAuthUser } from '@/lib/auth';
import { parseQuestions } from '@/lib/ai-parser.js';

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

    let formData;
    try {
      formData = await request.formData();
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid form data. Make sure you are sending a multipart/form-data request with a "file" field.' },
        { status: 400 }
      );
    }

    const file = formData.get('file');

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided. Please select a file to upload.' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Check if AI parsing is requested
    const parseAfterExtract = formData.get('parseAfterExtract') === 'true';
    const examFormat = formData.get('examFormat') || exam.format || 'hybrid';

    let buffer;
    try {
      buffer = Buffer.from(await file.arrayBuffer());
    } catch (e) {
      return NextResponse.json(
        { error: 'Failed to read file. Please try again.' },
        { status: 400 }
      );
    }

    const fileName = file.name ? file.name.toLowerCase() : 'unknown';
    let extractedText = '';

    // Extract text based on file type
    if (fileName.endsWith('.pdf')) {
      extractedText = await extractPDFText(buffer);
    } else if (fileName.endsWith('.docx')) {
      extractedText = await extractDOCXText(buffer);
    } else if (fileName.endsWith('.txt')) {
      extractedText = buffer.toString('utf-8');
    } else if (fileName.match(/\.(png|jpg|jpeg|gif|bmp|webp)$/)) {
      extractedText = await extractImageText(buffer);
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload PDF, DOCX, TXT, or image files (PNG, JPG, GIF, BMP, WebP).' },
        { status: 400 }
      );
    }

    if (!extractedText || !extractedText.trim()) {
      return NextResponse.json(
        { error: 'Could not extract any text from the file. The file may be empty, scanned (image-only PDF), or corrupted.' },
        { status: 400 }
      );
    }

    const response = {
      message: 'Text extracted successfully',
      text: extractedText,
      fileName: file.name || 'unknown',
      fileType: fileName.split('.').pop(),
      charCount: extractedText.length,
    };

    // If AI parsing is requested, parse the extracted text through the AI parser
    if (parseAfterExtract) {
      try {
        const parseResult = await parseQuestions(extractedText, examFormat);

        response.parsed = true;
        response.questions = parseResult.questions || [];
        response.warnings = parseResult.warnings || [];
        response.errors = parseResult.errors || [];
        response.sections = parseResult.sections || [];
        response.detectedFormat = parseResult.detectedFormat || 'natural';
        response.totalParsed = parseResult.questions?.length || 0;
        response.mcqCount = parseResult.questions?.filter(q => q.type === 'mcq').length || 0;
        response.essayCount = parseResult.questions?.filter(q => q.type === 'essay').length || 0;
        response.parseSummary = parseResult.summary || '';

        if (parseResult.questions?.length === 0) {
          response.message = 'Text extracted but no questions were parsed. Review the text manually.';
        } else {
          response.message = `Text extracted and ${parseResult.questions.length} question(s) parsed using AI.`;
        }
      } catch (parseError) {
        console.error('AI parsing after upload failed:', parseError.message);
        response.parsed = false;
        response.parseError = parseError.message;
        // Still return the extracted text so teacher can use paste tab
      }
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process file: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}

async function extractPDFText(buffer) {
  try {
    // Dynamic import for serverless compatibility
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF. Ensure the PDF contains selectable text (not scanned).');
  }
}

async function extractDOCXText(buffer) {
  try {
    // Dynamic import for serverless compatibility
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('DOCX extraction error:', error);
    throw new Error('Failed to extract text from DOCX. The file may be corrupted or password-protected.');
  }
}

async function extractImageText(buffer) {
  try {
    // Dynamic import for serverless compatibility
    const Tesseract = await import('tesseract.js');
    const { data } = await Tesseract.recognize(buffer, 'eng', {
      logger: () => {}, // Suppress progress logs
    });
    return data.text;
  } catch (error) {
    console.error('OCR extraction error:', error);
    throw new Error('Failed to extract text from image. The image may be too blurry or low-resolution.');
  }
}
