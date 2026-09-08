"""Provider descriptor: the identity card every provider carries.

Mirrors the gateway's `describe` contract from the architecture concept note:
identity, version, and a data-handling declaration. The platform records the
descriptor of every bound provider in manifests and audit events.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class ProviderDescriptor:
    """Static description of a provider implementation."""

    name: str
    version: str
    deterministic: bool
    data_handling: str

    def as_dict(self) -> dict:
        return {
            "name": self.name,
            "version": self.version,
            "deterministic": self.deterministic,
            "data_handling": self.data_handling,
        }
