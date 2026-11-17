// Copia de respaldo de la conexión a Notion en localStorage.
//
// Por qué: Safari en iOS (y a veces otros navegadores móviles) borra las cookies al
// cerrar el navegador aunque tengan 400 días, y entonces habría que reconectar Notion
// cada vez. localStorage sobrevive a ese cierre, así que guardamos acá una copia del
// MISMO valor cifrado de la cookie (el JWE) y /setup la restaura sola si la cookie
// desaparece (ver /api/setup/restore).
//
// Seguridad: se guarda solo el JWE opaco, cifrado con el secreto del servidor; nunca
// el token de Notion en claro. Trade-off aceptado por el dueño: a diferencia de la
// cookie httpOnly, cualquier JS de este origen puede leer ese valor, y quien lo robe
// puede usarlo como credencial hasta que venza o se rote AUTH_COOKIE_SECRET. Por eso
// se borra al desconectar, cuando Notion rechaza el token y cuando el servidor dice
// que la copia ya no sirve.
//
// Módulo seguro para el cliente: sin imports de Next. Todo acceso va en try/catch
// porque localStorage puede faltar o lanzar (modo privado, almacenamiento bloqueado).

const KEY = "um.conn";

export function readConnBackup(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveConnBackup(v: string): void {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* ignore */
  }
}

export function clearConnBackup(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
