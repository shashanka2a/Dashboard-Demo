import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthRouteGuard } from "@/components/AuthRouteGuard";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Utility Vision | Dashboard",
  description: "Utility Vision field activity, reports, daily logs, and project management.",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    apple: [{ url: "/icon.png", type: "image/png" }],
  },
  openGraph: {
    title: "Utility Vision | Dashboard",
    description: "Utility Vision field activity, reports, daily logs, and project management.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider>
          <Suspense fallback={null}>
            <AuthRouteGuard>{children}</AuthRouteGuard>
          </Suspense>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
