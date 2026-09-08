"""Core-api health surface: reports resolved provider bindings (content-free)."""

import textwrap

from fastapi.testclient import TestClient

from mulyankan_platform.core_api.main import create_app, create_app_from_mapping

CONFIG = textwrap.dedent(
    """
    providers:
      kms:
        provider: testkit_fake_provider:FakeKms
        config:
          key_id: dev-key-1
    """
)


def test_healthz_reports_bound_providers(tmp_path) -> None:
    config_path = tmp_path / "platform.yaml"
    config_path.write_text(CONFIG, encoding="utf-8")
    client = TestClient(create_app(str(config_path)))

    response = client.get("/healthz")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["providers"]["kms"]["provider"] == "testkit_fake_provider:FakeKms"


def test_healthz_with_no_bindings_is_honest() -> None:
    client = TestClient(create_app_from_mapping({}))

    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "providers": {}}
