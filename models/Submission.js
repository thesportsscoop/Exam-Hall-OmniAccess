import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: [true, 'Exam ID is required'],
      index: true,
    },
    studentName: {
      type: String,
      required: [true, 'Please provide student name'],
      trim: true,
      maxlength: [100, 'Student name cannot exceed 100 characters'],
    },
    classGroup: {
      type: String,
      trim: true,
      default: '',
    },
    answers: [
      {
        questionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Question',
          required: true,
        },
        answer: {
          type: mongoose.Schema.Types.Mixed,
          required: true,
        },
        isCorrect: {
          type: Boolean,
          default: null,
        },
        pointsAwarded: {
          type: Number,
          default: 0,
        },
        feedback: {
          type: String,
          trim: true,
          default: '',
        },
      },
    ],
    score: {
      type: Number,
      default: 0,
    },
    maxScore: {
      type: Number,
      default: 0,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    isGraded: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying
submissionSchema.index({ examId: 1, submittedAt: -1 });
submissionSchema.index({ examId: 1, studentName: 1 });

const Submission =
  mongoose.models.Submission || mongoose.model('Submission', submissionSchema);

export default Submission;