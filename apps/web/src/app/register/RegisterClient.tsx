"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { register } from "../../lib/api-client";
import { storeSession } from "../../lib/auth-storage";

export function RegisterClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
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
        <p>Новый локальный профиль.</p>
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
          Имя
          <input
            autoComplete="name"
            onChange={(event) => setDisplayName(event.currentTarget.value)}
            type="text"
            value={displayName}
          />
        </label>
        <label>
          Пароль
          <input
            autoComplete="new-password"
            minLength={8}
            onChange={(event) => setPassword(event.currentTarget.value)}
            required
            type="password"
            value={password}
          />
        </label>
        {error === null ? null : <p className="form-error">{error}</p>}
        <button className="primary-action" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Создаю" : "Создать"}
        </button>
      </form>
    </section>
  );
}
