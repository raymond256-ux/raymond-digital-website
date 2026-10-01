// Raymond Digital — Gmail OAuth Auth Function
// Handles the Google OAuth 2.0 authorization code flow
// Connects the admin's Gmail account. The account address is supplied at
// runtime via ADMIN_GMAIL_EMAIL and is never hardcoded in this file.
// Never exposes secrets or tokens to the browser

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";

// ---------- Configuration ----------
// These MUST be set as Supabase secrets (never in source code or frontend):
//   GMAIL_CLIENT_ID
//   GMAIL_CLIENT_SECRET
//   GMAIL_REDIRECT_URI
//   ADMIN_GMAIL_EMAIL
//   SUPABASE_SERVICE_ROLE_KEY

const GMAIL_CLIENT_ID = Deno.env.get("GMAIL_CLIENT_ID");
const GMAIL_CLIENT_SECRET = Deno.env.get("GMAIL_CLIENT_SECRET");

// The redirect URI must byte-match the entry registered in Google Cloud Console.
// The same value is used for BOTH the authorization request and the token
// exchange, so the two can never drift apart.
const GMAIL_REDIRECT_URI = Deno.env.get("GMAIL_REDIRECT_URI");

// The only Google account permitted to own a stored refresh token.
// public.gmail_oauth_tokens is keyed by "email", so this is also the upsert key.
const ADMIN_GMAIL_EMAIL = (Deno.env.get("ADMIN_GMAIL_EMAIL") || "").trim().toLowerCase();

// The authorized admin UID — only this user may connect Gmail
const AUTHORIZED_ADMIN_UID = "ac1aaa20-46ae-42c6-9e70-942cd7ef6885";

// Gmail OAuth scope: permission to send email, plus read-only access to the
// connected account's email address. The second scope is required so the
// callback can prove which Google account actually granted consent.
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const GMAIL_USERINFO_SCOPE = "https://www.googleapis.com/auth/userinfo.email";
const OAUTH_SCOPES = `${GMAIL_SCOPE} ${GMAIL_USERINFO_SCOPE}`;

// OAuth state lifetime: 10 minutes
const STATE_LIFETIME_MS = 10 * 60 * 1000;

// ---------- OAuth 2.0 endpoints ----------
const OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

// ---------- Deno-compatible base64url encoding ----------
// Deno does not have Node.js Buffer available.
// Use Web API TextEncoder + btoa for safe base64url encoding.
function base64urlEncode(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function generateState(): string {
  // 32 bytes = 256 bits of entropy, base64url-encoded
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64urlEncode(String.fromCharCode(...bytes));
}

// ---------- Helper: check if a state is expired ----------
function isStateExpired(createdAt: string): boolean {
  const created = new Date(createdAt).getTime();
  return Date.now() - created > STATE_LIFETIME_MS;
}

// ---------- Response helpers ----------
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function missingRequiredConfig(): string[] {
  const missing: string[] = [];
  if (!GMAIL_CLIENT_ID) missing.push("GMAIL_CLIENT_ID");
  if (!GMAIL_CLIENT_SECRET) missing.push("GMAIL_CLIENT_SECRET");
  if (!GMAIL_REDIRECT_URI) missing.push("GMAIL_REDIRECT_URI");
  if (!ADMIN_GMAIL_EMAIL) missing.push("ADMIN_GMAIL_EMAIL");
  return missing;
}

// Service-role client used for all state and token writes.
// There is deliberately NO fallback to SUPABASE_ANON_KEY: a missing
// service-role key must fail loudly rather than silently degrade privilege.
function getServiceClient(): {
  client: ReturnType<typeof createClient> | null;
  error: Response | null;
} {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    console.error("Missing required configuration: SUPABASE_SERVICE_ROLE_KEY");
    return {
      client: null,
      error: jsonResponse({ success: false, error: "Gmail service is not configured" }, 500),
    };
  }
  return {
    client: createClient(Deno.env.get("SUPABASE_URL") || "", serviceRoleKey),
    error: null,
  };
}

// Verifies the caller is the authorized admin when a Supabase session is
// supplied. Returns a 403 Response if the session is present but invalid.
async function verifyAdminSession(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization") || "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_ANON_KEY") || "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user || user.id !== AUTHORIZED_ADMIN_UID) {
    return jsonResponse(
      { success: false, error: "Forbidden: unauthorized admin account" },
      403
    );
  }
  return null;
}

// ---------- OAuth initiation ----------
// Generates a cryptographically random state, stores it bound to the
// authorized admin UID, and builds the Google authorization URL.
// Returns the URL, or null if the state could not be persisted.
async function createAuthorizationRequest(
  supabaseService: ReturnType<typeof createClient>
): Promise<string | null> {
  const state = generateState();

  // Store the state server-side bound to the authorized admin's user_id.
  // oauth_states is never exposed to the frontend (RLS denies all direct access).
  const { error: dbError } = await supabaseService
    .from("oauth_states")
    .upsert(
      { state, user_id: AUTHORIZED_ADMIN_UID, created_at: new Date().toISOString() },
      { onConflict: "state" }
    );

  if (dbError) {
    console.error("DB error storing OAuth state:", dbError);
    return null;
  }

  const authParams = new URLSearchParams({
    client_id: GMAIL_CLIENT_ID as string,
    redirect_uri: GMAIL_REDIRECT_URI as string,
    response_type: "code",
    scope: OAUTH_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `${OAUTH_AUTHORIZE_URL}?${authParams.toString()}`;
}

// ---------- Success page ----------
function buildSuccessPage(): Response {
  // The browser is currently on the Edge Function URL.
  // We redirect back to the admin dashboard with a status indicator.
  const dashboardUrl = "https://jirvxaavnlbbhblahbdj.supabase.co/admin-dashboard.html";
  return new Response(
    `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Gmail Connection</title></head><body>
<script>
  try {
    sessionStorage.setItem('gmailConnectStatus', 'success');
  } catch(e) {}
  window.location.href = '${dashboardUrl}';
</script>
<p>Gmail connection successful. Redirecting...</p>
</body></html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

// ---------- OAuth callback ----------
async function handleCallback(
  url: URL,
  supabaseService: ReturnType<typeof createClient>
): Promise<Response> {
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");

  // ---- Require the state ----
  if (!code || !returnedState) {
    return jsonResponse(
      { success: false, error: "Missing authorization code or state" },
      400
    );
  }

  // ---- Look up the state (service-role context to bypass RLS) ----
  const { data: stateRow, error: stateError } = await supabaseService
    .from("oauth_states")
    .select("*")
    .eq("state", returnedState)
    .maybeSingle();

  if (stateError || !stateRow) {
    // State not found — possible CSRF or expired/reused state
    return jsonResponse({ success: false, error: "Invalid OAuth state" }, 400);
  }

  // ---- Check if state is expired ----
  if (isStateExpired(stateRow.created_at)) {
    await supabaseService.from("oauth_states").delete().eq("state", returnedState);
    return jsonResponse({ success: false, error: "OAuth state expired" }, 400);
  }

  // ---- Verify the state is bound to the authorized admin ----
  if (stateRow.user_id !== AUTHORIZED_ADMIN_UID) {
    await supabaseService.from("oauth_states").delete().eq("state", returnedState);
    return jsonResponse(
      { success: false, error: "Forbidden: unauthorized admin account" },
      403
    );
  }

  // ---- Delete the consumed state immediately (one-time use) ----
  await supabaseService.from("oauth_states").delete().eq("state", returnedState);

  // ---- Exchange authorization code for tokens (server-side only) ----
  const tokenResponse = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      grant_type: "authorization_code",
      redirect_uri: GMAIL_REDIRECT_URI,
      code: code,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error("Google token exchange error:", tokenResponse.status, errorText);
    return jsonResponse(
      { success: false, error: "Google authentication failed" },
      500
    );
  }

  const tokenData = await tokenResponse.json();

  // ---- Identify the Google account that granted consent ----
  // This is the identity binding for gmail_oauth_tokens: the stored row is
  // only ever keyed by an account this function has verified as the
  // authorized admin account. Fails closed — nothing is stored without it.
  const accessToken = tokenData.access_token;
  let googleEmail: string | null = null;
  if (accessToken) {
    const infoResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (infoResponse.ok) {
      const info = await infoResponse.json();
      if (info && typeof info.email === "string" && info.email_verified === true) {
        googleEmail = info.email.trim().toLowerCase();
      }
    } else {
      console.error("Google userinfo error:", infoResponse.status);
    }
  }

  if (!googleEmail) {
    return jsonResponse(
      { success: false, error: "Could not verify the connected Google account" },
      500
    );
  }

  if (googleEmail !== ADMIN_GMAIL_EMAIL) {
    console.error("Rejected OAuth callback for unapproved Google account");
    return jsonResponse(
      {
        success: false,
        error: "Forbidden: the connected Google account is not the authorized admin account",
      },
      403
    );
  }

  // ---- Handle refresh token ----
  // If Google returns a new refresh_token, store it.
  // If Google does NOT return a new refresh_token (e.g. user reconnects with
  // same account), do NOT overwrite the existing valid refresh_token.
  const newRefreshToken = tokenData.refresh_token;
  const { data: existingTokenRow } = await supabaseService
    .from("gmail_oauth_tokens")
    .select("refresh_token")
    .eq("email", googleEmail)
    .maybeSingle();

  let refreshTokenToStore: string;
  if (newRefreshToken && newRefreshToken.trim().length > 0) {
    // Google provided a new refresh_token — store it
    refreshTokenToStore = newRefreshToken;
  } else if (
    existingTokenRow &&
    existingTokenRow.refresh_token &&
    existingTokenRow.refresh_token.trim().length > 0
  ) {
    // No new refresh_token from Google, but we have an existing valid one — keep it
    refreshTokenToStore = existingTokenRow.refresh_token;
  } else {
    // No refresh_token available at all
    return jsonResponse(
      { success: false, error: "No refresh token received from Google" },
      500
    );
  }

  // ---- Upsert into gmail_oauth_tokens (keyed by email) ----
  const { error: dbError } = await supabaseService
    .from("gmail_oauth_tokens")
    .upsert(
      {
        email: googleEmail,
        refresh_token: refreshTokenToStore,
        scope: tokenData.scope || OAUTH_SCOPES,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    );

  if (dbError) {
    console.error("DB error storing refresh token:", dbError);
    return jsonResponse(
      { success: false, error: "Failed to store Gmail connection" },
      500
    );
  }

  return buildSuccessPage();
}

// ---------- Main Handler ----------
serve(async (req: Request) => {
  // ---- CORS preflight ----
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  }

  try {
    // ---- Fail fast on missing configuration ----
    const missing = missingRequiredConfig();
    if (missing.length > 0) {
      console.error("Missing required configuration:", missing.join(", "));
      return jsonResponse(
        { success: false, error: "Gmail service is not configured" },
        500
      );
    }

    const { client: supabaseService, error: configError } = getServiceClient();
    if (configError || !supabaseService) return configError as Response;

    const url = new URL(req.url);

    // ---- Google returned an error instead of a code (e.g. consent declined) ----
    if (url.searchParams.has("error")) {
      return jsonResponse(
        {
          success: false,
          error: `Google authorization failed: ${url.searchParams.get("error")}`,
        },
        400
      );
    }

    // ---- OAuth callback: GET /gmail-auth?code=...&state=... ----
    if (url.searchParams.has("code") || url.searchParams.has("state")) {
      return await handleCallback(url, supabaseService);
    }

    // ---- Authenticated initiation: POST /gmail-auth ----
    // Retains the strictly stronger authenticated path for clients that can
    // supply a Supabase session.
    if (req.method === "POST") {
      const authHeader = req.headers.get("Authorization") || "";
      if (!authHeader) {
        return jsonResponse(
          { success: false, error: "Unauthorized: missing authorization header" },
          401
        );
      }
      const forbidden = await verifyAdminSession(req);
      if (forbidden) return forbidden;

      const authUrl = await createAuthorizationRequest(supabaseService);
      if (!authUrl) {
        return jsonResponse(
          { success: false, error: "Failed to start OAuth flow" },
          500
        );
      }
      return jsonResponse({ success: true, authUrl });
    }

    // ---- Browser-navigation initiation: GET /gmail-auth ----
    // admin-dashboard.html starts the flow with a top-level navigation, which
    // cannot carry a Supabase Authorization header. Authorization is therefore
    // enforced at the callback instead: the state is bound to
    // AUTHORIZED_ADMIN_UID, is single-use, and expires in 10 minutes, and the
    // Google account that granted consent must equal ADMIN_GMAIL_EMAIL before
    // anything is written. If a session IS supplied, it must be the admin.
    if (req.method === "GET") {
      if (req.headers.get("Authorization")) {
        const forbidden = await verifyAdminSession(req);
        if (forbidden) return forbidden;
      }

      const authUrl = await createAuthorizationRequest(supabaseService);
      if (!authUrl) {
        return jsonResponse(
          { success: false, error: "Failed to start OAuth flow" },
          500
        );
      }

      return new Response(null, {
        status: 302,
        headers: { Location: authUrl },
      });
    }

    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  } catch (err: any) {
    console.error("gmail-auth error:", err);
    return jsonResponse({ success: false, error: "Internal server error" }, 500);
  }
});
