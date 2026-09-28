import { middleware } from "../src/proxy";
import { NextRequest } from "next/server";

function createMockRequest(url: string, cookieValue?: string) {
  const req = new NextRequest(new URL(url, "http://localhost:3000"));
  if (cookieValue) {
    req.cookies.set("kickoff_session", cookieValue);
  }
  return req;
}

async function runAuthTests() {
  console.log("=================================================================");
  console.log("TESTING AUTHENTICATION & VALIDATION ON EVERY PAGE");
  console.log("=================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Unauthenticated access to protected pages
  const protectedPages = [
    "/",
    "/admin",
    "/match/991",
    "/team/1",
    "/player/1",
    "/tournament/1",
  ];

  console.log("--- 1. Testing Unauthenticated Access Blocks on Every Page ---");
  for (const page of protectedPages) {
    const req = createMockRequest(`http://localhost:3000${page}`);
    const res = middleware(req);
    const redirectLocation = res.headers.get("location");
    const isRedirectedToSignIn =
      redirectLocation !== null &&
      redirectLocation.includes("/sign-in");

    assert(
      isRedirectedToSignIn,
      `Unauthenticated request to "${page}" is blocked and redirected to /sign-in (Redirect: ${redirectLocation})`
    );
  }

  // 2. Authenticated access to protected pages
  console.log("\n--- 2. Testing Authenticated Access Allows Every Page ---");
  const dummyToken = "valid.test.jwt.token";
  for (const page of protectedPages) {
    const req = createMockRequest(`http://localhost:3000${page}`, dummyToken);
    const res = middleware(req);
    const redirectLocation = res.headers.get("location");
    const isAllowed = redirectLocation === null;

    assert(
      isAllowed,
      `Authenticated request with session to "${page}" is allowed to proceed`
    );
  }

  // 3. Public Auth Pages (/sign-in, /sign-up)
  console.log("\n--- 3. Testing Public Auth Pages ---");
  const unauthSignIn = middleware(createMockRequest("http://localhost:3000/sign-in"));
  assert(
    unauthSignIn.headers.get("location") === null,
    "Unauthenticated user can access /sign-in"
  );

  const unauthSignUp = middleware(createMockRequest("http://localhost:3000/sign-up"));
  assert(
    unauthSignUp.headers.get("location") === null,
    "Unauthenticated user can access /sign-up"
  );

  // Authenticated user accessing /sign-in should be redirected to home /
  const authSignIn = middleware(createMockRequest("http://localhost:3000/sign-in", dummyToken));
  assert(
    authSignIn.headers.get("location") === "http://localhost:3000/",
    "Already authenticated user is redirected away from /sign-in to /"
  );

  console.log("\n=================================================================");
  console.log(`AUTH TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runAuthTests().catch(console.error);
