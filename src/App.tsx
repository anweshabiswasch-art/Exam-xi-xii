import { Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { AdminRoute } from './routes/AdminRoute';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { StudentDashboard } from './pages/StudentDashboard';
import { TestSetupPage } from './pages/TestSetup';
import { ExamModePage } from './pages/ExamMode';
import { ResultsPage } from './pages/ResultsPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { TopicManager } from './pages/admin/TopicManager';
import { QuestionManager } from './pages/admin/QuestionManager';
import { MaterialUpload } from './pages/admin/MaterialUpload';
import { AdminAnalytics } from './pages/admin/AdminAnalytics';
import { MaterialsLibrary } from './pages/MaterialsLibrary';
import { LeaderboardPage } from './pages/Leaderboard';
import { AdaptiveSetupPage } from './pages/AdaptiveSetup';
import { AdaptiveSessionPage } from './pages/AdaptiveSession';
import { SystemEvolution } from './pages/admin/SystemEvolution';
import { AiQuestionGenerator } from './pages/admin/AiQuestionGenerator';
import { AnnouncementsAdmin } from './pages/admin/AnnouncementsAdmin';
import { AnnouncementsPage } from './pages/Announcements';
import { UserManager } from './pages/admin/UserManager';
import { TeacherRoute } from './routes/TeacherRoute';
import { TeacherDashboard } from './pages/teacher/TeacherDashboard';
import { CreateCustomTest } from './pages/teacher/CreateCustomTest';
import { TestResultsView } from './pages/teacher/TestResultsView';

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route path="/dashboard" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
        <Route path="/test/setup" element={<ProtectedRoute><TestSetupPage /></ProtectedRoute>} />
        <Route path="/test/exam" element={<ProtectedRoute><ExamModePage /></ProtectedRoute>} />
        <Route path="/test/results" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />
        <Route path="/materials" element={<ProtectedRoute><MaterialsLibrary /></ProtectedRoute>} />
        <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
        <Route path="/announcements" element={<ProtectedRoute><AnnouncementsPage /></ProtectedRoute>} />
        <Route path="/practice/setup" element={<ProtectedRoute><AdaptiveSetupPage /></ProtectedRoute>} />
        <Route path="/practice/session" element={<ProtectedRoute><AdaptiveSessionPage /></ProtectedRoute>} />

        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/topics" element={<AdminRoute><TopicManager /></AdminRoute>} />
        <Route path="/admin/questions" element={<AdminRoute><QuestionManager /></AdminRoute>} />
        <Route path="/admin/materials" element={<AdminRoute><MaterialUpload /></AdminRoute>} />
        <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
        <Route path="/admin/evolution" element={<AdminRoute><SystemEvolution /></AdminRoute>} />
        <Route path="/admin/ai-generate" element={<AdminRoute><AiQuestionGenerator /></AdminRoute>} />
        <Route path="/admin/announcements" element={<AdminRoute><AnnouncementsAdmin /></AdminRoute>} />
        <Route path="/admin/users" element={<AdminRoute><UserManager /></AdminRoute>} />

        <Route path="/teacher" element={<TeacherRoute><TeacherDashboard /></TeacherRoute>} />
        <Route path="/teacher/create" element={<TeacherRoute><CreateCustomTest /></TeacherRoute>} />
        <Route path="/teacher/results/:testId" element={<TeacherRoute><TestResultsView /></TeacherRoute>} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}
