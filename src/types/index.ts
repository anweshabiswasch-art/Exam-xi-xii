export type UserRole = 'student' | 'teacher' | 'admin';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  class: 'XI' | 'XII' | null;
  createdAt: number;
  currentStreak?: number;
  longestStreak?: number;
  lastActiveDate?: string; // YYYY-MM-DD
  badges?: string[];
  testsCompleted?: number;
}

export interface LeaderboardEntry {
  studentUid: string;
  displayName: string;
  class: 'XI' | 'XII';
  scoreSum: number;
  testsCount: number;
}

export type QuestionType =
  | 'standard'
  | 'assertion_reason'
  | 'true_false'
  | 'multiple_statement'
  | 'chronological'
  | 'rearrangement'
  | 'match_following'
  | 'fill_blank'
  | 'vocabulary'
  | 'grammar';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Topic {
  id: string;
  class: 'XI' | 'XII';
  chapter: string;
  title: string;
  description?: string;
  createdAt: number;
}

/**
 * A single question document. `options` covers standard 4-option MCQs,
 * true/false and assertion-reason questions directly. The specialised
 * types (match_following, chronological, rearrangement) reuse the same
 * `options` + `correctAnswer` shape by encoding each option as one
 * candidate ordering/pairing string — see ADR note in README for the
 * rationale and how to extend this if you outgrow it.
 */
export interface Question {
  id: string;
  class: 'XI' | 'XII';
  topicId: string;
  chapter: string;
  type: QuestionType;
  difficulty: Difficulty;
  tags: string[];
  questionText: string;
  options: [string, string, string, string];
  correctAnswerIndex: 0 | 1 | 2 | 3;
  explanation: string;
  referencePage?: string;
  estimatedSeconds: number;
  createdAt: number;
  createdBy: string;
  examYear?: number; // set when this question is from an actual WBCHSE previous-year paper
  // Set by the self-evolution job (netlify/functions/evolve.ts) — never by a human.
  difficultyAutoAdjusted?: boolean;
  difficultyLastEvolvedAt?: number;
  flaggedForReview?: boolean;
  flagReason?: string;
}

export type MaterialType = 'pdf' | 'docx' | 'image' | 'note';

export interface Material {
  id: string;
  class: 'XI' | 'XII';
  topicId: string;
  chapter: string;
  title: string;
  type: MaterialType;
  storagePath: string;
  downloadURL: string;
  fileSizeBytes: number;
  downloadCount?: number;
  uploadedBy: string;
  createdAt: number;
  textIndexed?: boolean;
  indexedPageCount?: number;
  textIndexTruncated?: boolean;
}

// Aggregate documents, updated incrementally at submission time so the
// admin dashboard never has to scan every result/answer to render.
export interface QuestionStat {
  class: 'XI' | 'XII';
  topicId: string;
  attempts: number;
  correct: number;
}

export interface TopicStat {
  class: 'XI' | 'XII';
  attempts: number;
  correct: number;
}

export interface AnalyticsSummary {
  testsCount: number;
  totalScoreSum: number;
  totalMaxScoreSum: number;
}

export interface AdaptiveAttempt {
  questionId: string;
  topicId: string;
  difficulty: Difficulty;
  correct: boolean;
}

export interface AdaptiveSession {
  id: string;
  studentUid: string;
  class: 'XI' | 'XII';
  topicIds: string[] | 'ALL';
  questionsPlanned: number;
  attempts: AdaptiveAttempt[];
  correctCount: number;
  finalDifficulty: Difficulty;
  submittedAt: number;
}

export interface EvolutionLogEntry {
  id: string;
  runAt: number;
  questionsScanned: number;
  questionsRecalibrated: number;
  questionsFlagged: number;
  trigger: 'scheduled' | 'manual';
}

export type AnnouncementType = 'general' | 'exam_alert' | 'new_topic' | 'new_material';

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: AnnouncementType;
  targetClass: 'XI' | 'XII' | 'ALL';
  createdAt: number;
  createdBy: string;
}

export interface CustomTest {
  id: string;
  teacherUid: string;
  teacherName: string;
  class: 'XI' | 'XII';
  title: string;
  instructions?: string;
  questionIds: string[];
  durationSeconds: number;
  negativeMarking: boolean;
  assignedToAll: boolean;
  assignedToUids: string[]; // used when assignedToAll is false
  createdAt: number;
}

export interface TestConfig {
  studentUid: string;
  class: 'XI' | 'XII';
  topicIds: string[] | 'ALL';
  totalMarks: 20 | 30 | 40 | 50 | 100;
  difficulty: Difficulty | 'mixed';
  negativeMarking: boolean;
  examYear?: number; // when set, only draws from questions tagged with this WBCHSE exam year
}

export interface TestPaper {
  id: string;
  config: TestConfig;
  questionIds: string[];
  createdAt: number;
  durationSeconds: number;
}

export interface AnswerRecord {
  questionId: string;
  selectedIndex: number | null; // null = skipped
  flagged: boolean;
  timeSpentSeconds: number;
}

export interface TestResult {
  id: string;
  studentUid: string;
  testPaperId: string;
  answers: AnswerRecord[];
  score: number;
  maxScore: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  timeTakenSeconds: number;
  topicBreakdown: Record<string, { correct: number; total: number }>;
  difficultyBreakdown: Record<Difficulty, { correct: number; total: number }>;
  submittedAt: number;
  customTestId?: string; // set when this result came from a teacher-assigned test
  studentDisplayName?: string;
}
