"""Provider registry: binding, refusal, and malformed-configuration handling."""

import pytest

from mulyankan_platform.registry import ProviderRegistry, RegistryError
from mulyankan_spi.kms import KmsProvider

FAKE_TARGET = "testkit_fake_provider:FakeKms"


def _mapping() -> dict:
    return {
        "providers": {
            "kms": {
                "provider": FAKE_TARGET,
                "config": {"key_id": "dev-key-1"},
            }
        }
    }


def test_binding_resolves_and_satisfies_spi() -> None:
    registry = ProviderRegistry.from_mapping(_mapping())
    provider = registry.get("kms")
    assert isinstance(provider, KmsProvider)
    assert provider.describe().name == "fake-kms"


def test_unbound_capability_refused_at_call_time() -> None:
    registry = ProviderRegistry.from_mapping(_mapping())
    with pytest.raises(RegistryError, match="no provider bound for spi 'storage'"):
        registry.get("storage")


def test_malformed_target_rejected() -> None:
    with pytest.raises(RegistryError, match="module:attr"):
        ProviderRegistry.from_mapping({"providers": {"kms": {"provider": "no-colon"}}})


def test_unloadable_target_rejected() -> None:
    with pytest.raises(RegistryError, match="cannot load provider"):
        ProviderRegistry.from_mapping(
            {"providers": {"kms": {"provider": "does.not.exist:Provider"}}}
        )


def test_describe_reports_bindings() -> None:
    registry = ProviderRegistry.from_mapping(_mapping())
    report = registry.describe()
    assert report["kms"]["provider"] == FAKE_TARGET
    assert report["kms"]["descriptor"]["deterministic"] is True
