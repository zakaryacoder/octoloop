"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Activity, Loader2, Lock, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSelector } from "@/components/layout/LanguageSelector";
import { FieldError } from "@/components/states";
import { tx } from "@/lib/tx";

const schema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

const DEMO = [
  { u: "admin", p: "Admin@12345", r: "Administrator" },
  { u: "dr.smith", p: "Clinician@123", r: "Clinician" },
  { u: "nurse.jones", p: "Nurse@12345", r: "Nurse" },
  { u: "coordinator.lee", p: "Coord@12345", r: "Coordinator" },
  { u: "viewer.demo", p: "Viewer@12345", r: "Viewer" },
  { u: "patient.ross", p: "Patient@12345", r: tx("Patient portal") },
];

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Role-aware landing: patients go to /portal, staff to /.
  useEffect(() => {
    if (!loading && user) router.replace(user.role === "patient" ? "/portal" : "/");
  }, [loading, user, router]);

  const onSubmit = async (v: FormValues) => {
    setError(null);
    setSubmitting(true);
    try {
      const u = await login(v.username, v.password);
      router.replace(u.role === "patient" ? "/portal" : "/");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("auth.loginFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const fill = (u: string, p: string) => {
    const un = document.getElementById("username") as HTMLInputElement | null;
    const pw = document.getElementById("password") as HTMLInputElement | null;
    if (un) {
      un.value = u;
      un.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (pw) {
      pw.value = p;
      pw.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };

  return (
    <div className="flex min-h-screen items-stretch">
      {/* Brand panel */}
      <div className="hidden w-[46%] flex-col justify-between bg-navy p-12 text-white lg:flex">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal text-lg font-bold">
              O
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">{tx("OCTOLOOP")}</p>
              <p className="text-[11px] uppercase tracking-widest text-white/50">
                {tx("Follow-up Command Center")}
              </p>
            </div>
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-bold leading-tight text-white">
            {t("auth.tagline")}
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/70">
            {t("auth.taglineDesc")}
          </p>
          <div className="mt-8 flex items-center gap-2 text-teal">
            <Activity size={18} />
            <span className="text-sm font-medium">
              {tx("10-stage follow-up workflow · Real-time escalation")}
            </span>
          </div>
        </div>
        <p className="text-[11px] text-white/40">{t("auth.frozenContract")}</p>
      </div>
      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-appbg p-6">
        <div className="w-full max-w-md animate-fade-in">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal text-lg font-bold text-white">
                O
              </div>
              <p className="text-lg font-bold text-navy">{tx("OCTOLOOP")}</p>
            </div>
            <LanguageSelector compact />
          </div>
          <div className="mb-4 hidden justify-end lg:flex">
            <LanguageSelector />
          </div>
          <h2 className="text-2xl font-bold text-ink-heading">{t("auth.signIn")}</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {tx("Enter your credentials to access the command center or patient portal.")}
          </p>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4">
            <div>
              <Label htmlFor="username">{t("auth.username")}</Label>
              <div className="relative">
                <User
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                />
                <Input
                  id="username"
                  autoComplete="username"
                  className="pl-9"
                  placeholder={t("auth.usernamePlaceholder")}
                  {...register("username")}
                />
              </div>
              <FieldError message={errors.username?.message} />
            </div>
            <div>
              <Label htmlFor="password">{t("auth.password")}</Label>
              <div className="relative">
                <Lock
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className="pl-9"
                  placeholder="••••••••"
                  {...register("password")}
                />
              </div>
              <FieldError message={errors.password?.message} />
            </div>
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
                {error}
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={submitting || loading}
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {submitting ? t("auth.signingIn") : t("auth.signIn")}
            </Button>
          </form>
          <div className="mt-8 rounded-xl border border-line bg-white p-4 shadow-card">
            <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted">
              {t("auth.demoCredentials")}
            </p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {DEMO.map((d) => (
                <button
                  key={d.u}
                  type="button"
                  onClick={() => fill(d.u, d.p)}
                  className="rounded-lg border border-line px-2.5 py-1.5 text-left text-[12px] hover:border-teal hover:bg-teal-light/50 transition-colors"
                >
                  <span className="font-semibold text-navy">{d.u}</span>
                  <span className="text-ink-muted"> · {d.r}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
