type DemoLoginEnv = {
  readonly NODE_ENV?: string;
  readonly NEXT_PUBLIC_ENABLE_DEMO_LOGIN?: string;
  readonly NEXT_PUBLIC_DEV_AUTH_EMAIL?: string;
  readonly NEXT_PUBLIC_DEV_AUTH_PASSWORD?: string;
};

export type DemoLoginPrefill = {
  readonly email: string;
  readonly password: string;
};

export function resolveDemoLoginPrefill(env: DemoLoginEnv): DemoLoginPrefill {
  if (env.NODE_ENV === "production" || env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN !== "true") {
    return { email: "", password: "" };
  }

  return {
    email: env.NEXT_PUBLIC_DEV_AUTH_EMAIL ?? "",
    password: env.NEXT_PUBLIC_DEV_AUTH_PASSWORD ?? "",
  };
}
