// Raymond Digital — Gmail Send Function
// Sends an email via the Gmail API using a stored refresh token.
// Never exposes tokens or client secrets to the browser.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://supabase.com/functions/dependencies/src/supabase-client.ts";

// ---------- Configuration ----------
// These MUST be set as Supabase secrets (never in source or frontend):
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

// Authorized admin UID — must match the user who connected Gmail
const AUTHORIZED_ADMIN_UID = "ac1aaa20-46ae-42c6-9e70-942cd7ef6885";

// Gmail API endpoint
const GMAIL_API_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

// OAuth token endpoint
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

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

// ---------- MIME message construction ----------
/**
 * Construct a plain-text MIME message and return its base64url-encoded raw string.
 * The sender (From:) will be the connected Gmail account — set by Gmail API
 * when sending as the authenticated user.
 *
 * Uses quoted-printable encoding for special characters and UTF-8 safety.
 */
function createMimeMessage(to: string, subject: string, body: string): string {
  // Sanitize headers to prevent header injection
  const safeTo = to.replace(/[\r\n]/g, "");
  const safeSubject = subject.replace(/[\r\n]/g, "");
  const safeBody = body.replace(/[\r\n]/g, "\r\n");

  // Build the MIME message headers
  const mimeHeaders = [
    `To: ${safeTo}`,
    `Subject: =?UTF-8?Q?${encodeQuotedPrintable(safeSubject)}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: quoted-printable",
  ].join("\r\n");

  const mimeBody = safeBody;

  // Combine headers and body
  const mime = mimeHeaders + "\r\n\r\n" + mimeBody;

  // Base64url-encode the MIME message (no padding, no line breaks)
  return base64urlEncode(mime);
}

// ---------- Quoted-printable encoding for headers ----------
function encodeQuotedPrintable(str: string): string {
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 33 && code <= 126 && code !== 61) {
      // Printable ASCII except '='
      result += str[i];
    } else if (code === 32 && i < str.length - 1 && str.charCodeAt(i + 1) === 9) {
      // Space before tab: encode space
      result += "=20";
    } else if (code === 9) {
      result += "=09";
    } else {
      result += `=${code.toString(16).toUpperCase().padStart(2, "0")}`;
    }
  }
  return result;
}

// ---------- Main Handler ----------
serve(async (req: Request) => {
  // ---- CORS preflight ----
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  }

  // ---- Only accept POST ----
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed. Use POST." }),
      {
        status: 405,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  }

  // ---- Parse JSON body: { to, subject, body } ----
  let requestBody: { to: string; subject: string; body: string };
  try {
    requestBody = await req.json();
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { to, subject, body } = requestBody;

  // ---- Validate required fields ----
  if (!to || !subject || !body) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing required fields: to, subject, body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // ---- Validate email address format ----
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid recipient email address" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // ---- Validate subject and body length ----
  if (subject.length > 200) {
    return new Response(
      JSON.stringify({ success: false, error: "Subject too long (max 200 characters)" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (body.length > 5000) {
    return new Response(
      JSON.stringify({ success: false, error: "Body too long (max 5000 characters)" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // ---- Verify the Supabase Authorization bearer token ----
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized: missing authorization header" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // ---- Verify the authenticated Supabase user ----
  // Use the anon key to verify the user's session.
  // This validates the bearer token and confirms the user is authenticated.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_ANON_KEY") || "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user || user.id !== AUTHORIZED_ADMIN_UID) {
    return new Response(
      JSON.stringify({ success: false, error: "Forbidden: unauthorized admin account" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // ---- Retrieve the refresh token using service-role context ----
  // Use the Supabase service-role key (no user's Authorization header)
  // to bypass RLS and access gmail_tokens securely.
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";

  const adminSupabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    serviceRoleKey
  );

  // Query gmail_tokens for the authorized admin user
  const { data: tokenRow, error: dbError } = await adminSupabase
    .from("gmail_tokens")
    .select("refresh_token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (dbError) {
    console.error("DB error retrieving refresh token:", dbError);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to retrieve Gmail connection" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // If no refresh token stored, Gmail is not connected
  if (!tokenRow || !tokenRow.refresh_token) {
    return new Response(
      JSON.stringify({ success: false, error: "Gmail account not connected. Please connect Gmail first." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const refreshToken = tokenRow.refresh_token;

  // ---- Exchange refresh token for new access token ----
  const tokenExchangeResponse = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!tokenExchangeResponse.ok) {
    const errorText = await tokenExchangeResponse.text();
    console.error("Google token refresh error:", tokenExchangeResponse.status, errorText);
    return new Response(
      JSON.stringify({ success: false, error: "Google authentication failed. Token may be expired or revoked." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const tokenData = await tokenExchangeResponse.json();
  const accessToken = tokenData.access_token;
  if (!accessToken) {
    return new Response(
      JSON.stringify({ success: false, error: "No access token received from Google" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // **NEVER** write access_token back to the database.
  // The refresh_token in the DB remains unchanged.

  // ---- Call Gmail API to send the message ----
  const mimeRaw = createMimeMessage(to, subject, body);

  const gmailResponse = await fetch(GMAIL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ raw: mimeRaw }),
  });

  // ---- Handle Gmail API response ----
  if (!gmailResponse.ok) {
    const errorBody = await gmailResponse.text();
    console.error("Gmail API error:", gmailResponse.status, errorBody);
    let errorMessage = "Gmail API failed";
    try {
      const errorJson = JSON.parse(errorBody);
      if (errorJson.error && errorJson.error.message) {
        errorMessage = errorJson.error.message;
      }
    } catch {
      // Keep default message
    }
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: gmailResponse.status, headers: { "Content-Type": "application/json" } }
    );
  }

  // ---- Success ----
  const gmailData = await gmailResponse.json();
  const messageId = gmailData.messageId || gmailData.id || "unknown";

  return new Response(
    JSON.stringify({ success: true, data: { messageId } }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    }
  );
});