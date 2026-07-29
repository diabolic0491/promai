import { ShieldX } from "lucide-react";

import { StatusPage } from
  "../components/ui/StatusPage";

export function ForbiddenPage() {
  return (
    <StatusPage
      code="403"
      title="Недостаточно прав"
      description="Эта функция доступна только пользователям с другой ролью. Если доступ необходим для работы, обратитесь к администратору."
      icon={ShieldX}
      authenticated
    />
  );
}
