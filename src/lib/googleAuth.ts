import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Permissões obrigatórias para ler e gravar planilhas no Google Drive
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

export const googleSignIn = async () => {
  try {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    } else {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken || null;
      if (accessToken) {
        localStorage.setItem('wealthflow_google_token', accessToken);
      }
      return { user: result.user, accessToken };
    }
  } catch (error: any) {
    console.error("Erro no login com Google:", error);
    throw error;
  }
};

export const initAuth = (onUserLogin: (user: any, token: string | null) => void, onUserLogout: () => void) => {
  // Captura o token retornado do redirecionamento no celular
  getRedirectResult(auth).then((result) => {
    if (result) {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken || null;
      if (token) {
        localStorage.setItem('wealthflow_google_token', token);
      }
      onUserLogin(result.user, token);
    }
  }).catch((err) => {
    console.error("Erro no Redirect Result:", err);
  });

  return onAuthStateChanged(auth, (user) => {
    if (user) {
      const savedToken = localStorage.getItem('wealthflow_google_token');
      onUserLogin(user, savedToken);
    } else {
      localStorage.removeItem('wealthflow_google_token');
      onUserLogout();
    }
  });
};

export const logout = async () => {
  localStorage.removeItem('wealthflow_google_token');
  await signOut(auth);
};
