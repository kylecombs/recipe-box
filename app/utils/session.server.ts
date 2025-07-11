import { createCookieSessionStorage } from "@remix-run/node";

const sessionSecret = process.env.SESSION_SECRET || "default-secret-change-this";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "recipe_session",
    secure: process.env.NODE_ENV === "production",
    secrets: [sessionSecret],
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    httpOnly: true,
  },
});

export const { getSession, commitSession, destroySession } = sessionStorage;