import { type ReactNode } from "react";

type SectionPageProps = {
  readonly title: string;
  readonly status: string;
  readonly children?: ReactNode;
};

export function SectionPage({ title, status, children }: SectionPageProps) {
  return (
    <section className="page-stack">
      <div className="page-heading">
        <h1>{title}</h1>
        <p>{status}</p>
      </div>
      {children}
    </section>
  );
}
