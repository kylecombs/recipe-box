import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { OAuthService } from "~/services/oauth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirectTo") || "/recipes";
  
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID not configured");
  }

  const redirectUri = `${url.protocol}//${url.host}/auth/google/callback`;
  const state = Buffer.from(JSON.stringify({ redirectTo })).toString("base64");
  
  const authUrl = OAuthService.getGoogleAuthUrl(clientId, redirectUri, state);
  
  return redirect(authUrl);
}