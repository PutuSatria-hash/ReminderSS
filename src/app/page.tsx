import DashboardApp from "@/components/DashboardApp";
import { getDashboardBootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const initialData = await getDashboardBootstrap();
  return <DashboardApp initialData={initialData} />;
}
