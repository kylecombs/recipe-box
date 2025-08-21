import { redirect } from "@remix-run/node";

export async function requireUserId(request: Request): Promise<string> {
  try {
    const { requireAuth } = await import("./jwt.server");
    const user = await requireAuth(request);
    return user.id;
  } catch (error) {
    throw redirect("/login");
  }
}

export async function getUserId(request: Request): Promise<string | null> {
  try {
    const { getOptionalUser } = await import("./jwt.server");
    const user = await getOptionalUser(request);
    return user?.id || null;
  } catch (error) {
    return null;
  }
}