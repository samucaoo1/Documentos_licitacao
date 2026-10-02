from __future__ import annotations

import re
from pathlib import Path

from PySide6.QtCore import QStandardPaths, Qt, QUrl
from PySide6.QtGui import QDesktopServices
from PySide6.QtWidgets import (
    QComboBox,
    QFormLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QSplitter,
    QVBoxLayout,
    QWidget,
)

from .browser import EmbeddedBrowser
from .models import DocumentState
from .providers import PROVIDERS
from .workflow import Workflow


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Documentos de Licitação")
        self.resize(1380, 860)

        self.browser = EmbeddedBrowser(self)
        self.workflow = Workflow(self.browser, self)
        self.workflow.changed.connect(self.refresh_jobs)
        self.workflow.message.connect(self.statusBar().showMessage)

        self.cnpj = QLineEdit()
        self.cnpj.setPlaceholderText("00.000.000/0000-00")
        self.uf = QComboBox()
        self.uf.addItems(
            [
                "MG",
                "SP",
                "RJ",
                "ES",
                "BA",
                "PR",
                "SC",
                "RS",
                "GO",
                "DF",
                "PE",
                "CE",
            ]
        )

        self.start_button = QPushButton("Emitir documentação")
        self.start_button.clicked.connect(self.start_workflow)

        self.save_pdf_button = QPushButton("Salvar página em PDF")
        self.save_pdf_button.clicked.connect(self.workflow.save_current_pdf)

        self.next_button = QPushButton("Próxima certidão")
        self.next_button.clicked.connect(self.workflow.next)

        self.folder_button = QPushButton("Abrir pasta de downloads")
        self.folder_button.clicked.connect(self.open_downloads)

        form = QFormLayout()
        form.addRow("CNPJ", self.cnpj)
        form.addRow("UF", self.uf)

        buttons = QVBoxLayout()
        buttons.addWidget(self.start_button)
        buttons.addWidget(self.save_pdf_button)
        buttons.addWidget(self.next_button)
        buttons.addWidget(self.folder_button)

        left = QWidget()
        left.setMinimumWidth(330)
        left.setMaximumWidth(440)
        left_layout = QVBoxLayout(left)

        title = QLabel("<h2>Documentos do licitante</h2>")
        subtitle = QLabel(
            "Um portal por vez. O aplicativo preenche o CNPJ; você resolve "
            "CAPTCHA e usa os botões oficiais quando necessário."
        )
        subtitle.setWordWrap(True)

        self.current_label = QLabel("Nenhum processo iniciado.")
        self.current_label.setWordWrap(True)

        self.jobs = QListWidget()
        self.jobs.setSpacing(6)

        left_layout.addWidget(title)
        left_layout.addWidget(subtitle)
        left_layout.addLayout(form)
        left_layout.addLayout(buttons)
        left_layout.addWidget(self.current_label)
        left_layout.addWidget(self.jobs, 1)

        splitter = QSplitter(Qt.Orientation.Horizontal)
        splitter.addWidget(left)
        splitter.addWidget(self.browser)
        splitter.setStretchFactor(0, 0)
        splitter.setStretchFactor(1, 1)
        splitter.setSizes([360, 1020])

        root = QWidget()
        layout = QHBoxLayout(root)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.addWidget(splitter)
        self.setCentralWidget(root)

        self.refresh_jobs()

    @staticmethod
    def clean_cnpj(value: str) -> str:
        return re.sub(r"\D", "", value)

    def start_workflow(self) -> None:
        cnpj = self.clean_cnpj(self.cnpj.text())

        if len(cnpj) != 14:
            QMessageBox.warning(
                self,
                "CNPJ",
                "Informe um CNPJ com 14 dígitos.",
            )
            return

        self.workflow.start(cnpj, self.uf.currentText())
        self.current_label.setText(
            f"Processo atual: {cnpj} · {self.uf.currentText()}"
        )

    def refresh_jobs(self) -> None:
        labels = {
            DocumentState.QUEUED: "○",
            DocumentState.LOADING: "◌",
            DocumentState.WORKING: "◌",
            DocumentState.NEEDS_HUMAN: "⚠",
            DocumentState.RESULT_READY: "●",
            DocumentState.DOWNLOADING: "↓",
            DocumentState.DOWNLOADED: "✓",
            DocumentState.ERROR: "✕",
        }

        self.jobs.clear()
        current = self.workflow.current_provider

        for provider in PROVIDERS:
            job = self.workflow.jobs[provider.id]
            item = QListWidgetItem(
                f"{labels[job.state]}  {job.title}\n    {job.message}"
            )

            if current and current.id == provider.id:
                font = item.font()
                font.setBold(True)
                item.setFont(font)

            self.jobs.addItem(item)

        self.save_pdf_button.setEnabled(
            bool(
                current
                and current.printable_result
                and self.workflow.jobs[current.id].state
                == DocumentState.RESULT_READY
            )
        )
        self.next_button.setEnabled(current is not None)

    def open_downloads(self) -> None:
        root = (
            Path(
                QStandardPaths.writableLocation(
                    QStandardPaths.StandardLocation.DownloadLocation
                )
            )
            / "Licitacoes"
        )
        root.mkdir(parents=True, exist_ok=True)
        QDesktopServices.openUrl(QUrl.fromLocalFile(str(root)))
