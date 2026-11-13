import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Finding Love at a Hackathon · Scene',
  description: 'Practice a word. Step into your own drama. A personalized language-learning experiment on IBM Cloud.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
