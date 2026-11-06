// foto-chica.js — una foto del teléfono, reducida para guardarla dentro del documento.
//
// Sirve para la garantía de un San: una foto del objeto y ya. Se baja a 720 px
// de lado largo y calidad media (unos 50-90 KB), que cabe de sobra en Firestore
// y no obliga a encender Storage solo para esto.
export function comprimirFoto(archivo, lado = 720, calidad = 0.65) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, lado / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolver(c.toDataURL('image/jpeg', calidad));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('No se pudo leer la foto.')); };
    img.src = url;
  });
}
