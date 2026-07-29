import type {
  ContractAnalysisRunStatus,
  ContractAnalysisSeverity,
} from "../types/contractAnalysis";

export const contractAnalysisStatusLabels: Record<
  ContractAnalysisRunStatus,
  string
> = {
  running: "Выполняется",
  completed: "Завершён",
  failed: "Ошибка",
};

export const contractAnalysisSeverityLabels: Record<
  ContractAnalysisSeverity,
  string
> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  critical: "Критический",
};

export const contractAnalysisCategoryLabels: Record<
  string,
  string
> = {
  subject: "Предмет договора",
  price: "Цена",
  payment: "Оплата",
  delivery: "Поставка / сроки",
  acceptance: "Приёмка",
  quality: "Качество",
  warranty: "Гарантия",
  liability: "Ответственность",
  force_majeure: "Форс-мажор",
  termination: "Расторжение",
  dispute_resolution: "Разрешение споров",
  confidentiality: "Конфиденциальность",
  personal_data: "Персональные данные",
  intellectual_property:
    "Интеллектуальная собственность",
  compliance: "Соответствие требованиям",
};

export function getContractAnalysisCategoryLabel(
  category: string,
): string {
  return (
    contractAnalysisCategoryLabels[category] ??
    category
  );
}
