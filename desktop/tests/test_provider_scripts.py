from documentos_licitacao.providers import PROVIDERS


def test_prepare_script_contains_cnpj():
    cnpj = "58614466000167"

    for provider in PROVIDERS:
        assert cnpj in provider.prepare_script(cnpj)


def test_probe_is_read_only():
    forbidden = (".click()", "submit()", ".value =")

    for provider in PROVIDERS:
        script = provider.inspect_script().lower()

        for token in forbidden:
            assert token not in script
