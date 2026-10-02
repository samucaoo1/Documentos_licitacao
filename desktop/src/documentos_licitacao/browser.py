from __future__ import annotations

from pathlib import Path

from PySide6.QtCore import QStandardPaths, QUrl, Signal
from PySide6.QtWebEngineCore import QWebEnginePage, QWebEngineProfile
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWidgets import QVBoxLayout, QWidget

from .providers.base import Provider


class EmbeddedBrowser(QWidget):
    page_loaded = Signal(bool)
    probe_ready = Signal(dict)
    download_started = Signal(str)
    download_finished = Signal(str, bool)
    pdf_saved = Signal(str, bool)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.provider: Provider | None = None
        self.cnpj: str | None = None
        self._active_downloads: list[object] = []
        self._pdf_target: str | None = None

        self.view = QWebEngineView(self)
        self.profile = QWebEngineProfile("DocumentosLicitacao", self)

        storage = Path(
            QStandardPaths.writableLocation(
                QStandardPaths.StandardLocation.AppDataLocation
            )
        )
        storage.mkdir(parents=True, exist_ok=True)
        self.profile.setPersistentStoragePath(str(storage / "web-profile"))
        self.profile.setCachePath(str(storage / "web-cache"))
        self.profile.downloadRequested.connect(self._on_download_requested)

        self.page = QWebEnginePage(self.profile, self.view)
        self.view.setPage(self.page)
        self.view.loadFinished.connect(self.page_loaded)
        self.view.pdfPrintingFinished.connect(self._on_pdf_printing_finished)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.addWidget(self.view)

    def set_context(self, provider: Provider, cnpj: str) -> None:
        self.provider = provider
        self.cnpj = cnpj

    def load_provider(self, provider: Provider, cnpj: str) -> None:
        self.set_context(provider, cnpj)
        self.view.load(QUrl(provider.url))

    def prepare(self) -> None:
        if self.provider and self.cnpj:
            self.page.runJavaScript(self.provider.prepare_script(self.cnpj))

    def probe(self) -> None:
        if not self.provider:
            return
        self.page.runJavaScript(
            self.provider.inspect_script(),
            self._probe_callback,
        )

    def _probe_callback(self, result) -> None:
        if isinstance(result, dict):
            self.probe_ready.emit(result)

    def save_current_page_pdf(self, target: Path) -> None:
        target.parent.mkdir(parents=True, exist_ok=True)
        self._pdf_target = str(target)
        self.view.printToPdf(str(target))

    def _on_pdf_printing_finished(self, path: str, success: bool) -> None:
        if self._pdf_target and path == self._pdf_target:
            self._pdf_target = None
            self.pdf_saved.emit(path, success)

    def _download_dir(self) -> Path:
        root = Path(
            QStandardPaths.writableLocation(
                QStandardPaths.StandardLocation.DownloadLocation
            )
        )
        return root / "Licitacoes" / (self.cnpj or "sem-cnpj")

    def _on_download_requested(self, download) -> None:
        provider = self.provider
        if not provider:
            download.cancel()
            return

        directory = self._download_dir()
        directory.mkdir(parents=True, exist_ok=True)
        name = provider.filename(self.cnpj or "documento")

        download.setDownloadDirectory(str(directory))
        download.setDownloadFileName(name)
        self._active_downloads.append(download)
        download.stateChanged.connect(
            lambda _state, current=download: self._on_download_state(current)
        )
        download.accept()
        self.download_started.emit(str(directory / name))

    def _on_download_state(self, download) -> None:
        if not download.isFinished():
            return

        path = Path(download.downloadDirectory()) / download.downloadFileName()
        ok = path.exists() and path.stat().st_size > 0
        self.download_finished.emit(str(path), ok)

        try:
            self._active_downloads.remove(download)
        except ValueError:
            pass
