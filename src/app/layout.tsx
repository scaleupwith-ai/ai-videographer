import type { Metadata } from "next";
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
      <head>
        {/* Google Fonts for caption preview */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&family=Montserrat:wght@400;500;600;700&family=Oswald:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=Roboto:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className="antialiased min-h-screen">
        <ThemeProvider defaultTheme="light" storageKey="ai-videographer-theme">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
