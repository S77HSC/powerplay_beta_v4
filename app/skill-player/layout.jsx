// app/skill-player/layout.jsx
import { Suspense } from "react";
import Loading from "./loading";

// This page depends on client-only URL params & user data
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function SkillPlayerLayout({ children }) {
  // While the client hydrates / search params resolve, show <Loading />
  return <Suspense fallback={<Loading />}>{children}</Suspense>;
}
