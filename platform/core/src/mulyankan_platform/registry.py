"""Provider registry: resolves SPI bindings from configuration (ADR-0003).

The platform never imports a provider directly. Bindings live in
per-environment `platform.yaml`; the registry loads them at startup and
refuses unknown or malformed bindings. A capability with no binding is
refused at call time — the same rule as a model removed from the approved
list.

`get(spi, protocol)` is the typed access path: it checks the bound instance
against the SPI's `runtime_checkable` Protocol and returns it as that type,
so a provider missing a method fails at binding-check time with a message
naming the SPI — not mid-request with an `AttributeError` from inside the
core. The untyped `get(spi)` remains for callers that legitimately need the
raw instance (`describe` reporting).
"""

from __future__ import annotations

import importlib
from dataclasses import dataclass
from typing import Any, TypeVar

import yaml

from mulyankan_spi.descriptor import ProviderDescriptor


class RegistryError(Exception):
    """A binding is missing, malformed, or unloadable."""


@dataclass(frozen=True)
class Binding:
    """One resolved SPI binding."""

    spi: str
    provider: str  # "module:attr" target as written in configuration
    config: dict
    instance: Any


_P = TypeVar("_P")


class ProviderRegistry:
    """Loads and resolves provider bindings; the only path to a provider."""

    def __init__(self, bindings: dict[str, Binding]) -> None:
        self._bindings = bindings

    @classmethod
    def from_mapping(cls, config: dict) -> ProviderRegistry:
        """Build a registry from a parsed configuration mapping."""
        bindings: dict[str, Binding] = {}
        for spi, entry in (config.get("providers") or {}).items():
            if not isinstance(entry, dict):
                raise RegistryError(f"binding for spi '{spi}' must be a mapping")
            target = entry.get("provider")
            if not isinstance(target, str) or ":" not in target:
                raise RegistryError(
                    f"binding for spi '{spi}' must be 'module:attr', got {target!r}"
                )
            module_name, attr = target.split(":", 1)
            try:
                module = importlib.import_module(module_name)
                factory = getattr(module, attr)
            except (ImportError, AttributeError) as exc:
                raise RegistryError(
                    f"cannot load provider '{target}' for spi '{spi}': {exc}"
                ) from exc
            provider_config = entry.get("config") or {}
            try:
                instance = factory(provider_config)
            except Exception as exc:
                raise RegistryError(
                    f"provider '{target}' for spi '{spi}' failed to initialise: {exc}"
                ) from exc
            bindings[spi] = Binding(
                spi=spi, provider=target, config=provider_config, instance=instance
            )
        return cls(bindings)

    @classmethod
    def from_file(cls, path: str) -> ProviderRegistry:
        """Build a registry from a `platform.yaml` file."""
        with open(path, encoding="utf-8") as handle:
            config = yaml.safe_load(handle) or {}
        return cls.from_mapping(config)

    def get(self, spi: str) -> Any:
        """Return the bound provider for `spi`; refuse unbound capabilities."""
        binding = self._bindings.get(spi)
        if binding is None:
            raise RegistryError(f"no provider bound for spi '{spi}'")
        return binding.instance

    def get_typed(self, spi: str, protocol: type[_P]) -> _P:
        """Return the binding for `spi` checked against `protocol`.

        `protocol` must be a `@runtime_checkable` Protocol from
        `mulyankan_spi`. An instance that does not satisfy it is refused here
        — the same refuse-don't-fall-back rule as every other binding fault —
        so a provider that drifts from its SPI fails with a message naming
        the SPI, not with an `AttributeError` mid-request.
        """
        binding = self._bindings.get(spi)
        if binding is None:
            raise RegistryError(f"no provider bound for spi '{spi}'")
        if not isinstance(binding.instance, protocol):
            raise RegistryError(
                f"provider '{binding.provider}' bound for spi '{spi}' does not "
                f"satisfy {protocol.__name__}"
            )
        return binding.instance  # type: ignore[return-value] # checked above

    def describe(self) -> dict[str, dict]:
        """Report every binding with its descriptor, for /healthz and audits."""
        report: dict[str, dict] = {}
        for spi, binding in self._bindings.items():
            descriptor = getattr(binding.instance, "describe", None)
            described: ProviderDescriptor | None = descriptor() if descriptor else None
            report[spi] = {
                "provider": binding.provider,
                "descriptor": described.as_dict() if described else None,
            }
        return report
