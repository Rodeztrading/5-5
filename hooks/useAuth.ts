import { useState, useEffect } from 'react';
import {
    User,
    signInWithPopup,
    signInWithRedirect,
    signOut,
    onAuthStateChanged,
    getRedirectResult,
    setPersistence,
    browserLocalPersistence
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';

interface AuthState {
    user: User | null;
    loading: boolean;
    error: string | null;
}

export const useAuth = () => {
    const [authState, setAuthState] = useState<AuthState>({
        user: null,
        loading: true,
        error: null,
    });

    useEffect(() => {
        let isMounted = true;
        let redirectChecked = false;
        let authStateReceived = false;
        let finalUser: User | null = null;

        console.log('[Auth] Hook initialized, checking state...');

        const finalize = () => {
            if (isMounted && redirectChecked && authStateReceived) {
                console.log('[Auth] Finalizing auth state. User:', finalUser?.email || 'Guest');
                setAuthState({
                    user: finalUser,
                    loading: false,
                    error: null
                });
            }
        };

        // 1. Check for redirect result (Crucial for Mobile)
        getRedirectResult(auth)
            .then((result) => {
                console.log('[Auth] Redirect check complete. Result:', !!result?.user);
                if (result?.user) finalUser = result.user;
                redirectChecked = true;
                finalize();
            })
            .catch((error) => {
                console.error('[Auth] Redirect error:', error);
                redirectChecked = true;
                finalize();
            });

        // 2. Listen for auth changes
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            console.log('[Auth] onAuthStateChanged fired. User:', user?.email || 'null');
            // If we already have a user from redirect, prioritize it
            if (!finalUser) finalUser = user;
            authStateReceived = true;
            finalize();
        });

        // 3. Fallback timeout (Safety for slow redirects)
        const safetyTimeout = setTimeout(() => {
            if (isMounted && authState.loading) {
                console.warn('[Auth] Safety timeout reached, forcing load.');
                redirectChecked = true;
                authStateReceived = true;
                finalize();
            }
        }, 10000); // 10s is plenty for redirect

        return () => {
            isMounted = false;
            unsubscribe();
            clearTimeout(safetyTimeout);
        };
    }, []);

    const loginWithGoogle = async () => {
        try {
            console.log('[Auth] Initiating Google Login...');
            setAuthState(prev => ({ ...prev, loading: true, error: null }));

            // Try Popup first (works on many modern mobile browsers and is much more stable)
            console.log('[Auth] Attempting signInWithPopup...');
            try {
                const result = await signInWithPopup(auth, googleProvider);
                console.log('[Auth] Popup success!', result.user.email);
            } catch (popupError: any) {
                console.warn('[Auth] Popup failed or blocked:', popupError.code);

                // If it's a mobile device and popup failed/blocked, fall back to redirect
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                if (isMobile || popupError.code === 'auth/popup-blocked') {
                    console.log('[Auth] Falling back to signInWithRedirect...');
                    await signInWithRedirect(auth, googleProvider);
                } else {
                    throw popupError;
                }
            }
        } catch (error: any) {
            console.error('[Auth] Login error:', error);
            setAuthState(prev => ({
                ...prev,
                loading: false,
                error: `Error (${error.code || 'unknown'}): ${error.message}`
            }));
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
        } catch (error: any) {
            console.error('Error signing out:', error);
            setAuthState(prev => ({
                ...prev,
                error: error.message || 'Error al cerrar sesión',
            }));
        }
    };

    return {
        user: authState.user,
        loading: authState.loading,
        error: authState.error,
        loginWithGoogle,
        logout,
    };
};
