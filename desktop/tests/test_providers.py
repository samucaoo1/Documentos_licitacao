from documentos_licitacao.models import DocumentState
from documentos_licitacao.providers import PROVIDERS, by_id


def test_initial_providers_are_unique():
    ids = [provider.id for provider in PROVIDERS]

    assert ids == ["cgu", "cndt", "cnpj", "federal"]
    assert len(ids) == len(set(ids))


def test_filename_is_stable():
    assert (
        by_id("cndt").filename("58614466000167")
        == "02-CNDT-58614466000167.pdf"
    )


def test_prepare_scripts_never_auto_submit():
    for provider in PROVIDERS:
        script = provider.prepare_script("58614466000167").lower()

        assert ".click()" not in script
        assert "submit()" not in script


def test_document_state_is_serializable():
    assert DocumentState.NEEDS_HUMAN.value == "needs_human"
