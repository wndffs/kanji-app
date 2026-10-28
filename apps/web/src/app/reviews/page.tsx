import { ReviewsClient } from "./ReviewsClient";
import { Suspense } from "react";

export default function ReviewsPage() {
  return <Suspense fallback={<section className="page-stack" aria-busy="true"><h1>Повторения</h1></section>}><ReviewsClient /></Suspense>;
}
