import { useState } from "react";
import { useRequestOtp, useVerifyOtp } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ForgeIcon } from "@/components/ForgeIcon";
import { storeToken, getStoredToken } from "@/lib/auth";

export default function LoginPage() {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const { mutate: requestOtp, isPending: requestPending } = useRequestOtp();
  const { mutate: verifyOtp, isPending: verifyPending } = useVerifyOtp();

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
          window.location.href = "/";
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
