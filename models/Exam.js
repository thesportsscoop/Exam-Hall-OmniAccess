import mongoose from 'mongoose';

const examSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Teacher ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Please provide an exam title'],
      trim: true,
      maxlength: [100, 'Title cannot be more than 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot be more than 500 characters'],
      default: '',
    },
    durationMinutes: {
      type: Number,
      required: [true, 'Please provide exam duration'],
      min: [1, 'Duration must be at least 1 minute'],
      max: [480, 'Duration cannot exceed 480 minutes (8 hours)'],
    },
    startTime: {
      type: Date,
      required: [true, 'Please provide exam start time'],
    },
    endTime: {
      type: Date,
      required: [true, 'Please provide exam end time'],
    },
    passkey: {
      type: String,
      required: [true, 'Please provide a passkey'],
      trim: true,
      minlength: [4, 'Passkey must be at least 4 characters'],
    },
    format: {
      type: String,
      enum: ['mcq', 'essay', 'hybrid'],
      default: 'mcq',
    },
    paymentReference: {
      type: String,
      trim: true,
      default: '',
    },
    showResults: {
      type: Boolean,
      default: false,
    },
    classes: [
      {
        type: String,
        trim: true,
      },
    ],
    isPaid: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    draftQuestions: [{ type: Object }],
    draftSavedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
examSchema.index({ teacherId: 1, createdAt: -1 });
examSchema.index({ passkey: 1 }, { unique: true });

const Exam = mongoose.models.Exam || mongoose.model('Exam', examSchema);

export default Exam;