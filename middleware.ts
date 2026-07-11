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
    const [user, pass] = atob(auth.slice(6)).split(":");
    if (user === username && pass === password) {
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
