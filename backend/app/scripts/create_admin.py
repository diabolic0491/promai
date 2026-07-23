import argparse
from getpass import getpass

from pydantic import ValidationError
from sqlalchemy import func, select

from app.db.session import SessionLocal
from app.models.user import User
from app.models.user import UserRole
from app.schemas.user import UserCreate
from app.services.users import (
    UserAlreadyExistsError,
    create_user,
)


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=("Создать первого администратора PromAI"),
    )
    parser.add_argument(
        "--username",
        required=True,
        help="Имя пользователя администратора",
    )
    parser.add_argument(
        "--full-name",
        help="ФИО администратора",
    )
    return parser.parse_args()


def main() -> int:
    arguments = parse_arguments()
    password = getpass("Пароль: ")
    confirmation = getpass("Повторите пароль: ")

    if password != confirmation:
        print("Пароли не совпадают.")
        return 1

    try:
        payload = UserCreate(
            username=arguments.username,
            full_name=arguments.full_name,
            password=password,
            role=UserRole.ADMIN,
        )
    except ValidationError as error:
        print(error)
        return 1

    with SessionLocal() as session:
        user_count = session.scalar(select(func.count(User.id))) or 0

        if user_count > 0:
            print("Пользователи уже существуют. Создайте администратора через API.")
            return 1

        try:
            user = create_user(
                session=session,
                payload=payload,
            )
        except UserAlreadyExistsError:
            print("Пользователь с таким именем уже существует.")
            return 1

    print(f"Администратор создан: {user.username} (id={user.id}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
