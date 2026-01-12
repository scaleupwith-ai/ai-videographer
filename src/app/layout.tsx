import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Videographer",
  description: "Create professional videos with AI-powered editing and real b-roll footage",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen">
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
