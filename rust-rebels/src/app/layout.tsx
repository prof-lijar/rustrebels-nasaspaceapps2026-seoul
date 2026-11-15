import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marswalk with SuperJar | Rust Rebels",
  description: "Explore Marswalk on real NASA terrain. Meet SuperJar, an AI companion built to do work for people across robots, drones and other devices. Discover more at super-jar.com.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
