import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Narra — Estudio de video narrado",
  description: "De una idea a una historia en video: guion, ilustraciones, voz, animación y música.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
