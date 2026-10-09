import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Protege toda la app con HTTP Basic Auth. Usuario/contraseña vienen de env
// (APP_USERNAME / APP_PASSWORD) para no quedar hardcodeados en el código.
export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next(); // sin contraseña configurada, no bloquea

  const username = process.env.APP_USERNAME ?? "admin";
  const auth = req.headers.get("authorization");

  if (auth?.startsWith("Basic ")) {
    let decoded = "";
    try {
      decoded = atob(auth.slice(6));
    } catch {
      // cabecera mal formada: se trata como credenciales inválidas
    }
    // Solo el primer ":" separa usuario y contraseña; la contraseña puede contener ":".
    const sep = decoded.indexOf(":");
    const user = sep >= 0 ? decoded.slice(0, sep) : "";
    const pass = sep >= 0 ? decoded.slice(sep + 1) : "";
    if (sep >= 0 && user === username && pass === password) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Autenticación requerida.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Interactive Comics"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
