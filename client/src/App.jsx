import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

import RegistrationForm    from './pages/RegistrationForm';
import RegistrationSuccess from './pages/RegistrationSuccess';
import InterviewerLogin    from './pages/InterviewerLogin';
import InterviewerDashboard from './pages/InterviewerDashboard';
import CandidateDetail     from './pages/CandidateDetail';
import ManageInterviewers  from './pages/ManageInterviewers';
import SettingsPage        from './pages/SettingsPage';
import ChangePassword      from './pages/ChangePassword';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="page">
          <Navbar />
          <Routes>
            <Route path="/"                         element={<RegistrationForm />} />
            <Route path="/success"                  element={<RegistrationSuccess />} />
            <Route path="/interviewer/login"        element={<InterviewerLogin />} />
            <Route path="/interviewer/dashboard"    element={
              <ProtectedRoute><InterviewerDashboard /></ProtectedRoute>
            } />
            <Route path="/interviewer/candidate/:id" element={
              <ProtectedRoute><CandidateDetail /></ProtectedRoute>
            } />
            <Route path="/interviewer/manage" element={
              <ProtectedRoute><ManageInterviewers /></ProtectedRoute>
            } />
            <Route path="/interviewer/settings" element={
              <ProtectedRoute><SettingsPage /></ProtectedRoute>
            } />
            <Route path="/interviewer/password" element={
              <ProtectedRoute><ChangePassword /></ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
