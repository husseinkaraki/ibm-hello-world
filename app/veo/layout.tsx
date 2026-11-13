import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Scene Lab — Your language, in motion",
  description: "Create a short personalized scene from a photo and a prompt with Google Cloud Veo 3.1.",
};

export default function VeoLayout({ children }: { children: ReactNode }) {
  return children;
}
