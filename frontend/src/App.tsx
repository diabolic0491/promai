import { useState } from "react";

import { AppLayout } from "./components/layout/AppLayout";

import { DashboardPage } from "./pages/DashboardPage";
import { OrganizationPage } from "./pages/OrganizationPage";
import { CounterpartiesPage } from "./pages/CounterpartiesPage";
import { ContractsPage } from "./pages/ContractsPage";

import "./App.css";


export type AppPage =
  | "dashboard"
  | "organization"
  | "counterparties"
  | "contracts";


export default function App() {
  const [currentPage, setCurrentPage] =
    useState<AppPage>("dashboard");

  function renderCurrentPage() {
    switch (currentPage) {
      case "organization":
        return <OrganizationPage />;

      case "counterparties":
        return <CounterpartiesPage />;

      case "contracts":
        return <ContractsPage />;

      case "dashboard":
      default:
        return <DashboardPage />;
    }
  }

  return (
    <AppLayout
      currentPage={currentPage}
      onPageChange={setCurrentPage}
    >
      {renderCurrentPage()}
    </AppLayout>
  );
}