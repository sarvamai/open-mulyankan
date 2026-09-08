"""The kms conformance suite must pass correct providers and catch broken ones."""

import hashlib
import hmac
import os

from mulyankan_spi.conformance import run_kms_conformance
from mulyankan_spi.descriptor import ProviderDescriptor
from mulyankan_spi.kms import KmsProvider

_MARKER = b"FAKE1:"


class GoodFakeKms:
    """Minimal in-memory implementation satisfying the kms contract."""

    def describe(self) -> ProviderDescriptor:
        return ProviderDescriptor(
            name="fake-kms",
            version="1.0.0",
            deterministic=True,
            data_handling="in-memory test double; no retention, no network",
        )

    def _keystream(self, key_id: str) -> bytes:
        return hashlib.sha256(key_id.encode("utf-8")).digest()

    def encrypt(self, key_id: str, plaintext: bytes) -> bytes:
        stream = self._keystream(key_id)
        body = bytes(b ^ stream[i % len(stream)] for i, b in enumerate(plaintext))
        return _MARKER + body

    def decrypt(self, key_id: str, ciphertext: bytes) -> bytes:
        if not ciphertext.startswith(_MARKER):
            raise ValueError("not a FAKE1 ciphertext")
        stream = self._keystream(key_id)
        body = ciphertext[len(_MARKER) :]
        return bytes(b ^ stream[i % len(stream)] for i, b in enumerate(body))

    def sign(self, key_id: str, data: bytes) -> bytes:
        return hmac.new(key_id.encode("utf-8"), data, hashlib.sha256).digest()

    def verify_signature(self, key_id: str, data: bytes, signature: bytes) -> bool:
        return hmac.compare_digest(self.sign(key_id, data), signature)


def test_correct_provider_satisfies_the_protocol() -> None:
    assert isinstance(GoodFakeKms(), KmsProvider)


def test_conformance_passes_a_correct_provider() -> None:
    assert run_kms_conformance(GoodFakeKms()) == []


def test_conformance_catches_an_incomplete_descriptor() -> None:
    class BrokenDescribe(GoodFakeKms):
        def describe(self) -> ProviderDescriptor:
            return ProviderDescriptor(
                name="", version="", deterministic=False, data_handling=""
            )

    failures = run_kms_conformance(BrokenDescribe())
    assert any("name" in f for f in failures)
    assert any("version" in f for f in failures)
    assert any("data_handling" in f for f in failures)
    assert any("deterministic=True" in f for f in failures)


def test_conformance_catches_a_broken_round_trip() -> None:
    class BrokenDecrypt(GoodFakeKms):
        def decrypt(self, key_id: str, ciphertext: bytes) -> bytes:
            return b"wrong"

    failures = run_kms_conformance(BrokenDecrypt())
    assert any("round-trip failed" in f for f in failures)


def test_conformance_catches_nondeterministic_signing() -> None:
    class RandomSign(GoodFakeKms):
        def sign(self, key_id: str, data: bytes) -> bytes:
            return os.urandom(32)

    failures = run_kms_conformance(RandomSign())
    assert any("verify_signature(sign(data))" in f for f in failures)
    assert any("deterministic" in f for f in failures)


def test_conformance_catches_tamper_acceptance() -> None:
    class AcceptsTamper(GoodFakeKms):
        def verify_signature(self, key_id: str, data: bytes, signature: bytes) -> bool:
            return True

    failures = run_kms_conformance(AcceptsTamper())
    assert any("reject tampered data" in f for f in failures)
    assert any("reject a different key" in f for f in failures)
