import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Scene Creator · Drama Talk",
  description: "Scene Creator has moved to /scene-creator.",
};

export default function VeoLayout({ children }: { children: ReactNode }) {
  return children;
}
