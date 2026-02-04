import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/toaster";
import { SkipLink } from "@/components/ui/skip-link";

const inter = Inter({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "Dispute2Go | Credit Dispute Operating System",
  description: "Professional credit dispute management for specialists. Transform credit reports into compliant dispute workflows.",
  keywords: ["credit repair", "dispute letters", "FCRA", "credit bureau", "CRA disputes"],
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <SkipLink />
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
