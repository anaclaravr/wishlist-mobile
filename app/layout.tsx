import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Wishlist compartilhavel",
  description: "Wishlist mobile-first com link publico, acompanhamento e alertas por e-mail.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
