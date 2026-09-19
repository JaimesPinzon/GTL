import assert from "node:assert/strict";

const backendUrl = String(
  process.env.GTL_AUTH_PRODUCTION_URL || "https://api.globaltradelab.site"
).replace(/\/$/, "");
const frontendOrigin = String(
  process.env.GTL_FRONTEND_PRODUCTION_ORIGIN || "https://globaltradelab.site"
).replace(/\/$/, "");
const smokeEmail = String(process.env.GTL_AUTH_SMOKE_EMAIL || "").trim();
const smokePassword = String(process.env.GTL_AUTH_SMOKE_PASSWORD || "");

const readAuthCookies = (response) => {
  const rawCookies = response.headers.getSetCookie?.() || [response.headers.get("set-cookie") || ""];
  const cookies = new Map();
  for (const rawCookie of rawCookies) {
    const pattern = /(?:^|,\s*)((?:__Host-)?gtl_(?:csrf|rt))=([^;]+)/g;
    for (const match of rawCookie.matchAll(pattern)) cookies.set(match[1], match[2]);
  }
  return cookies;
};

const mergeCookies = (target, response) => {
  for (const [name, value] of readAuthCookies(response)) target.set(name, value);
};

const toCookieHeader = (cookies) => [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");

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

if (smokeEmail && smokePassword) {
  const cookies = readAuthCookies(csrfResponse);
  const loginResponse = await fetch(`${backendUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: toCookieHeader(cookies),
      Origin: frontendOrigin,
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify({ email: smokeEmail, password: smokePassword }),
  });
  const loginPayload = await loginResponse.json().catch(() => ({}));
  assert.equal(loginResponse.status, 200, loginPayload?.error || "Authenticated login probe failed");
  mergeCookies(cookies, loginResponse);

  const stableCsrfResponse = await fetch(`${backendUrl}/api/auth/csrf`, {
    headers: { Cookie: toCookieHeader(cookies), Origin: frontendOrigin },
  });
  const stableCsrfPayload = await stableCsrfResponse.json().catch(() => ({}));
  assert.equal(stableCsrfResponse.status, 200);
  assert.equal(stableCsrfPayload?.csrfToken, loginPayload?.csrfToken, "CSRF must remain stable within a refresh session");

  const refreshHeaders = {
    Cookie: toCookieHeader(cookies),
    Origin: frontendOrigin,
    "X-CSRF-Token": loginPayload.csrfToken,
  };
  const [firstRefresh, secondRefresh] = await Promise.all([
    fetch(`${backendUrl}/api/auth/refresh`, { method: "POST", headers: refreshHeaders }),
    fetch(`${backendUrl}/api/auth/refresh`, { method: "POST", headers: refreshHeaders }),
  ]);
  const [firstPayload, secondPayload] = await Promise.all([
    firstRefresh.json().catch(() => ({})),
    secondRefresh.json().catch(() => ({})),
  ]);
  assert.equal(firstRefresh.status, 200, firstPayload?.error || "First concurrent refresh failed");
  assert.equal(secondRefresh.status, 200, secondPayload?.error || "Second concurrent refresh failed");
  assert.equal(firstPayload?.csrfToken, secondPayload?.csrfToken, "Concurrent refreshes must replay one replacement session");
  mergeCookies(cookies, firstRefresh);

  const logoutResponse = await fetch(`${backendUrl}/api/auth/logout`, {
    method: "POST",
    headers: {
      Cookie: toCookieHeader(cookies),
      Origin: frontendOrigin,
      "X-CSRF-Token": firstPayload.csrfToken,
    },
  });
  assert.equal(logoutResponse.status, 200, "Authenticated smoke session cleanup failed");
}

console.log(
  `Auth production verification passed for ${backendUrl}${smokeEmail && smokePassword ? " (authenticated)" : ""}`
);
