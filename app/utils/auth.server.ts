import { redirect } from "@remix-run/node";
import { getSession } from "./session.server";
import { db } from "./db.server";

export async function requireUserId(request: Request): Promise<string> {
  const session = await getSession(request.headers.get("Cookie"));
  const userId = session.get("userId");
  
  if (!userId) {
    throw redirect("/login");
  }
  
  // Ensure user exists in database (for demo purposes)
  if (userId.startsWith("demo-")) {
    await db.user.upsert({
      where: { id: userId },
      update: {
        updatedAt: new Date()
      },
      create: {
        id: userId,
        email: userId.replace("demo-", "").replace("-", "@").replace("-", "."),
        password: "demo-password"
      }
    });
  }
  
  return userId;
}

export async function getUserId(request: Request): Promise<string | null> {
  const session = await getSession(request.headers.get("Cookie"));
  return session.get("userId") || null;
}