import SimulationClient from "@/components/SimulationClient";
import { SCENARIOS } from "@/lib/segue/scenarios";
import { notFound } from "next/navigation";
import type { ModuleId } from "@/lib/segue/types";

export default function SimulationPage({ params }: { params: { moduleId: string } }) {
  const id = params.moduleId as ModuleId;
  if (!(id in SCENARIOS)) notFound();
  return <SimulationClient moduleId={id} />;
}
