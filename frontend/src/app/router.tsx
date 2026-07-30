import { Navigate, createBrowserRouter } from "react-router-dom";

import { AppLayout } from "../components/layout/AppLayout";
import { RequireAuth } from "../features/auth/RequireAuth";
import { RequireRole } from "../features/auth/RequireRole";
import { DashboardPage } from "../pages/DashboardPage";
import { CounterpartiesPage } from
  "../pages/CounterpartiesPage";
import { CounterpartyPage } from
  "../pages/CounterpartyPage";
import { ContractFormPage } from
  "../pages/ContractFormPage";
import { ContractPage } from
  "../pages/ContractPage";
import { ContractsPage } from
  "../pages/ContractsPage";
import { ForbiddenPage } from "../pages/ForbiddenPage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { OrganizationPage } from
  "../pages/OrganizationPage";
import {
  TechnicalSpecificationFormPage,
} from "../pages/TechnicalSpecificationFormPage";
import {
  TechnicalSpecificationPage,
} from "../pages/TechnicalSpecificationPage";
import {
  TechnicalSpecificationsPage,
} from "../pages/TechnicalSpecificationsPage";
import { TemplatesPage } from
  "../pages/TemplatesPage";
import { UsersPage } from "../pages/UsersPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: (
              <Navigate to="/dashboard" replace />
            ),
          },
          {
            path: "/dashboard",
            element: <DashboardPage />,
          },
          {
            path: "/counterparties",
            element: <CounterpartiesPage />,
          },
          {
            path: "/counterparties/:id",
            element: <CounterpartyPage />,
          },
          {
            path: "/contracts",
            element: <ContractsPage />,
          },
          {
            path: "/contracts/new",
            element: (
              <ContractFormPage mode="create" />
            ),
          },
          {
            path: "/contracts/:id",
            element: <ContractPage />,
          },
          {
            path: "/contracts/:id/edit",
            element: (
              <ContractFormPage mode="edit" />
            ),
          },
          {
            path: "/technical-specifications",
            element: <TechnicalSpecificationsPage />,
          },
          {
            path: "/technical-specifications/new",
            element: (
              <TechnicalSpecificationFormPage
                mode="create"
              />
            ),
          },
          {
            path: "/technical-specifications/:id",
            element: <TechnicalSpecificationPage />,
          },
          {
            path: "/technical-specifications/:id/edit",
            element: (
              <TechnicalSpecificationFormPage
                mode="edit"
              />
            ),
          },
          {
            path: "/templates",
            element: <TemplatesPage />,
          },
          {
            path: "/organization",
            element: <OrganizationPage />,
          },
          {
            element: <RequireRole allowed={["admin"]} />,
            children: [
              {
                path: "/administration/users",
                element: <UsersPage />,
              },
            ],
          },
          {
            path: "/forbidden",
            element: <ForbiddenPage />,
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
