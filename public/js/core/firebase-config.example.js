// Copia este archivo como `firebase-config.js` y pega los datos que te da la
// consola de Firebase en:  Configuración del proyecto > Tus apps > Web.
// `firebase-config.js` está en .gitignore a propósito: no se sube al repo.
export const firebaseConfig = {
  apiKey: 'PEGAR_AQUI',
  authDomain: 'kamilux-store.firebaseapp.com',
  projectId: 'kamilux-store',
  storageBucket: 'kamilux-store.firebasestorage.app',
  messagingSenderId: 'PEGAR_AQUI',
  appId: 'PEGAR_AQUI',
};

// Id del negocio dentro de Firestore. Con un solo local, se deja así.
//
// MODO DEMO: entrar con `?demo` cambia al negocio `demo` (datos inventados, ver
// scripts/sembrar-demo.mjs). Se recuerda en el navegador hasta "Salir del demo".
function esModoDemo() {
  try {
    if (new URLSearchParams(location.search).has('demo')) localStorage.setItem('kamilux_demo', '1');
    return localStorage.getItem('kamilux_demo') === '1';
  } catch { return false; }
}
export const MODO_DEMO = esModoDemo();
export const NEGOCIO_ID = MODO_DEMO ? 'demo' : 'kamilux';

// Usar los emuladores cuando se abre en localhost (no toca los datos reales).
export const USAR_EMULADORES = true;
