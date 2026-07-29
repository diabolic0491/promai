import { FileQuestion } from "lucide-react";

import { StatusPage } from
  "../components/ui/StatusPage";

export function NotFoundPage() {
  return (
    <StatusPage
      code="404"
      title="Страница не найдена"
      description="Возможно, адрес изменился или ссылка была введена с ошибкой."
      icon={FileQuestion}
    />
  );
}
