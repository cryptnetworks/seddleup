"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { resendVerificationEmail } from "@/lib/actions";

type LoginResponse =
  | { ok: true; loginToken: string }
  | {
      ok: false;
      error:
        | "INVALID_CREDENTIALS"
        | "EMAIL_VERIFICATION_REQUIRED"
        | "MFA_REQUIRED"
        | "INVALID_MFA_CODE"
        | "MFA_MISCONFIGURED"
        | "LOGIN_FAILED";
      method?: "email" | "authenticator";
    };

async function readLoginResponse(response: Response): Promise<LoginResponse> {
  try {
    return (await response.json()) as LoginResponse;
  } catch {
    return { ok: false, error: "LOGIN_FAILED" };
  }
}

function localRedirectPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const pendingPasswordRef = useRef("");
  const handledOAuthTokenRef = useRef<string | null>(null);
  const [requiresCode, setRequiresCode] = useState<"email" | "authenticator" | null>(null);
  const [isPending, setIsPending] = useState(false);
  const oauthComplete = searchParams.get("oauth") === "complete";

  function clearPendingLogin() {
    pendingPasswordRef.current = "";
    setRequiresCode(null);
  }

  useEffect(() => {
    if (!oauthComplete) return;
    if (handledOAuthTokenRef.current === "complete") return;
    handledOAuthTokenRef.current = "complete";

    let cancelled = false;
    async function finishOAuthLogin() {
      const result = await signIn("credentials", {
        email: "oauth@example.com",
        oauthLoginToken: "cookie",
        redirect: false
      });

      if (cancelled) return;
      if (result?.error) {
        setError("OAuth sign-in could not be completed.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    }

    void finishOAuthLogin();
    return () => {
      cancelled = true;
    };
  }, [oauthComplete, router]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const emailValue = requiresCode ? email : String(formData.get("email") || "");
    const passwordValue = requiresCode
      ? pendingPasswordRef.current
      : String(formData.get("password") || "");
    const twoFactorCode = requiresCode ? String(formData.get("twoFactorCode") || "") : undefined;

    if (requiresCode && (!emailValue || !passwordValue)) {
      clearPendingLogin();
      setIsPending(false);
      setError("Invalid email or password.");
      return;
    }

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: emailValue,
        password: passwordValue,
        twoFactorCode
      })
    });
    const loginResult = await readLoginResponse(response);

    setIsPending(false);

    if (!loginResult.ok) {
      setEmail(emailValue);
      if (loginResult.error === "EMAIL_VERIFICATION_REQUIRED") {
        setError("Verify your email before logging in.");
        return;
      }
      if (loginResult.error === "MFA_REQUIRED" && loginResult.method === "email") {
        setEmail(emailValue);
        pendingPasswordRef.current = passwordValue;
        setRequiresCode("email");
        setError("Enter the six-digit code sent to your email.");
        return;
      }
      if (loginResult.error === "MFA_REQUIRED" && loginResult.method === "authenticator") {
        setEmail(emailValue);
        pendingPasswordRef.current = passwordValue;
        setRequiresCode("authenticator");
        setError("Enter the six-digit code from your authenticator app.");
        return;
      }
      if (loginResult.error === "INVALID_MFA_CODE") {
        setError("Invalid MFA code.");
        return;
      }
      if (loginResult.error === "MFA_MISCONFIGURED") {
        setError("Two-factor sign-in is not configured correctly. Contact an administrator.");
        return;
      }
      if (loginResult.error === "LOGIN_FAILED") {
        setError("Login could not be completed. Try again.");
        return;
      }
      clearPendingLogin();
      setError("Invalid email or password.");
      return;
    }

    clearPendingLogin();
    const result = await signIn("credentials", {
      email: "verified-login@example.com",
      loginToken: loginResult.loginToken,
      redirect: false
    });

    if (result?.error) {
      setError("Login could not be completed.");
      return;
    }

    router.push(localRedirectPath(searchParams.get("callbackUrl")));
    router.refresh();
  }

  return (
    <>
      <form className="grid gap-4" data-testid="login-form" onSubmit={onSubmit}>
        {error ? (
          <p aria-live="assertive" className="alert-error" id="login-error" role="alert">
            {error}
          </p>
        ) : null}
        {requiresCode ? (
          <>
            <div>
              <label className="label" htmlFor="mfaEmail">
                Email
              </label>
              <input
                key="mfa-email"
                className="field"
                data-testid="login-mfa-email"
                id="mfaEmail"
                type="email"
                value={email}
                readOnly
              />
            </div>
            <div>
              <label className="label" htmlFor="twoFactorCode">
                Verification code
              </label>
              <input
                key="mfa-code"
                className="field"
                data-testid="login-two-factor-code"
                id="twoFactorCode"
                name="twoFactorCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="one-time-code"
                aria-describedby={error ? "login-error" : undefined}
                aria-invalid={error === "Invalid MFA code." ? true : undefined}
                required
              />
              <p className="mt-1 text-xs text-muted">
                {requiresCode === "email"
                  ? "Use the code sent to your verified email address."
                  : "Use the current code from your authenticator app."}
              </p>
            </div>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => {
                clearPendingLogin();
                setError("");
              }}
            >
              Use a different login
            </button>
          </>
        ) : (
          <>
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                key="login-email"
                className="field"
                data-testid="login-email"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                aria-describedby={error ? "login-error" : undefined}
                aria-invalid={error ? true : undefined}
                defaultValue={email}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                key="login-password"
                className="field"
                data-testid="login-password"
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                aria-describedby={error ? "login-error" : undefined}
                aria-invalid={error ? true : undefined}
                required
              />
            </div>
          </>
        )}
        <button
          className="btn-primary"
          data-testid="login-submit"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Signing in..." : requiresCode ? "Verify code" : "Login"}
        </button>
      </form>
      {error === "Verify your email before logging in." ? (
        <form className="mt-3" action={resendVerificationEmail}>
          <input name="email" type="hidden" value={email} />
          <button className="btn-secondary w-full" type="submit">
            Resend verification email
          </button>
        </form>
      ) : null}
    </>
  );
}
