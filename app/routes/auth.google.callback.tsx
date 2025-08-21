import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect, json } from "@remix-run/node";
import { OAuthService } from "~/services/oauth.server";
import { AuthService } from "~/services/auth.server";
import { createAuthCookie } from "~/utils/jwt.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  
  if (!code) {
    return json({ error: "No authorization code provided" }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth not configured");
  }

  const redirectUri = `${url.protocol}//${url.host}/auth/google/callback`;
  
  try {
    const { tokens, profile } = await OAuthService.exchangeGoogleCode(
      code,
      clientId,
      clientSecret,
      redirectUri
    );

    const user = await OAuthService.findOrCreateUser("google", profile, tokens);
    const { accessToken } = AuthService.generateTokens(user);

    let redirectTo = "/recipes";
    if (state) {
      try {
        const stateData = JSON.parse(Buffer.from(state, "base64").toString());
        redirectTo = stateData.redirectTo || redirectTo;
      } catch {}
    }

    return redirect(redirectTo, {
      headers: {
        "Set-Cookie": createAuthCookie(accessToken),
      },
    });
  } catch (error) {
    console.error("Google OAuth error:", error);
    return redirect("/login?error=oauth_failed");
  }
}