export function ContractsPage() {
  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <p className="pageEyebrow">Документы</p>
          <h1>Договоры</h1>
          <p>
            Управление договорами и их статусами.
          </p>
        </div>

        <button type="button" className="primaryButton">
          + Новый договор
        </button>
      </div>

      <div className="emptyPanel">
        <strong>Раздел договоров подготовлен</strong>
        <span>
          Позже добавим файлы и ИИ-анализ рисков.
        </span>
      </div>
    </section>
  );
}