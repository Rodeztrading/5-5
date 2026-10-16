import { useState, useEffect } from 'react';
import {
    User,
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

const getAuthErrorMessage = (error: unknown): string => {
    if (typeof error === 'object' && error !== null && 'code' in error) {
        const code = String(error.code);
        if (code === 'auth/unauthorized-domain') {
            return 'Este dominio no está autorizado en Firebase Authentication.';
        }
        if (code === 'auth/operation-not-allowed') {
            return 'El acceso con Google no está habilitado en Firebase Authentication.';
        }
    }

    return error instanceof Error
        ? error.message
        : 'No pudimos completar el inicio de sesión. Inténtalo nuevamente.';
};

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
        let redirectError: string | null = null;

        console.log('[Auth] Hook initialized, checking state...');

        const finalize = () => {
            if (isMounted && redirectChecked && authStateReceived) {
                console.log('[Auth] Finalizing auth state. User:', finalUser?.email || 'Guest');
                setAuthState({
                    user: finalUser,
                    loading: false,
                    error: redirectError
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
                const code = typeof error?.code === 'string' ? error.code : 'unknown';
                redirectError = `Error (${code}): ${getAuthErrorMessage(error)}`;
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
            await signInWithRedirect(auth, googleProvider);
        } catch (error: any) {
            console.error('[Auth] Login error:', error);
            const code = typeof error?.code === 'string' ? error.code : 'unknown';
            setAuthState(prev => ({
                ...prev,
                loading: false,
                error: `Error (${code}): ${getAuthErrorMessage(error)}`
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
