import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./cloud.css";

export const metadata: Metadata = {
  title: "CosmoMemo — idee, pagine e memoria",
  description: "Uno spazio personale per scrivere, organizzare progetti e conservare la memoria di Claude.",
  applicationName: "CosmoMemo",
  appleWebApp: { capable: true, title: "CosmoMemo", statusBarStyle: "default" },
  icons: {
    icon: [
      {url:"/icons/cosmomemo.svg",type:"image/svg+xml",sizes:"any"},
      {url:"/icons/cosmomemo-32.png",type:"image/png",sizes:"32x32"},
      {url:"/favicon.ico",sizes:"16x16 32x32 48x48"},
    ],
    shortcut: "/icons/cosmomemo.svg",
    apple: [{url:"/icons/cosmomemo-apple-180.png",sizes:"180x180",type:"image/png"}],
  },
};

export const viewport: Viewport = { themeColor: "#2B463D" };

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
