import React, { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import AuthPage from './pages/AuthPage';
import Login from './pages/Login';
import ParentOnboardingPage from './pages/ParentOnBoardingPage';
import ParentDashboard from './pages/ParentDashboard';
import './App.css';
import ChildDashboard from './pages/ChildDashboard';

// Same env var name the .env file already uses (VITE_CLIENT_ID, not the
// VITE_GOOGLE_CLIENT_ID a fresh setup might expect) — kept as-is rather than
// asking for another .env edit. Falls back to '' so a missing/misconfigured
// key only breaks the Google button, not the rest of the app (family-code and
// email/password login keep working regardless).
const GOOGLE_CLIENT_ID = import.meta.env.VITE_CLIENT_ID ?? '';

export type UserRole = 'parent' | 'child';
export interface SafeUser {
  id: string;
  role: UserRole;
  name: string;
  email?: string;
  familyId?: string | null;
  /** Household login code — present once the user's family has been created. */
  familyCode?: string | null;
  /**
   * Which credential this account actually logs in with. A 'google' parent's
   * `password` in the database is an unusable random placeholder — never
   * prompt one of these users for "their password" (see the server's
   * AuthProvider docstring); use a Google re-auth confirmation instead.
   */
  authProvider?: 'password' | 'google';
  /** One of the fixed emoji in data/avatars.ts — null/undefined until chosen, in which case the UI falls back to a name-initial badge. */
  avatarUrl?: string | null;
}

export default function App(): React.ReactNode {
  // '/login' and '/signup' both target a specific action (via ?family=&username=
  // or ?inviteCode=, or typed in by hand) — neither must ever silently reuse a
  // session already sitting in this browser's localStorage (e.g. two tabs sharing
  // one incognito window: tab 1 logs in as one family member, tab 2 opens a
  // different member's invite link and must NOT inherit tab 1's session).
  // useState's lazy initializer runs exactly once, before the first render, which
  // is the correct place to do this — an effect running after mount would also
  // catch the fresh session created by submitting this very page's own form a
  // moment later, logging it straight back out.
  const pathname = window.location.pathname;
  const isEntryLinkPath = pathname === '/login' || pathname === '/signup';

  const [token, setToken] = useState<string | null>(() => {
    if (isEntryLinkPath) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return null;
    }
    return localStorage.getItem('token');
  });
  const [user, setUser] = useState<SafeUser | null>(() => {
    if (isEntryLinkPath) {
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

  // עדכון חלקי של פרטי המשתמש המחוברים (למשל: בחירת אווטאר חדש) — נשמר גם
  // ב-localStorage כדי שיישאר "לצמיתות" גם אחרי רענון עמוד/סשן חדש
  const updateUser = (patch: Partial<SafeUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...patch };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  };


  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID} locale="iw">
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

        {/* כינוי מפורש ל-/ — זהו היעד של קישור הזמנת הורה נוסף:
            /signup?inviteCode=... (ראו AuthPage.tsx להבחנה בין המצבים) */}
        <Route
          path="/signup"
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

        {/* מסך התחברות אחיד — קוד משפחה + שם (ילדים) או אימייל/Google (הורים).
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
              <ParentDashboard user={user} onLogout={handleLogout} onUserUpdate={updateUser} />
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
              <ChildDashboard user={user} onLogout={handleLogout} onUserUpdate={updateUser} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </GoogleOAuthProvider>
  );
}
