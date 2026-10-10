/** Datos de sesión que también usa el middleware (Edge). */
export const SESSION_COOKIE = "genera_session";

export function authSecret(): string {
  return process.env.AUTH_SECRET || "genera-os-dev-secret-cambie-AUTH_SECRET";
}
