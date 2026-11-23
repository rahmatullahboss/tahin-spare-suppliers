#!/usr/bin/env python3
"""Safely configure a local PostgreSQL service for the isolated Aiven staging DB.

Paste the service URI at the hidden terminal prompt. Never pass it as an
argument, place it in the repository, or paste it into a chat.
"""
from __future__ import annotations

import getpass
import os
from pathlib import Path
import sys
from urllib.parse import unquote, urlsplit

DESTINATION_HOST = "pg-377bd8ee-rahmatullahzisan-5bcc.c.aivencloud.com"
DESTINATION_PORT = 20381
DESTINATION_DB = "tahinspare_staging"
SERVICE_NAME = "tahin_aiven_staging"


def quote_passfile(value: str) -> str:
    return value.replace("\\", "\\\\").replace(":", "\\:")


def write_private(path: Path, text: str) -> None:
    flags = os.O_CREAT | os.O_WRONLY | os.O_TRUNC
    descriptor = os.open(path, flags, 0o600)
    os.fchmod(descriptor, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
        stream.write(text)


def main() -> int:
    if not sys.stdin.isatty():
        print("Interactive terminal required; no credentials accepted in arguments.", file=sys.stderr)
        return 2
    try:
        raw = getpass.getpass("Paste the Aiven service URI here (hidden input): ")
        parsed = urlsplit(raw)
        if parsed.scheme not in {"postgres", "postgresql"}:
            raise ValueError("Invalid PostgreSQL URI scheme")
        if parsed.hostname != DESTINATION_HOST or parsed.port != DESTINATION_PORT:
            raise ValueError("URI does not belong to the selected Aiven PostgreSQL service")
        username = unquote(parsed.username or "")
        credential = unquote(parsed.password or "")
        if not username or not credential:
            raise ValueError("Incomplete PostgreSQL connection information")
        directory = Path.home() / ".config" / "tahin-spare"
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        directory.chmod(0o700)
        configuration = (
            f"[{SERVICE_NAME}]\n"
            f"host={DESTINATION_HOST}\n"
            f"port={DESTINATION_PORT}\n"
            f"dbname={DESTINATION_DB}\n"
            f"user={username}\n"
            "sslmode=require\n"
        )
        pass_line = (
            f"{quote_passfile(DESTINATION_HOST)}:{DESTINATION_PORT}:"
            f"{quote_passfile(DESTINATION_DB)}:{quote_passfile(username)}:"
            f"{quote_passfile(credential)}\n"
        )
        write_private(directory / "aiven-pg-service.conf", configuration)
        write_private(directory / "aiven-pgpass", pass_line)
        print("Aiven staging connection configured locally with restricted permissions.")
        print("No connection credentials were uploaded to the repository.")
        return 0
    except (ValueError, OSError) as error:
        print(f"Setup failed: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
