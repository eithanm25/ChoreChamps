import React, { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import ParentOnboardingPage from './pages/ParentOnBoardingPage';
import ParentDashboard from './pages/ParentDashboard';
import './App.css';
import ChildDashboard from './pages/ChildDashboard';

export type UserRole = 'parent' | 'child';
export interface SafeUser {
  id: string;
  role: UserRole;
  name: string;
  email?: string;
  familyId?: string | null;
}

// 1. הגדרת ה-Interface של ה-Props עבור רכיב הניווט הדינמי החדש
interface InvitedAuthRouteProps {
  token: string | null;
  user: SafeUser | null;
  handleAuth: (authToken: string, loggedInUser: SafeUser) => void;
}

// 2. הוצאנו את הקומפוננטה לחלוטין מחוץ ל-App כדי למנוע את שגיאת ה-Render!
function InvitedAuthRoute({ token, user, handleAuth }: InvitedAuthRouteProps): React.ReactElement {
  const { invitedId } = useParams<{ invitedId: string }>();

  if (token && user) {
    if (user.role === 'parent') {
      return <Navigate to={user.familyId ? '/parent-dashboard' : '/onboarding'} replace />;
    }
    return <Navigate to="/child-dashboard" replace />;
  }

  return <AuthPage onAuth={handleAuth} prefilledId={invitedId ?? null} />;
}

export default function App(): React.ReactNode {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<SafeUser | null>(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const handleAuth = (authToken: string, loggedInUser: SafeUser) => {
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    setToken(authToken);
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

    // פונקציית עזר לעדכון ה-user state והטוקן המעודכן ברגע שהמשפחה נוצרת
  const handleFamilyCreated = (updatedUser: SafeUser, newToken: string) => {
    localStorage.setItem('user', JSON.stringify(updatedUser));
    localStorage.setItem('token', newToken); // החלפת הטוקן הישן בחדש שמכיל את ה-familyId!
    setToken(newToken);
    setUser(updatedUser);
  };


  return (
    <BrowserRouter>
      <Routes>
        {/* עמוד הבית הרגיל */}
        <Route
          path="/"
          element={
            token && user ? (
              user.role === 'parent' ? (
                !user.familyId ? (
                  <Navigate to="/onboarding" replace />
                ) : (
                  <Navigate to="/parent-dashboard" replace />
                )
              ) : (
                <Navigate to="/child-dashboard" replace />
              )
            ) : (
              <AuthPage onAuth={handleAuth} prefilledId={null} />
            )
          }
        />

        {/* 3. הנתיב הדינמי הקצר - קורא לקומפוננטה החיצונית ומעביר לה את הסטייט */}
        <Route 
          path="/:invitedId" 
          element={<InvitedAuthRoute token={token} user={user} handleAuth={handleAuth} />} 
        />

        {/* מסך הקמת משפחה ראשוני */}
        <Route
          path="/onboarding"
          element={
            token && user?.role === 'parent' && !user.familyId ? (
              <ParentOnboardingPage onFamilyCreated={handleFamilyCreated} onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        {/* דשבורד הורים ראשי */}
        <Route
          path="/parent-dashboard"
          element={
            token && user?.role === 'parent' && user.familyId ? (
              <ParentDashboard user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        {/* דשבורד ילדים */}
        <Route
          path="/child-dashboard"
          element={
            token && user?.role === 'child' && user.familyId ? (
              <ChildDashboard user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
