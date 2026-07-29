import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowLeft,
  ClipboardList,
} from "lucide-react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { getContracts } from "../api/contracts";
import {
  getCounterparties,
} from "../api/counterparties";
import {
  getDocumentTemplates,
} from "../api/documentTemplates";
import {
  createTechnicalSpecification,
  getTechnicalSpecification,
  updateTechnicalSpecification,
} from "../api/technicalSpecifications";
import {
  TechnicalSpecificationForm,
  type TechnicalSpecificationFormSubmitValues,
} from "../components/technicalSpecifications/TechnicalSpecificationForm";
import "../styles/records.css";
import "../styles/contracts.css";
import "../styles/technicalSpecifications.css";

interface TechnicalSpecificationFormPageProps {
  mode: "create" | "edit";
}

function readPositiveInteger(
  value: string | null | undefined,
): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : undefined;
}

export function TechnicalSpecificationFormPage({
  mode,
}: TechnicalSpecificationFormPageProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const technicalSpecificationId =
    readPositiveInteger(id);
  const initialCounterpartyId = readPositiveInteger(
    searchParams.get("counterparty_id"),
  );
  const initialContractId = readPositiveInteger(
    searchParams.get("contract_id"),
  );
  const isEdit = mode === "edit";
  const hasValidId =
    !isEdit || Boolean(technicalSpecificationId);

  const technicalSpecificationQuery = useQuery({
    queryKey: [
      "technical-specification",
      technicalSpecificationId,
    ],
    queryFn: () =>
      getTechnicalSpecification(
        technicalSpecificationId!,
      ),
    enabled:
      isEdit && Boolean(technicalSpecificationId),
  });

  const counterpartiesQuery = useQuery({
    queryKey: [
      "counterparties",
      {
        includeArchived: true,
        limit: 100,
        offset: 0,
        purpose: "technical-specification-form",
      },
    ],
    queryFn: () =>
      getCounterparties({
        includeArchived: true,
        limit: 100,
        offset: 0,
      }),
  });

  const contractsQuery = useQuery({
    queryKey: [
      "contracts",
      {
        includeArchived: true,
        limit: 100,
        offset: 0,
        purpose: "technical-specification-form",
      },
    ],
    queryFn: () =>
      getContracts({
        includeArchived: true,
        limit: 100,
        offset: 0,
      }),
  });

  const templatesQuery = useQuery({
    queryKey: [
      "document-templates",
      {
        templateType: "technical_specification",
        includeArchived: false,
        limit: 100,
        offset: 0,
      },
    ],
    queryFn: () =>
      getDocumentTemplates({
        templateType: "technical_specification",
        includeArchived: false,
        limit: 100,
        offset: 0,
      }),
  });

  const isLoading =
    counterpartiesQuery.isLoading ||
    contractsQuery.isLoading ||
    templatesQuery.isLoading ||
    (isEdit &&
      technicalSpecificationQuery.isLoading);
  const loadError =
    counterpartiesQuery.error ||
    contractsQuery.error ||
    templatesQuery.error ||
    technicalSpecificationQuery.error;
  const technicalSpecification =
    technicalSpecificationQuery.data;
  const activeTemplates = (
    templatesQuery.data?.items ?? []
  ).filter(
    (template) =>
      template.is_active && !template.is_archived,
  );
  const availableCounterparties = (
    counterpartiesQuery.data?.items ?? []
  ).filter(
    (counterparty) =>
      counterparty.status === "active" ||
      counterparty.id ===
        technicalSpecification?.counterparty_id,
  );

  if (!hasValidId) {
    return (
      <section className="page">
        <div className="records-state records-state--error records-state--card">
          <ClipboardList
            size={30}
            aria-hidden="true"
          />
          <strong>Некорректный идентификатор</strong>
          <span>
            Проверьте адрес страницы технического
            задания.
          </span>
          <Link
            to="/technical-specifications"
            className="button button--secondary"
          >
            <ArrowLeft size={17} aria-hidden="true" />
            В реестр
          </Link>
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="page">
        <div
          className="records-state records-state--card"
          role="status"
        >
          <span className="loading-spinner" />
          <strong>Подготавливаем форму</strong>
          <span>
            Загружаем контрагентов, договоры,
            шаблоны и сведения ТЗ…
          </span>
        </div>
      </section>
    );
  }

  if (
    loadError ||
    (isEdit && !technicalSpecification)
  ) {
    return (
      <section className="page">
        <div className="records-state records-state--error records-state--card">
          <ClipboardList
            size={30}
            aria-hidden="true"
          />
          <strong>
            Не удалось подготовить форму
          </strong>
          <span>
            {loadError instanceof Error
              ? loadError.message
              : "Техническое задание не найдено"}
          </span>
          <Link
            to="/technical-specifications"
            className="button button--secondary"
          >
            <ArrowLeft size={17} aria-hidden="true" />
            В реестр
          </Link>
        </div>
      </section>
    );
  }

  if (technicalSpecification?.is_archived) {
    return (
      <section className="page">
        <div className="records-state records-state--card">
          <ClipboardList
            size={30}
            aria-hidden="true"
          />
          <strong>
            Архивное ТЗ нельзя редактировать
          </strong>
          <span>
            Сначала восстановите техническое задание
            в его карточке.
          </span>
          <Link
            to={`/technical-specifications/${technicalSpecification.id}`}
            className="button button--primary"
          >
            Открыть карточку
          </Link>
        </div>
      </section>
    );
  }

  async function submit(
    values: TechnicalSpecificationFormSubmitValues,
  ) {
    const payload = {
      counterparty_id: values.counterpartyId,
      contract_id: values.contractId,
      template_id: values.templateId,
      title: values.title,
      procurement_subject: values.procurementSubject,
      procurement_procedure:
        values.procurementProcedure,
      legal_basis: values.legalBasis,
      internal_regulation_document:
        values.internalRegulationDocument,
      approval_date: values.approvalDate,
      work_start_date: values.workStartDate,
      work_end_date: values.workEndDate,
      form_data: values.formData,
    };

    if (mode === "create") {
      const created =
        await createTechnicalSpecification(payload);

      await queryClient.invalidateQueries({
        queryKey: ["technical-specifications"],
      });
      navigate(
        `/technical-specifications/${created.id}`,
        { replace: true },
      );
      return;
    }

    const updated =
      await updateTechnicalSpecification(
        technicalSpecification!.id,
        payload,
      );

    queryClient.setQueryData(
      ["technical-specification", updated.id],
      updated,
    );
    await queryClient.invalidateQueries({
      queryKey: ["technical-specifications"],
    });
    navigate(
      `/technical-specifications/${updated.id}`,
      { replace: true },
    );
  }

  const resolvedInitialCounterpartyId =
    initialCounterpartyId ??
    (initialContractId
      ? contractsQuery.data?.items.find(
          (contract) =>
            contract.id === initialContractId,
        )?.counterparty_id
      : undefined);

  return (
    <section className="page">
      <div className="detail-breadcrumb">
        <Link
          to={
            technicalSpecification
              ? `/technical-specifications/${technicalSpecification.id}`
              : "/technical-specifications"
          }
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {technicalSpecification
            ? "Карточка ТЗ"
            : "Технические задания"}
        </Link>
      </div>

      <div className="page-heading contract-form-heading">
        <div>
          <span className="page-eyebrow">
            Документы
          </span>
          <h1>
            {mode === "create"
              ? "Новое техническое задание"
              : "Редактирование ТЗ"}
          </h1>
          <p>
            Заполните содержание, сроки и данные
            активного DOCX-шаблона.
          </p>
        </div>
      </div>

      <TechnicalSpecificationForm
        mode={mode}
        technicalSpecification={
          technicalSpecification
        }
        initialCounterpartyId={
          resolvedInitialCounterpartyId
        }
        initialContractId={initialContractId}
        counterparties={availableCounterparties}
        contracts={contractsQuery.data?.items ?? []}
        templates={activeTemplates}
        onCancel={() =>
          navigate(
            technicalSpecification
              ? `/technical-specifications/${technicalSpecification.id}`
              : "/technical-specifications",
          )
        }
        onSubmit={submit}
      />
    </section>
  );
}
