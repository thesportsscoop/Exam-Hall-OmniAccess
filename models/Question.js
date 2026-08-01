import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: [true, 'Exam ID is required'],
      index: true,
    },
    type: {
      type: String,
      enum: ['mcq', 'essay', 'true_false', 'fill_blank', 'short_answer'],
      required: [true, 'Please specify question type'],
    },
    questionText: {
      type: String,
      required: [true, 'Please provide question text'],
      trim: true,
      maxlength: [2000, 'Question text cannot exceed 2000 characters'],
    },
    options: [
      {
        label: {
          type: String,
          enum: ['A', 'B', 'C', 'D', 'E'],
        },
        text: {
          type: String,
          trim: true,
        },
      },
    ],
    correctAnswer: {
      type: String,
      trim: true,
    },
    markingScheme: {
      type: String,
      trim: true,
      maxlength: [500, 'Marking scheme cannot exceed 500 characters'],
      default: '',
    },
    points: {
      type: Number,
      required: [true, 'Please provide point value'],
      min: [0, 'Points must be a positive number'],
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying of exam questions
questionSchema.index({ examId: 1, createdAt: 1 });

const Question =
  mongoose.models.Question || mongoose.model('Question', questionSchema);

export default Question;