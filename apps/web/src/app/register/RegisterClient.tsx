"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import { register } from "../../lib/api-client";
import { storeSession } from "../../lib/auth-storage";

export function RegisterClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!hydrated || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const session = await register({
        email,
        password,
        displayName: displayName.trim() === "" ? null : displayName,
      });
      storeSession({
        token: session.accessToken,
        user: session.user,
      });
      router.push("/dashboard");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось создать аккаунт.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-layout">
      <div className="page-heading">
        <h1>Регистрация</h1>
      </div>
      <form
        aria-busy={!hydrated || isSubmitting}
        className="form-panel"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <label>
          Почта
          <input
            autoComplete="email"
            disabled={!hydrated || isSubmitting}
            onChange={(event) => setEmail(event.currentTarget.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          Имя
          <input
            autoComplete="name"
            disabled={!hydrated || isSubmitting}
            onChange={(event) => setDisplayName(event.currentTarget.value)}
            type="text"
            value={displayName}
          />
        </label>
        <label>
          Пароль
          <input
            autoComplete="new-password"
            disabled={!hydrated || isSubmitting}
            minLength={8}
            onChange={(event) => setPassword(event.currentTarget.value)}
            required
            type="password"
            value={password}
          />
        </label>
        {error === null ? null : <p className="form-error" role="alert">{error}</p>}
        <button className="primary-action" disabled={!hydrated || isSubmitting} type="submit">
          {isSubmitting ? "Создаю" : "Создать"}
        </button>
        <Link className="inline-link" href="/login">Войти в существующий аккаунт</Link>
      </form>
    </section>
  );
}
