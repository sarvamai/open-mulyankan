"""`text_is_usable`: telling extracted text from extracted glyph indices.

The samples here are taken from real PDFs. A book whose fonts declare no
ToUnicode CMap still hands PyMuPDF a full page of characters — they are the
font's glyph indices, which land in the dingbat and private-use blocks — so
`has_text_layer` alone says a page is readable when none of it is.

This is a pure function rather than an API test because a garbled PDF cannot
be built with PyMuPDF: its writer always emits a valid CMap. Forging one
would test the fixture, not the rule.
"""

from mulyankan_platform.ingestion.pipeline import text_is_usable

# Page 12 of a widely distributed NCERT Class 10 Science PDF, verbatim. Every
# glyph extracts; none of it means anything.
GARBLED = "❈\x00✁✂✄\n☎✆✝\n✞\n✁✆\n☎✟✄\n✠✡☛\n✆\n✡☞\n✌\n✍✎✆\n✟✄\n✠✡☛\n11\n❲✏\n✑\n✒\n✓\n✔✕"

READABLE = (
    "Control and Coordination\n101\nobject is an urgent and dangerous\n"
    "situation for us. We need to detect it,\nand respond to it."
)


def test_a_readable_page_is_usable() -> None:
    assert text_is_usable(READABLE) is True


def test_glyph_soup_is_not_usable() -> None:
    assert text_is_usable(GARBLED) is False


def test_an_empty_or_blank_page_is_not_usable() -> None:
    assert text_is_usable("") is False
    assert text_is_usable("   \n\t \n ") is False


def test_replacement_characters_count_against_a_page() -> None:
    assert text_is_usable("�" * 40 + "ok") is False


def test_a_few_symbols_do_not_condemn_a_readable_page() -> None:
    """Real prose carries the odd dingbat — a bullet, a tick, an arrow."""
    assert text_is_usable("✓ Answer the following questions. ✏ " + READABLE) is True


def test_devanagari_is_usable() -> None:
    """Indic script is text, not glyph soup: the check must not flag it."""
    assert text_is_usable("प्रकाश का परावर्तन तथा अपवर्तन। नियम लिखिए।") is True
