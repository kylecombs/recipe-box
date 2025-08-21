import { redirect } from "@remix-run/node";

export async function requireUserId(request: Request): Promise<string> {
  try {
    // Safely import auth utilities only on server
    if (typeof window !== 'undefined') {
      throw redirect("/login");
    }
    
    const { requireAuth } = await import("~/utils/jwt.server");
    const user = await requireAuth(request);
    return user.id;
  } catch (error) {
    throw redirect("/login");
  }
}

export async function getUserId(request: Request): Promise<string | null> {
  try {
    // Safely import auth utilities only on server
    if (typeof window !== 'undefined') {
      return null;
    }
    
    const { getOptionalUser } = await import("~/utils/jwt.server");
    const user = await getOptionalUser(request);
    return user?.id || null;
  } catch (error) {
    return null;
  }
}