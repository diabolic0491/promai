from dataclasses import dataclass
from typing import Generic, TypeVar

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sqlalchemy.sql import Select


PageItem = TypeVar("PageItem")


@dataclass(frozen=True)
class PageResult(Generic[PageItem]):
    items: list[PageItem]
    total: int
    limit: int
    offset: int


def paginate_scalars(
    *,
    session: Session,
    statement: Select[tuple[PageItem]],
    limit: int,
    offset: int,
) -> PageResult[PageItem]:
    count_statement = select(func.count()).select_from(
        statement.order_by(None).subquery()
    )
    total = session.scalar(count_statement) or 0
    items = list(
        session.scalars(
            statement.offset(offset).limit(limit)
        ).all()
    )

    return PageResult(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )
