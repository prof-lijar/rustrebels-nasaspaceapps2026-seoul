import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rust Rebels | Red dust on everything",
  description: "Serious curiosity. Bold experiments. Rust Rebels brings garage-inventor energy to Mars exploration.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
