import type { Metadata } from "next";
import "./globals.css";
import "./cloud.css";

export const metadata: Metadata = {
  title: "Spazio — idee, pagine e progetti",
  description: "Uno spazio personale gratuito per scrivere, organizzare e dare forma alle idee.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className="antialiased">{children}</body>
    </html>
  );
}
