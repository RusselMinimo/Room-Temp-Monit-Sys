import { NextRequest, NextResponse } from "next/server";

import { appendAuthLog } from "@/lib/auth-logs";
import { createSession } from "@/lib/auth";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_REDIRECT_PATH = "/api/auth/google/callback";

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  id_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

interface GoogleUserInfoResponse {
  email?: string;
  name?: string;
  picture?: string;
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const origin = request.nextUrl.origin;
  const redirectToLogin = NextResponse.redirect(new URL("/login", origin));

  if (!clientId || !clientSecret) {
    return redirectToLogin;
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return redirectToLogin;
  }

  if (!code) {
    return redirectToLogin;
  }

  const redirectUri = `${origin}${GOOGLE_REDIRECT_PATH}`;

  try {
    const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      return redirectToLogin;
    }

    const tokenJson = (await tokenResponse.json()) as GoogleTokenResponse;
    const accessToken = tokenJson.access_token;

    if (!accessToken) {
      return redirectToLogin;
    }

    const userInfoResponse = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userInfoResponse.ok) {
      return redirectToLogin;
    }

    const userInfo = (await userInfoResponse.json()) as GoogleUserInfoResponse;
    const email = userInfo.email?.trim().toLowerCase();

    if (!email) {
      return redirectToLogin;
    }

    await createSession(email);

    appendAuthLog({
      email,
      event: "login_success",
      details: "google_oauth",
    });

    const { isAdminUser } = await import("@/lib/users");
    const isAdmin = isAdminUser(email);

    return NextResponse.redirect(
      new URL(isAdmin ? "/admin-dashboard" : "/user-dashboard", origin),
    );
  } catch {
    return redirectToLogin;
  }
}


