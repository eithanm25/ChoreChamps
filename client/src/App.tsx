import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import api from './services/api';
import AuthPage from './pages/AuthPage';
import Login from './pages/Login';
import ParentOnboardingPage from './pages/ParentOnBoardingPage';
import ParentDashboard from './pages/ParentDashboard';
import './App.css';
import ChildDashboard from './pages/ChildDashboard';
import LandingPage from './pages/LandingPage';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';
import SplashScreen from './components/SplashScreen';
import InstallPwaPrompt from './components/InstallPwaPrompt';
import AdsManager from './components/AdsManager';

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
  const searchParams = new URLSearchParams(window.location.search);
  // שני צורות ההזמנה הקיימות: הורה נוסף (?inviteCode=...) נוחת על / או /signup;
  // ילד/הורה קיים (?family=...&username=...) נוחת על /login. אם מישהו מגיע
  // עם אחת מהן ישירות ל-/ (למשל קישור ישן, או שיתוף ידני של הכתובת), חייבים
  // להתייחס לזה כמו לנחיתה על /login או /signup עצמם — כולל ניקוי סשן קיים,
  // אחרת ה"עקיפה" למטה לעולם לא תיבדק בכלל (הראוט של / כבר יפנה ישר
  // לדשבורד הסשן הישן, ידרוס לגמרי את קישור ההזמנה).
  const hasCoParentInvite = searchParams.has('inviteCode');
  const hasFamilyInvite = searchParams.has('family') || searchParams.has('username');
  const isEntryLinkPath =
    pathname === '/login' ||
    pathname === '/signup' ||
    (pathname === '/' && (hasCoParentInvite || hasFamilyInvite));

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

  // מסך הפתיחה מוצג תמיד בכניסה טרייה לאתר, ללא קשר למצב ההתחברות. במקביל
  // לאנימציה הוא מריץ ברקע בדיקת התחברות אמיתית מול השרת — אם הטוקן השמור
  // כבר לא תקף (משתמש נמחק / טוקן פג), מנקים את הסשן האופטימיסטי לפני
  // שהראוטינג מציג בכלל דשבורד, כדי שלא יהיה הבזק של תוכן מוגן ואז בעיטה החוצה.
  const [showSplash, setShowSplash] = useState(true);
  // אין טוקן לבדוק מלכתחילה -> אין מה לאמת, "הבדיקה" נחשבת גמורה כבר מההתחלה.
  const [sessionChecked, setSessionChecked] = useState(() => !token);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    api
      .get('/api/family/me')
      .catch((err: unknown) => {
        // רק 401 אומר שהסשן עצמו מת (משתמש נמחק / טוקן פג/מזויף) — כל תגובה
        // אחרת (400 של הורה שטרם הקים משפחה, שגיאת רשת חולפת) משאירה את
        // הסשן האופטימיסטי כפי שהוא; ה-interceptor הקיים ב-api.ts כבר מטפל
        // בסשן שהתברר כלא תקף באופן ריאקטיבי אם וכאשר תתבצע קריאה אמיתית.
        if (axios.isAxiosError(err) && err.response?.status === 401 && !cancelled) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSessionChecked(true);
        }
      });

    return () => {
      cancelled = true;
    };
    // רק בעליית האפליקציה, נגד הטוקן שהיה קיים אז — טוקן חדש שמונפק דרך
    // handleAuth/handleFamilyCreated כבר ידוע כטרי ואינו זקוק לאימות חוזר.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // AdsManager is the outermost wrapper on purpose — it must mount (and
    // inject the AdSense loader script) on the very first render of every
    // route, logged in or not, for Google's own site-verification crawler
    // to see it on an anonymous "/" load. No prop passed -> isPremium is
    // undefined -> never blocked here; App.tsx has no reliable tier info
    // (that's only known inside a dashboard, once its own family info
    // loads), so the global instance always injects. It never blocks
    // rendering either way; see its own docstring.
    <AdsManager>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID} locale="iw">
    {/* הראוטר תמיד מרונדר — כדי שברגע שמסך הפתיחה נעלם לא יהיה שום הבזק של
        תוכן לא מוכן מתחתיו, היעד הנכון כבר מצויר שם מהרגע הראשון. */}
    {showSplash && (
      <SplashScreen ready={sessionChecked} onFinished={() => setShowSplash(false)} />
    )}
    <BrowserRouter>
      <InstallPwaPrompt />
      <Routes>
        {/* עמוד הבית — דף הנחיתה השיווקי למי שלא מחובר, או הפניה לדשבורד אם
            כבר מחוברים. קישורי הזמנה (?inviteCode= / ?family=&username=)
            שנוחתים כאן במקום על /signup או /login עוקפים את דף הנחיתה
            לגמרי — ראו isEntryLinkPath למעלה. */}
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
            ) : hasFamilyInvite ? (
              <Navigate to={`/login${window.location.search}`} replace />
            ) : hasCoParentInvite ? (
              <AuthPage onAuth={handleAuth} />
            ) : (
              <LandingPage />
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

        {/* מסמכים משפטיים — נגישים תמיד, ללא קשר למצב ההתחברות (גם לצוותי
            בדיקה כמו Paddle וגם למשתמשים מחוברים) */}
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </GoogleOAuthProvider>
    </AdsManager>
  );
}
