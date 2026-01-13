import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
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
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased min-h-screen">
        <ThemeProvider defaultTheme="light" storageKey="ai-videographer-theme">
          {children}
          <Toaster position="bottom-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
