import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import "@/app/globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Workspace",
  description: "Workspace pessoal para wishlist, tarefas, estudos e organizacao.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${plusJakartaSans.variable} ${plusJakartaSans.className}`}>{children}</body>
    </html>
  );
}
