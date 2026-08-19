import React, { useState } from 'react';
import type { ChangeEvent, SyntheticEvent } from 'react';
import './App.css';


type View = 'parent-signup' | 'parent-login' | 'member-login' | 'family-dashboard'

export default function App(): React.ReactNode {
  const [view, setView] = useState<View>('parent-signup')

  const [parentSignup, setParentSignup] = useState({ name: '', email: '', password: '' })
  const [parentLogin, setParentLogin] = useState({ email: '', password: '' })
  const [memberLogin, setMemberLogin] = useState({ id: '', pin: '' })

  const handleSignupChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setParentSignup(prev => ({ ...prev, [name]: value }));
  };

  const handleLoginChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setParentLogin(prev => ({ ...prev, [name]: value }));
  };

  const handleMemberChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setMemberLogin(prev => ({ ...prev, [name]: value }));
  };


  function submitParentSignup(e: SyntheticEvent) {
    e.preventDefault()
    console.log('Parent signup', parentSignup)
    setView('family-dashboard')
  }

  function submitParentLogin(e: SyntheticEvent) {
    e.preventDefault()
    console.log('Parent login', parentLogin)
    setView('family-dashboard')
  }

  function submitMemberLogin(e: SyntheticEvent) {
    e.preventDefault()
    console.log('Member login', memberLogin)
    setView('family-dashboard')
  }

  const tabs: { key: View; label: string }[] = [
    { key: 'parent-signup', label: 'הרשמת הורה' },
    { key: 'parent-login', label: 'כניסת הורים' },
    { key: 'member-login', label: 'כניסת ילדים' },
  ]

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-gradient-to-b from-slate-800/80 to-slate-900/80 rounded-2xl shadow-2xl ring-1 ring-slate-700 p-6">
        <header className="text-center mb-4">
          <div className="mx-auto w-20 h-20 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-xl font-bold text-white">תוצרים</span>
          </div>
          <h1 className="mt-3 text-white text-2xl font-semibold">ChoreChamps</h1>
          <p className="mt-1 text-slate-300 text-sm">ברוכים הבאים — בחרו דרך כניסה</p>
        </header>

        <nav className="mb-5">
          <div className="flex gap-2 justify-center">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setView(t.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-150 ${
                  view === t.key
                    ? 'bg-indigo-500 text-white shadow-md'
                    : 'bg-slate-700/40 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>

        <main>
          {view === 'parent-signup' && (
            <form onSubmit={submitParentSignup} className="space-y-4">
              <label className="block text-slate-200 text-sm">שם</label>
              <input
                name="name"
                value={parentSignup.name}
                onChange={handleSignupChange}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-400 ring-1 ring-slate-700 focus:outline-none focus:ring-indigo-400"
                placeholder="שמך המלא"
                required
              />

              <label className="block text-slate-200 text-sm">אימייל</label>
              <input
                name="email"
                type="email"
                value={parentSignup.email}
                onChange={handleSignupChange}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-400 ring-1 ring-slate-700 focus:outline-none focus:ring-indigo-400"
                placeholder="example@domain.co.il"
                required
              />

              <label className="block text-slate-200 text-sm">סיסמה</label>
              <input
                name="password"
                type="password"
                value={parentSignup.password}
                onChange={handleSignupChange}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-400 ring-1 ring-slate-700 focus:outline-none focus:ring-indigo-400"
                placeholder="בחר סיסמה חזקה"
                required
              />

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold shadow-lg"
                >
                  צור חשבון הורה
                </button>
              </div>
            </form>
          )}

          {view === 'parent-login' && (
            <form onSubmit={submitParentLogin} className="space-y-4">
              <label className="block text-slate-200 text-sm">אימייל</label>
              <input
                name="email"
                type="email"
                value={parentLogin.email}
                onChange={handleLoginChange}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-400 ring-1 ring-slate-700 focus:outline-none focus:ring-indigo-400"
                placeholder="example@domain.co.il"
                required
              />

              <label className="block text-slate-200 text-sm">סיסמה</label>
              <input
                name="password"
                type="password"
                value={parentLogin.password}
                onChange={handleLoginChange}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-400 ring-1 ring-slate-700 focus:outline-none focus:ring-indigo-400"
                placeholder="הכנס סיסמה"
                required
              />

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-2 rounded-full bg-emerald-500 text-white font-semibold shadow-md"
                >
                  כניסת הורה
                </button>
              </div>
            </form>
          )}

          {view === 'member-login' && (
            <form onSubmit={submitMemberLogin} className="space-y-4">
              <label className="block text-slate-200 text-sm">תעודת משתמש / מזהה פרופיל</label>
              <input
                name="id"
                value={memberLogin.id}
                onChange={handleMemberChange}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-400 ring-1 ring-slate-700 focus:outline-none focus:ring-indigo-400"
                placeholder="הכנס מזהה"
                required
              />

              <label className="block text-slate-200 text-sm">סיסמה / PIN</label>
              <input
                name="pin"
                type="password"
                value={memberLogin.pin}
                onChange={handleMemberChange}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white placeholder-slate-400 ring-1 ring-slate-700 focus:outline-none focus:ring-indigo-400"
                placeholder="הזן PIN"
                required
              />

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-2 rounded-full bg-indigo-600 text-white font-semibold shadow-md"
                >
                  כניסת ילד/ה
                </button>
              </div>
            </form>
          )}

          {view === 'family-dashboard' && (
            <div className="py-8 text-center">
              <h2 className="text-white text-xl font-semibold">ברוכים הבאים ל-ChoreChamps</h2>
              <p className="text-slate-300 mt-2">זהו מסך דמו של דשבורד משפחתי</p>
              <div className="mt-6">
                <button
                  onClick={() => setView('parent-signup')}
                  className="px-4 py-2 rounded-full bg-slate-700 text-slate-100"
                >
                  חזור לכניסה
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
