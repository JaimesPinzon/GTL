import assert from "node:assert/strict";

const backendUrl = String(
  process.env.GTL_AUTH_PRODUCTION_URL || "https://api.globaltradelab.site"
).replace(/\/$/, "");
const frontendOrigin = String(
  process.env.GTL_FRONTEND_PRODUCTION_ORIGIN || "https://globaltradelab.site"
).replace(/\/$/, "");

const csrfResponse = await fetch(`${backendUrl}/api/auth/csrf`, {
  headers: {
    Origin: frontendOrigin,
  },
});

assert.equal(csrfResponse.status, 200, "GET /api/auth/csrf must respond with 200");
assert.equal(
  csrfResponse.headers.get("access-control-allow-origin"),
  frontendOrigin,
  "The production frontend origin must be allowed"
);
assert.equal(
  csrfResponse.headers.get("access-control-allow-credentials"),
  "true",
  "Credentialed CORS must be enabled"
);

const setCookie = csrfResponse.headers.get("set-cookie") || "";
assert.match(setCookie, /(?:^|,\s*)(?:__Host-)?gtl_csrf=([^;]+)/, "The CSRF cookie is missing");
assert.match(setCookie, /;\s*Secure(?:;|$)/i, "The CSRF cookie must be Secure");

const csrfPayload = await csrfResponse.json();
const csrfToken = String(csrfPayload?.csrfToken || "");
assert.ok(csrfToken, "The CSRF token is missing from the JSON response");

const cookieName = setCookie.includes("__Host-gtl_csrf=") ? "__Host-gtl_csrf" : "gtl_csrf";
const cookieToken = setCookie.match(new RegExp(`${cookieName}=([^;]+)`))?.[1] || "";
assert.equal(cookieToken, csrfToken, "The cookie and JSON CSRF tokens must match");

const refreshResponse = await fetch(`${backendUrl}/api/auth/refresh`, {
  method: "POST",
  headers: {
    Cookie: `${cookieName}=${cookieToken}`,
    Origin: frontendOrigin,
    "X-CSRF-Token": csrfToken,
  },
});
const refreshPayload = await refreshResponse.json().catch(() => ({}));

assert.notEqual(refreshResponse.status, 403, "A matching CSRF cookie/header pair must not be rejected");
assert.equal(refreshResponse.status, 401, "The credential-free probe must stop at the missing refresh cookie");
assert.equal(refreshPayload?.error, "Refresh cookie is missing.");

console.log(`Auth production verification passed for ${backendUrl}`);
