// app/skill-session/layout.jsx
import { Suspense } from "react";
import Loading from "./loading";

// This route depends on client URL params & user state — don't pre-render
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function SkillSessionLayout({ children }) {
  return <Suspense fallback={<Loading />}>{children}</Suspense>;
}