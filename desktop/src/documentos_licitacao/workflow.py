from __future__ import annotations

from pathlib import Path

from PySide6.QtCore import QObject, QStandardPaths, QTimer, Signal

from .browser import EmbeddedBrowser
from .models import DocumentJob, DocumentState, Supplier
from .providers import PROVIDERS, Provider


class Workflow(QObject):
    changed = Signal()
    message = Signal(str)

    def __init__(self, browser: EmbeddedBrowser, parent=None):
        super().__init__(parent)
        self.browser = browser
        self.supplier: Supplier | None = None
        self.index = -1
        self.jobs = {
            provider.id: DocumentJob(provider.id, provider.title)
            for provider in PROVIDERS
        }

        self.timer = QTimer(self)
        self.timer.setInterval(2200)
        self.timer.timeout.connect(self._probe)

        browser.page_loaded.connect(self._on_page_loaded)
        browser.probe_ready.connect(self._on_probe)
        browser.download_started.connect(self._on_download_started)
        browser.download_finished.connect(self._on_download_finished)
        browser.pdf_saved.connect(self._on_pdf_saved)

    @property
    def current_provider(self) -> Provider | None:
        if 0 <= self.index < len(PROVIDERS):
            return PROVIDERS[self.index]
        return None

    def start(self, cnpj: str, uf: str) -> None:
        self.supplier = Supplier(cnpj=cnpj, uf=uf)
        self.index = 0

        for job in self.jobs.values():
            job.state = DocumentState.QUEUED
            job.message = "Na fila"
            job.file_path = None

        self._open_current()

    def _open_current(self) -> None:
        provider = self.current_provider
        if not provider or not self.supplier:
            self.timer.stop()
            self.message.emit("Fluxo concluído.")
            self.changed.emit()
            return

        job = self.jobs[provider.id]
        job.state = DocumentState.LOADING
        job.message = "Abrindo portal oficial…"
        self.browser.load_provider(provider, self.supplier.cnpj)
        self.timer.stop()
        self.changed.emit()

    def _on_page_loaded(self, ok: bool) -> None:
        provider = self.current_provider
        if not provider:
            return

        job = self.jobs[provider.id]

        if not ok:
            job.state = DocumentState.ERROR
            job.message = "Falha ao carregar o portal."
            self.changed.emit()
            return

        self.browser.prepare()
        job.state = DocumentState.WORKING
        job.message = "CNPJ preparado. Use os controles oficiais do portal."
        self.timer.start()
        self.changed.emit()

    def _probe(self) -> None:
        if self.current_provider:
            self.browser.probe()

    def _on_probe(self, result: dict) -> None:
        provider = self.current_provider
        if not provider:
            return

        job = self.jobs[provider.id]

        if result.get("captcha_present") and not result.get("captcha_solved"):
            job.state = DocumentState.NEEDS_HUMAN
            job.message = (
                "Resolva o CAPTCHA no navegador e use o botão oficial."
            )
        elif result.get("result_ready"):
            job.state = DocumentState.RESULT_READY
            job.message = (
                "Comprovante pronto. Salve em PDF."
                if provider.printable_result
                else "Resultado pronto. Use o botão oficial de download."
            )
        elif job.state not in (
            DocumentState.DOWNLOADING,
            DocumentState.DOWNLOADED,
        ):
            job.state = DocumentState.WORKING
            job.message = "Aguardando a emissão no portal oficial."

        self.changed.emit()

    def _on_download_started(self, path: str) -> None:
        provider = self.current_provider
        if not provider:
            return

        job = self.jobs[provider.id]
        job.state = DocumentState.DOWNLOADING
        job.message = "Baixando certidão…"
        job.file_path = path
        self.changed.emit()

    def _on_download_finished(self, path: str, ok: bool) -> None:
        provider = self.current_provider
        if not provider:
            return

        job = self.jobs[provider.id]
        job.file_path = path

        if ok:
            job.state = DocumentState.DOWNLOADED
            job.message = "Certidão baixada."
            self.next()
        else:
            job.state = DocumentState.ERROR
            job.message = "O download não foi concluído."

        self.changed.emit()

    def save_current_pdf(self) -> None:
        provider = self.current_provider
        if not provider or not self.supplier:
            return

        root = Path(
            QStandardPaths.writableLocation(
                QStandardPaths.StandardLocation.DownloadLocation
            )
        )
        path = (
            root
            / "Licitacoes"
            / self.supplier.cnpj
            / provider.filename(self.supplier.cnpj)
        )
        self.browser.save_current_page_pdf(path)

    def _on_pdf_saved(self, path: str, ok: bool) -> None:
        provider = self.current_provider
        if not provider:
            return

        job = self.jobs[provider.id]

        if ok:
            job.state = DocumentState.DOWNLOADED
            job.message = "PDF salvo."
            job.file_path = path
            self.next()
        else:
            job.state = DocumentState.ERROR
            job.message = "Não foi possível salvar o PDF."

        self.changed.emit()

    def next(self) -> None:
        self.timer.stop()
        self.index += 1
        self._open_current()
