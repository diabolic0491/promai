import { useState } from "react";
import "./App.css";

import { AppLayout } from "./components/layout/AppLayout";
import { ContractsPage } from "./pages/ContractsPage";
import { CounterpartiesPage } from "./pages/CounterpartiesPage";
import { DashboardPage } from "./pages/DashboardPage";

type Section = "dashboard" | "counterparties" | "contracts";

function App() {
  const [activeSection, setActiveSection] =
    useState<Section>("dashboard");

  return (
    <AppLayout
      activeSection={activeSection}
      onSectionChange={setActiveSection}
    >
      {activeSection === "dashboard" && <DashboardPage />}

      {activeSection === "counterparties" && (
        <CounterpartiesPage />
      )}

      {activeSection === "contracts" && <ContractsPage />}
    </AppLayout>
  );
}

export default App;