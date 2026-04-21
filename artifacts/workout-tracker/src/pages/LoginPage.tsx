import { useState } from "react";
import { useLocation } from "wouter";
import { useRequestOtp, useVerifyOtp, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ForgeIcon } from "@/components/ForgeIcon";
import { storeToken, getStoredToken } from "@/lib/auth";
import { Capacitor } from "@capacitor/core";
import { SignInWithApple } from "@capacitor-community/apple-sign-in";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const { mutate: requestOtp, isPending: requestPending } = useRequestOtp();
  const { mutate: verifyOtp, isPending: verifyPending } = useVerifyOtp();

  async function handleAppleSignIn() {
    try {
      const result = await SignInWithApple.authorize({
        clientId: "com.harrylevy.forgefit",
        redirectURI: "https://forge-fitness-production-37bc.up.railway.app",
        scopes: "email name",
      });
      const identityToken = result.response.identityToken;
      const res = await fetch("/api/auth/apple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identityToken, guestToken: getStoredToken() ?? undefined }),
      });
      if (!res.ok) throw new Error("Apple sign-in failed");
      const data = await res.json();
      storeToken(data.token);
      queryClient.setQueryData(getGetMeQueryKey(), data.user);
      setLocation("/");
    } catch (err) {
      console.error(err);
      setErrorMsg("Apple sign-in failed. Please try again.");
    }
  }

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setErrorMsg("");

    requestOtp(
      { data: { email: email.trim().toLowerCase() } },
      {
        onSuccess: () => setStep("otp"),
        onError: () => setErrorMsg("Failed to send code. Please try again."),
      },
    );
  }

  function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setErrorMsg("");

    verifyOtp(
      { data: { email: email.trim().toLowerCase(), code: code.trim(), guestToken: getStoredToken() ?? undefined } },
      {
        onSuccess: (data) => {
          storeToken(data.token);
          queryClient.setQueryData(getGetMeQueryKey(), data.user);
          setLocation("/");
        },
        onError: () => setErrorMsg("Invalid or expired code. Please try again."),
      },
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center">
            <ForgeIcon className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="font-sans font-extrabold text-2xl tracking-widest uppercase text-foreground">Forge</h1>
          <p className="text-sm text-muted-foreground">
            {step === "email" ? "Enter your email to get started" : `We sent a code to ${email}`}
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {Capacitor.isNativePlatform() && (
              <>
                <button
                  type="button"
                  onClick={handleAppleSignIn}
                  className="w-full flex items-center justify-center gap-2 bg-white text-black font-semibold rounded-lg py-3 text-sm"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  Sign in with Apple
                </button>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              </>
            )}
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              autoComplete="email"
              required
            />
            {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
            <Button type="submit" className="w-full" disabled={requestPending}>
              {requestPending ? "Sending…" : "Send login code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              autoFocus
              autoComplete="one-time-code"
              maxLength={6}
            />
            {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
            <Button type="submit" className="w-full" disabled={verifyPending}>
              {verifyPending ? "Verifying…" : "Sign in"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => { setStep("email"); setCode(""); setErrorMsg(""); }}
            >
              Use a different email
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
