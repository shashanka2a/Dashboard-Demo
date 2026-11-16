import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Client portal setup | Utility Vision",
  description: "Set up your client portal password.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0D0D0D",
};

export default function ClientSetupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
