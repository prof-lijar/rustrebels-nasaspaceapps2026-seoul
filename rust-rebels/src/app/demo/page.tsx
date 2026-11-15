import type { Metadata } from "next";
import { PlayGate } from "@/features/game/PlayGate";

export const metadata: Metadata = {
  title: "30-second demo | Rust Rebels",
  description: "SuperJar scouts the route, scans a boulder, and leads the astronaut to shelter from a solar storm: Marswalk in 30 seconds, on real NASA terrain.",
};

export default function DemoPage() {
  return <PlayGate film />;
}
