import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Exam from '@/models/Exam';
import { getAuthUser } from '@/lib/auth';

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

    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();
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
        { error: 'Unsupported file type. Please upload PDF, DOCX, TXT, or image files.' },
        { status: 400 }
      );
    }

    if (!extractedText.trim()) {
      return NextResponse.json(
        { error: 'Could not extract any text from the file' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Text extracted successfully',
      text: extractedText,
      fileName: file.name,
      fileType: fileName.split('.').pop(),
      charCount: extractedText.length,
    });

  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process file', details: error.message },
      { status: 500 }
    );
  }
}

async function extractPDFText(buffer) {
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF: ' + error.message);
  }
}

async function extractDOCXText(buffer) {
  try {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('DOCX extraction error:', error);
    throw new Error('Failed to extract text from DOCX: ' + error.message);
  }
}

async function extractImageText(buffer) {
  try {
    const Tesseract = require('tesseract.js');
    const { data } = await Tesseract.recognize(buffer, 'eng', {
      logger: () => {}, // Suppress progress logs
    });
    return data.text;
  } catch (error) {
    console.error('OCR extraction error:', error);
    throw new Error('Failed to extract text from image: ' + error.message);
  }
}