import { notFound } from "next/navigation";
import { ReferenceClient } from "./ReferenceClient";
import "./reference.css";

export default function DesignReferencePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ReferenceClient />;
}
