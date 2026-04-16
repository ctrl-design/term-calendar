import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Term Calendar',
  description: 'A simple Next.js app for term planning.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
