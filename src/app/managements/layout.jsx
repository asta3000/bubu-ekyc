import { AppShell } from "@/components/Shells";
import ManagementTabs from "./_components/tabs";

const ManagementsLayout = ({ children }) => (
  <AppShell admin>
    <ManagementTabs />
    {children}
  </AppShell>
);

export default ManagementsLayout;
