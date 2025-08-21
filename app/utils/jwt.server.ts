import { redirect } from "@remix-run/node";

export async function requireAuth(request: Request) {
  try {
    const { AuthService } = await import("~/services/auth.server");
    const token = AuthService.extractTokenFromRequest(request);
    
    if (!token) {
      throw redirect("/login");
    }

    const user = await AuthService.getUserFromToken(token);
    if (!user) {
      throw redirect("/login");
    }
    return user;
  } catch (error) {
    throw redirect("/login");
  }
}

export async function getOptionalUser(request: Request) {
  try {
    const { AuthService } = await import("~/services/auth.server");
    const token = AuthService.extractTokenFromRequest(request);
    
    if (!token) {
      return null;
    }

    return await AuthService.getUserFromToken(token);
  } catch (error) {
    return null;
  }
}

export function createAuthCookie(token: string) {
  // Don't set Secure flag for localhost development
  const isProduction = process.env.NODE_ENV === 'production';
  const secure = isProduction ? '; Secure' : '';
  return `auth_token=${token}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`;
}

export function destroyAuthCookie() {
  const isProduction = process.env.NODE_ENV === 'production';
  const secure = isProduction ? '; Secure' : '';
  return `auth_token=; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=0`;
}