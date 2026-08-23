import React, { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import Login from './pages/Login';
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
  /** Household login code — present once the user's family has been created. */
  familyCode?: string | null;
}

export default function App(): React.ReactNode {
  // '/login' always targets a specific profile (via ?family=&username=, or typed
  // in by hand) — it must never silently reuse a session already sitting in this
  // browser's localStorage (e.g. two tabs sharing one incognito window: tab 1 logs
  // in as one family member, tab 2 opens a different member's invite link and must
  // NOT inherit tab 1's session). useState's lazy initializer runs exactly once,
  // before the first render, which is the correct place to do this — an effect
  // running after mount would also catch the fresh session created by submitting
  // this very page's own login form a moment later, logging it straight back out.
  const isLoginPath = window.location.pathname === '/login';

  const [token, setToken] = useState<string | null>(() => {
    if (isLoginPath) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return null;
    }
    return localStorage.getItem('token');
  });
  const [user, setUser] = useState<SafeUser | null>(() => {
    if (isLoginPath) {
      return null;
    }
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
        {/* עמוד הבית — הרשמת הורה חדש, או הפניה לדשבורד אם כבר מחוברים */}
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
              <AuthPage onAuth={handleAuth} />
            )
          }
        />

        {/* מסך התחברות אחיד — קוד משפחה + שם (ילדים/הורה נוסף) או אימייל (הורה ראשי).
            זהו גם היעד של קישורי ההזמנה: /login?family=CODE&username=NAME */}
        <Route
          path="/login"
          element={
            token && user ? (
              user.role === 'parent' ? (
                <Navigate to={user.familyId ? '/parent-dashboard' : '/onboarding'} replace />
              ) : (
                <Navigate to="/child-dashboard" replace />
              )
            ) : (
              <Login onAuth={handleAuth} />
            )
          }
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
