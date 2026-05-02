import { Layout } from "@/components/Layout";
import { EmptyState } from "@/components/EmptyState";
import { Bell, BellRing } from "lucide-react";
import { useWallet } from "@/lib/wallet";

const Alerts = () => {
  const { connected } = useWallet();

  return (
    <Layout>
      <div className="container py-10">
        <div className="mb-8">
          <span className="page-header-label">
            <BellRing className="w-3 h-3" /> Notifications
          </span>
          <h1 className="font-display type-h1 font-semibold mt-3">Alerts</h1>
          <p className="text-muted-foreground mt-2 text-[14px]">
            Real-time notifications for your vault positions.
          </p>
        </div>

        <EmptyState
          icon={<Bell className="w-5 h-5" />}
          title={connected ? "No alerts yet" : "Connect your wallet"}
          description={
            connected
              ? "Alerts will appear here when vault events affect your positions. Historical alerts require the on-chain indexer (Phase 3)."
              : "Connect your wallet to receive alerts about your positions."
          }
        />
      </div>
    </Layout>
  );
};

export default Alerts;
