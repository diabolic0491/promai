from fastapi.testclient import TestClient


def test_frontend_can_read_download_file_name(
    client: TestClient,
) -> None:
    response = client.get(
        "/",
        headers={
            "Origin": "http://localhost:5173",
        },
    )

    assert response.status_code == 200
    assert response.headers[
        "access-control-expose-headers"
    ] == "Content-Disposition"
