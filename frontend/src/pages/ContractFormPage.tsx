import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowLeft,
  FileText,
} from "lucide-react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import {
  createContract,
  getContract,
  updateContract,
} from "../api/contracts";
import {
  getCounterparties,
} from "../api/counterparties";
import {
  getDocumentTemplates,
} from "../api/documentTemplates";
import {
  ContractForm,
  type ContractFormSubmitValues,
} from "../components/contracts/ContractForm";
import "../styles/records.css";
import "../styles/contracts.css";

interface ContractFormPageProps {
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

export function ContractFormPage({
  mode,
}: ContractFormPageProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const contractId = readPositiveInteger(id);
  const initialCounterpartyId = readPositiveInteger(
    searchParams.get("counterparty_id"),
  );
  const isEdit = mode === "edit";
  const hasValidId = !isEdit || Boolean(contractId);

  const contractQuery = useQuery({
    queryKey: ["contract", contractId],
    queryFn: () => getContract(contractId!),
    enabled: isEdit && Boolean(contractId),
  });

  const counterpartiesQuery = useQuery({
    queryKey: [
      "counterparties",
      {
        includeArchived: true,
        limit: 100,
        offset: 0,
        purpose: "contract-form",
      },
    ],
    queryFn: () =>
      getCounterparties({
        includeArchived: true,
        limit: 100,
        offset: 0,
      }),
  });

  const templatesQuery = useQuery({
    queryKey: [
      "document-templates",
      {
        templateType: "contract",
        includeArchived: false,
        limit: 100,
        offset: 0,
      },
    ],
    queryFn: () =>
      getDocumentTemplates({
        templateType: "contract",
        includeArchived: false,
        limit: 100,
        offset: 0,
      }),
  });

  const isLoading =
    counterpartiesQuery.isLoading ||
    templatesQuery.isLoading ||
    (isEdit && contractQuery.isLoading);
  const loadError =
    counterpartiesQuery.error ||
    templatesQuery.error ||
    contractQuery.error;
  const contract = contractQuery.data;
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
      counterparty.id === contract?.counterparty_id,
  );

  if (!hasValidId) {
    return (
      <section className="page">
        <div className="records-state records-state--error records-state--card">
          <FileText size={30} aria-hidden="true" />
          <strong>Некорректный идентификатор</strong>
          <span>Проверьте адрес страницы договора.</span>
          <Link
            to="/contracts"
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
            Загружаем контрагентов, шаблоны и
            реквизиты договора…
          </span>
        </div>
      </section>
    );
  }

  if (
    loadError ||
    (isEdit && !contract)
  ) {
    return (
      <section className="page">
        <div className="records-state records-state--error records-state--card">
          <FileText size={30} aria-hidden="true" />
          <strong>
            Не удалось подготовить форму
          </strong>
          <span>
            {loadError instanceof Error
              ? loadError.message
              : "Договор не найден"}
          </span>
          <Link
            to="/contracts"
            className="button button--secondary"
          >
            <ArrowLeft size={17} aria-hidden="true" />
            В реестр
          </Link>
        </div>
      </section>
    );
  }

  if (contract?.is_archived) {
    return (
      <section className="page">
        <div className="records-state records-state--card">
          <FileText size={30} aria-hidden="true" />
          <strong>
            Архивный договор нельзя редактировать
          </strong>
          <span>
            Сначала восстановите договор в его
            карточке. Текущий бизнес-статус при этом
            сохранится.
          </span>
          <Link
            to={`/contracts/${contract.id}`}
            className="button button--primary"
          >
            Открыть карточку
          </Link>
        </div>
      </section>
    );
  }

  const initialCounterparty =
    mode === "create" && initialCounterpartyId
      ? availableCounterparties.find(
          (counterparty) =>
            counterparty.id === initialCounterpartyId,
        )
      : undefined;
  async function submit(
    values: ContractFormSubmitValues,
  ) {
    if (mode === "create") {
      const created = await createContract({
        counterparty_id: values.counterpartyId,
        template_id: values.templateId,
        number: values.number,
        title: values.title,
        contract_date: values.contractDate,
        start_date: values.startDate,
        end_date: values.endDate,
        amount: values.amount,
        currency: values.currency,
        notes: values.notes,
        owner_role: values.ownerRole,
        counterparty_role: values.counterpartyRole,
        form_data: values.formData,
      });

      await queryClient.invalidateQueries({
        queryKey: ["contracts"],
      });
      navigate(`/contracts/${created.id}`, {
        replace: true,
      });
      return;
    }

    const updated = await updateContract(
      contract!.id,
      {
        template_id: values.templateId,
        number: values.number,
        title: values.title,
        contract_date: values.contractDate,
        start_date: values.startDate,
        end_date: values.endDate,
        amount: values.amount,
        currency: values.currency,
        notes: values.notes,
        owner_role: values.ownerRole,
        counterparty_role: values.counterpartyRole,
        form_data: values.formData,
      },
    );

    queryClient.setQueryData(
      ["contract", updated.id],
      updated,
    );
    await queryClient.invalidateQueries({
      queryKey: ["contracts"],
    });
    navigate(`/contracts/${updated.id}`, {
      replace: true,
    });
  }

  return (
    <section className="page">
      <div className="detail-breadcrumb">
        <Link
          to={
            contract
              ? `/contracts/${contract.id}`
              : "/contracts"
          }
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {contract ? "Карточка договора" : "Договоры"}
        </Link>
      </div>

      <div className="page-heading contract-form-heading">
        <div>
          <span className="page-eyebrow">
            Договорная работа
          </span>
          <h1>
            {mode === "create"
              ? "Создание договора"
              : `Редактирование № ${contract?.number}`}
          </h1>
          <p>
            {mode === "create"
              ? "Заполните реквизиты, выберите стороны и при необходимости DOCX-шаблон."
              : "Контрагента изменить нельзя. Остальные реквизиты сохраняются в истории событий."}
          </p>
        </div>
      </div>

      <ContractForm
        mode={mode}
        contract={contract}
        initialCounterpartyId={
          initialCounterparty?.id
        }
        counterparties={availableCounterparties}
        templates={activeTemplates}
        onCancel={() =>
          navigate(
            contract
              ? `/contracts/${contract.id}`
              : "/contracts",
          )
        }
        onSubmit={submit}
      />
    </section>
  );
}
