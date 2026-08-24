import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import type { CredentialResponse } from '@react-oauth/google';
import axios from 'axios';
import api from '../services/api';
import type { SafeUser } from '../App';

interface GoogleAuthButtonProps {
  onAuth: (token: string, user: SafeUser) => void;
  onError: (message: string) => void;
  /** Present only on the signup flow's co-parent join link (?inviteCode=...). */
  inviteCode?: string | null;
  /**
   * 'login' (the /login page): authenticates an existing account only — the
   * server rejects a Google account with no matching user instead of
   * creating one. 'signup' (the /signup page): creates a new account (Flow A
   * or, with inviteCode, Flow B) when no matching user exists yet.
   */
  mode: 'signup' | 'login';
}

/**
 * Shared "Continue with Google" button for parents — used on both the signup
 * page (Flow A: brand-new family, or Flow B: join via inviteCode) and the
 * login page (returning parent). Never shown to children, who always sign in
 * with familyCode + PIN.
 */
export default function GoogleAuthButton({ onAuth, onError, inviteCode, mode }: GoogleAuthButtonProps): React.ReactNode {
  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      onError('לא התקבל אישור מ-Google, נסו שוב');
      return;
    }

    try {
      const response = await api.post('/api/auth/google', {
        credentialToken: credentialResponse.credential,
        inviteCode: inviteCode || undefined,
        intent: mode,
      });
      const { token, user } = response.data;
      onAuth(token, user);
    } catch (err: unknown) {
      let message = 'ההתחברות עם Google נכשלה, נסו שוב';
      if (axios.isAxiosError(err)) {
        message = err.response?.data?.error || err.message;
      }
      onError(message);
    }
  };

  return (
    <div className="flex justify-center w-full [&>div]:w-full [&_iframe]:!w-full">
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => onError('ההתחברות עם Google נכשלה, נסו שוב')}
        theme="filled_black"
        shape="pill"
        text="continue_with"
        width="320"
      />
    </div>
  );
}
