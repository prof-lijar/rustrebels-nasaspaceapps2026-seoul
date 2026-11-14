import type { Metadata } from "next";
import { MarsGame } from "@/features/game/MarsGame";

export const metadata: Metadata = {
  title: "Marswalk | Rust Rebels",
  description: "Walk a scouted route across Jezero crater in first or third person, on real NASA terrain, with live radiation and a solar storm.",
};

export default function AppPage() {
  return <MarsGame />;
}
