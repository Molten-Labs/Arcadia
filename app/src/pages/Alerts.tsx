import { Layout } from "@/components/Layout";
import { EmptyState } from "@/components/EmptyState";
import { Bell } from "lucide-react";
import { useWallet } from "@/lib/wallet";

const Alerts = () => {
  const { connected } = useWallet();

  return (
    <Layout>
      <div className="container py-10">
        <div className="mb-8">
          <h1 className="font-display font-bold text-4xl">Alerts</h1>
          <p className="text-muted-foreground mt-2">
            Real-time notifications for your vault positions.
          </p>
        </div>

        <EmptyState
          icon={<Bell className="w-5 h-5" />}
          title={connected ? "No alerts yet" : "Connect your wallet"}
          description={
            connected
              ? "Alerts will appear here when vault events affect your positions. Historical alerts require the indexer (Phase 3)."
              : "Connect your wallet to receive alerts about your positions."
          }
        />
      </div>
    </Layout>
  );
};

export default Alerts;
