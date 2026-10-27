import { LessonsClient } from "./LessonsClient";
import { Suspense } from "react";

export default function LessonsPage() {
  return <Suspense fallback={<section className="page-stack" aria-busy="true"><h1>Уроки</h1></section>}><LessonsClient /></Suspense>;
}
