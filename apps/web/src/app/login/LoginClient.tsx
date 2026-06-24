"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { login } from "../../lib/api-client";
import { storeSession } from "../../lib/auth-storage";
import { resolveDemoLoginPrefill } from "../../lib/demo-login";

const DEMO_LOGIN_PREFILL = resolveDemoLoginPrefill(process.env);

export function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState(DEMO_LOGIN_PREFILL.email);
  const [password, setPassword] = useState(DEMO_LOGIN_PREFILL.password);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const session = await login(email, password);
      storeSession({
        token: session.accessToken,
        user: session.user,
      });
      router.push("/dashboard");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось войти.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-layout">
      <div className="page-heading">
        <h1>Вход</h1>
        <p>Локальный аккаунт для разработки уже подставлен.</p>
      </div>
      <form className="form-panel" onSubmit={(event) => void handleSubmit(event)}>
        <label>
          Почта
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.currentTarget.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          Пароль
          <input
            autoComplete="current-password"
            onChange={(event) => setPassword(event.currentTarget.value)}
            required
            type="password"
            value={password}
          />
        </label>
        {error === null ? null : <p className="form-error">{error}</p>}
        <button className="primary-action" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Вхожу" : "Войти"}
        </button>
        <Link className="inline-link" href="/register">
          Создать аккаунт
        </Link>
      </form>
    </section>
  );
}
