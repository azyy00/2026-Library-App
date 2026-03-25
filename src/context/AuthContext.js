import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi, clearStoredAuthToken, getStoredAuthToken, setStoredAuthToken } from '../services/api';

const AuthContext = createContext(null);

const DEFAULT_AUTH_STATE = {
  employee: null,
  isAuthenticated: false,
  isBootstrapping: true
};

const syncAuthEventName = 'library-auth-state-change';

const dispatchAuthSyncEvent = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(syncAuthEventName));
};

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(DEFAULT_AUTH_STATE);
  const setSignedInState = (employee) => {
    setAuthState({
      employee,
      isAuthenticated: true,
      isBootstrapping: false
    });
  };

  useEffect(() => {
    let isMounted = true;

    const updateStateFromToken = async () => {
      const token = getStoredAuthToken();

      if (!token) {
        if (isMounted) {
          setAuthState({
            employee: null,
            isAuthenticated: false,
            isBootstrapping: false
          });
        }

        return;
      }

      try {
        const response = await authApi.getSession();

        if (isMounted) {
          setAuthState({
            employee: response.data.employee,
            isAuthenticated: true,
            isBootstrapping: false
          });
        }
      } catch (error) {
        clearStoredAuthToken();
        dispatchAuthSyncEvent();

        if (isMounted) {
          setAuthState({
            employee: null,
            isAuthenticated: false,
            isBootstrapping: false
          });
        }
      }
    };

    updateStateFromToken();

    const handleAuthStateChange = () => {
      updateStateFromToken();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(syncAuthEventName, handleAuthStateChange);
      window.addEventListener('storage', handleAuthStateChange);
    }

    return () => {
      isMounted = false;

      if (typeof window !== 'undefined') {
        window.removeEventListener(syncAuthEventName, handleAuthStateChange);
        window.removeEventListener('storage', handleAuthStateChange);
      }
    };
  }, []);

  const login = async (credentials) => {
    const response = await authApi.login(credentials);
    setStoredAuthToken(response.data.token);
    dispatchAuthSyncEvent();
    setSignedInState(response.data.employee);

    return response.data.employee;
  };

  const refreshEmployee = async () => {
    const response = await authApi.getProfile();
    setSignedInState(response.data.employee);
    return response.data.employee;
  };

  const updateEmployeeProfile = async (payload) => {
    const response = await authApi.updateProfile(payload);

    if (response.data.token) {
      setStoredAuthToken(response.data.token);
    }

    dispatchAuthSyncEvent();
    setSignedInState(response.data.employee);
    return response.data;
  };

  const uploadEmployeeProfileImage = async (file) => {
    const formData = new FormData();
    formData.append('profile_image', file);

    const response = await authApi.uploadProfileImage(formData);
    setSignedInState(response.data.employee);
    return response.data;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // The local token is the real gatekeeper, so logout still proceeds offline.
    } finally {
      clearStoredAuthToken();
      dispatchAuthSyncEvent();
      setAuthState({
        employee: null,
        isAuthenticated: false,
        isBootstrapping: false
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        refreshEmployee,
        logout,
        updateEmployeeProfile,
        uploadEmployeeProfileImage
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
};
