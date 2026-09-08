"""Test fixtures: a fake provider module the registry can load.

The registry resolves "module:attr" targets via importlib. To test that
without the reference provider (a separate PR), this conftest registers a
minimal kms double as a real importable module for the duration of the test
session.
"""

import sys
import types

from mulyankan_spi.descriptor import ProviderDescriptor

FAKE_MODULE_NAME = "testkit_fake_provider"


class FakeKms:
    """Minimal kms double satisfying the KmsProvider Protocol."""

    def __init__(self, config: dict) -> None:
        self.config = config

    def describe(self) -> ProviderDescriptor:
        return ProviderDescriptor(
            name="fake-kms",
            version="1.0.0",
            deterministic=True,
            data_handling="in-memory test double; no retention, no network",
        )

    def encrypt(self, key_id: str, plaintext: bytes) -> bytes:
        return b"FAKE:" + plaintext

    def decrypt(self, key_id: str, ciphertext: bytes) -> bytes:
        return ciphertext[len(b"FAKE:") :]

    def sign(self, key_id: str, data: bytes) -> bytes:
        return b"FAKE-SIG"

    def verify_signature(self, key_id: str, data: bytes, signature: bytes) -> bool:
        return signature == b"FAKE-SIG"


def _register() -> None:
    module = types.ModuleType(FAKE_MODULE_NAME)
    module.FakeKms = FakeKms
    sys.modules[FAKE_MODULE_NAME] = module


_register()
