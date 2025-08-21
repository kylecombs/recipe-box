import { db } from '~/utils/db.server';
import { AuthService } from './auth.server';
import type { User } from '@prisma/client';

export interface OAuthProfile {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
}

export class OAuthService {
  static async findOrCreateUser(
    provider: string,
    profile: OAuthProfile,
    tokens: OAuthTokens
  ): Promise<User> {
    // Check if OAuth account exists
    const existingOAuth = await db.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId: profile.id,
        },
      },
      include: {
        user: true,
      },
    });

    if (existingOAuth) {
      // Update tokens
      await db.oAuthAccount.update({
        where: { id: existingOAuth.id },
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiry: tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000)
            : null,
        },
      });

      return existingOAuth.user;
    }

    // Check if user with email exists
    const existingUser = await db.user.findUnique({
      where: { email: profile.email },
    });

    if (existingUser) {
      // Link OAuth account to existing user
      await db.oAuthAccount.create({
        data: {
          userId: existingUser.id,
          provider,
          providerUserId: profile.id,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiry: tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000)
            : null,
        },
      });

      return existingUser;
    }

    // Create new user and OAuth account
    const newUser = await db.user.create({
      data: {
        email: profile.email,
        name: profile.name,
        oauthAccounts: {
          create: {
            provider,
            providerUserId: profile.id,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            tokenExpiry: tokens.expires_in
              ? new Date(Date.now() + tokens.expires_in * 1000)
              : null,
          },
        },
      },
    });

    return newUser;
  }

  static getGoogleAuthUrl(clientId: string, redirectUri: string, state?: string) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
    });

    if (state) {
      params.append('state', state);
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  static getGitHubAuthUrl(clientId: string, redirectUri: string, state?: string) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'read:user user:email',
    });

    if (state) {
      params.append('state', state);
    }

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  static async exchangeGoogleCode(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ): Promise<{ tokens: OAuthTokens; profile: OAuthProfile }> {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for tokens');
    }

    const tokens = await tokenResponse.json() as OAuthTokens;

    // Get user profile
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!profileResponse.ok) {
      throw new Error('Failed to fetch user profile');
    }

    const profileData = await profileResponse.json();

    const profile: OAuthProfile = {
      id: profileData.id,
      email: profileData.email,
      name: profileData.name,
      picture: profileData.picture,
    };

    return { tokens, profile };
  }

  static async exchangeGitHubCode(
    code: string,
    clientId: string,
    clientSecret: string
  ): Promise<{ tokens: OAuthTokens; profile: OAuthProfile }> {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for tokens');
    }

    const tokenData = await tokenResponse.json();
    const tokens: OAuthTokens = {
      access_token: tokenData.access_token,
      token_type: tokenData.token_type,
    };

    // Get user profile
    const profileResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!profileResponse.ok) {
      throw new Error('Failed to fetch user profile');
    }

    const profileData = await profileResponse.json();

    // Get primary email
    const emailResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    const emails = await emailResponse.json();
    const primaryEmail = emails.find((e: any) => e.primary)?.email || profileData.email;

    const profile: OAuthProfile = {
      id: profileData.id.toString(),
      email: primaryEmail,
      name: profileData.name || profileData.login,
      picture: profileData.avatar_url,
    };

    return { tokens, profile };
  }
}