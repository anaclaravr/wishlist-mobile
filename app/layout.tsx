import type { Metadata } from "next";
import { Raleway } from "next/font/google";

import "@/app/globals.css";

const raleway = Raleway({
  subsets: ["latin"],
  variable: "--font-raleway",
});

export const metadata: Metadata = {
  title: "Wishlist compartilhavel",
  description: "Wishlist mobile-first com link publico, acompanhamento e alertas por e-mail.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={raleway.variable}>{children}</body>
    </html>
  );
}
