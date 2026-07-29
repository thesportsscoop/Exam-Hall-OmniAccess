# Exam Hall OmniAccess

A secure, zero-cost online assessment platform for educators featuring automated grading, Paystack payment integration, and AI proctoring.

## Features

- **User Authentication**: Teacher registration/login with JWT
- **Admin Dashboard**: Manage teachers and view all exams
- **Teacher Dashboard**: Create exams, manage questions, view submissions
- **Paystack Integration**: GHS 100 exam creation fee
- **Exam Management**: MCQ, Essay, and Hybrid formats with passkey access
- **AI Proctoring**: Identity verification, environment scan, continuous monitoring
- **Question Bank**: Add/upload questions with marking rubrics

## Prerequisites

- Node.js 18+
- MongoDB (local or Atlas cloud)
- npm or yarn

## Quick Setup

### 1. Clone and Install

```bash
cd "c:\Users\OPP\Downloads\Alta Vista"
npm install
```

### 2. Setup MongoDB

**Option A: MongoDB Atlas (Recommended - Free Cloud Database)**
1. Go to https://www.mongodb.com/atlas/database
2. Create a free account
3. Create a cluster (M0 Sandbox - Free tier)
4. Click "Connect" → "Connect your application"
5. Copy the connection string
6. Replace `<password>` with your database user password
7. Replace `alta-vista` with your preferred database name

**Option B: Local MongoDB**
1. Download from https://www.mongodb.com/try/download/community
2. Install and start MongoDB service
3. Use connection string: `mongodb://localhost:27017/alta-vista`

### 3. Configure Environment

Open `.env.local` and update the `MONGODB_URI`:

```env
MONGODB_URI=mongodb+srv://<your-username>:<your-password>@<your-cluster>.mongodb.net/alta-vista?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_c16d98a0ce1eb7f55f8cd703949c881301556882
PAYSTACK_SECRET_KEY=sk_test_0b4e504e7602078a2e0cce0a2bb6b02a14a4bca1
```

### 4. Run the Application

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### 5. Initial Setup

1. Click **"Setup & Configuration"** on the home page
2. Click **"Check MongoDB Connection"** to verify database connection
3. Click **"Create Admin User"** to create the super admin account
   - Email: `eddy@altavista.com`
   - Password: `eddy123`
4. Go to `/login` and sign in with the admin credentials
5. Access the admin dashboard at `/admin`

## Project Structure

```
app/
├── admin/                    # Super admin pages
│   ├── layout.tsx           # Admin layout with auth guard
│   ├── page.tsx             # Admin dashboard
│   ├── exams/               # All exams management
│   └── teachers/            # Teachers management
├── dashboard/               # Teacher pages
│   ├── layout.tsx           # Teacher layout with auth guard
│   ├── page.tsx             # Teacher dashboard
│   └── exams/               # Exam management
│       ├── page.tsx         # Exams list
│       ├── create/          # Create new exam
│       │   └── page.tsx     # Exam creation with Paystack
│       └── [id]/            # Individual exam
│           ├── page.tsx     # Exam details & questions
│           └── proctoring/  # Proctoring reports
├── login/                   # Login/Register page
├── setup/                   # First-time setup wizard
├── api/                     # API routes
│   ├── auth/                # Authentication
│   ├── admin/               # Admin APIs
│   ├── teacher/             # Teacher APIs
│   ├── payment/             # Paystack integration
│   ├── proctoring/          # AI proctoring
│   └── seed/                # Database seeding
└── layout.tsx               # Root layout

components/
└── proctoring/
    └── ProctoringEngine.tsx # AI proctoring client component

lib/
├── auth.js                  # JWT & cookie utilities
└── mongodb.js               # MongoDB connection

models/
├── User.js                  # User schema (teacher/admin)
├── Exam.js                  # Exam schema
├── Question.js              # Question schema
├── Submission.js            # Submission schema
└── ProctoringSession.js     # Proctoring session schema
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new teacher
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Admin
- `GET /api/admin/stats` - Admin statistics
- `GET /api/admin/teachers` - List all teachers
- `GET /api/admin/exams` - List all exams

### Teacher
- `GET /api/teacher/exams` - List teacher's exams
- `POST /api/teacher/exams` - Create new exam
- `GET /api/teacher/exams/[id]` - Get exam details
- `PUT /api/teacher/exams/[id]` - Update exam
- `DELETE /api/teacher/exams/[id]` - Delete exam
- `GET /api/teacher/exams/[id]/questions` - List questions
- `POST /api/teacher/exams/[id]/questions` - Add question
- `PUT /api/teacher/exams/[id]/questions` - Update question
- `DELETE /api/teacher/exams/[id]/questions` - Delete question
- `GET /api/teacher/exams/[id]/proctoring` - Get proctoring reports

### Payment
- `POST /api/payment/initialize` - Initialize Paystack payment
- `GET /api/payment/verify` - Verify payment
- `POST /api/payment/verify` - Paystack webhook

### Proctoring
- `POST /api/proctoring/sessions` - Create proctoring session
- `GET /api/proctoring/sessions` - List sessions
- `GET /api/proctoring/sessions/[id]` - Get session
- `PUT /api/proctoring/sessions/[id]` - Update session
- `DELETE /api/proctoring/sessions/[id]` - Delete session

### Setup
- `GET /api/setup/check-db` - Check MongoDB connection
- `POST /api/seed` - Seed super admin user

## User Roles

### Super Admin
- Email: `eddy@altavista.com`
- Password: `eddy123`
- Access: `/admin`
- Permissions: View all teachers, exams, and system statistics

### Teacher
- Register via `/login` → "Don't have an account? Register"
- Access: `/dashboard`
- Permissions: Create exams, manage questions, view submissions

## Exam Creation Flow

1. Teacher clicks "Create New Exam" → `/dashboard/exams/create`
2. Fill in exam details (title, duration, schedule, passkey, format)
3. Click "Pay GHS 100 & Create Exam"
4. Redirected to Paystack for payment
5. After successful payment, redirected back
6. Exam is created with `isPaid: true`
7. Teacher can now add questions

## Question Types

### MCQ (Multiple Choice)
- Up to 5 options (A, B, C, D, E)
- One correct answer
- Automatic grading

### Essay
- Custom marking rubric/scheme
- Teacher manually grades
- Supports point distribution

### Hybrid
- Mix of MCQ and Essay questions
- Combined scoring

## AI Proctoring Features

### Student Side
1. **Identity Verification**: Photo of ID + selfie
2. **Environment Scan**: Room scan before exam starts
3. **Continuous Monitoring**:
   - Face detection (missing → violation)
   - Multiple faces detection (violation)
   - Gaze tracking (looking away → warning)
   - Speech detection (possible prompting → warning)
   - Object/phone detection (violation)
   - Tab switching (violation)
   - Violation threshold: 3 violations → session flagged

### Teacher Side
- View all proctoring sessions
- Filter by status (completed, flagged, in_progress)
- Expandable event timeline
- Identity verification status
- Environment scan results
- "Mark as Reviewed" for flagged sessions

## Troubleshooting

### MongoDB Connection Error
- Verify `MONGODB_URI` in `.env.local`
- Check MongoDB Atlas cluster is running
- Ensure IP whitelist includes your IP (Atlas)
- Verify database user credentials

### Login Returns 500
- Check MongoDB is running
- Verify admin user exists: `POST /api/seed`
- Check browser console for detailed error
- Ensure `.env.local` has correct `JWT_SECRET`

### Build Errors
```bash
npm run build
```
Check for TypeScript errors and fix accordingly.

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT with httpOnly cookies
- **Payments**: Paystack (GHS)
- **Proctoring**: MediaPipe/TensorFlow.js (simulated in demo)

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## License

MIT