import { redirect } from "@remix-run/node";
import { getSession } from "./session.server";

export async function requireUserId(request: Request): Promise<string> {
  const session = await getSession(request.headers.get("Cookie"));
  const userId = session.get("userId");
  
  if (!userId) {
    throw redirect("/login");
  }
  
  return userId;
}

export async function getUserId(request: Request): Promise<string | null> {
  const session = await getSession(request.headers.get("Cookie"));
  return session.get("userId") || null;
}