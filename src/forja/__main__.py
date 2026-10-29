"""Linha de comando: python -m forja validar <mapa.json> [--json]

Códigos de saída: 0 = válido (avisos permitidos); 1 = há erros; 2 = arquivo ilegível ou JSON inválido.
"""

from __future__ import annotations

import argparse
import json
import sys


def main(argv: list[str] | None = None) -> int:
    for fluxo in (sys.stdout, sys.stderr):
        if hasattr(fluxo, "reconfigure"):
            fluxo.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser(prog="python -m forja", description="Forja: validação do mapa do sistema")
    sub = p.add_subparsers(dest="comando", required=True)
    sp = sub.add_parser("validar", help="Valida um mapa (estrutura e semântica)")
    sp.add_argument("arquivo")
    sp.add_argument("--json", action="store_true", help="Saída em JSON (lista de erros)")
    args = p.parse_args(argv)

    from .validacao import tem_erros, validar_arquivo

    try:
        erros = validar_arquivo(args.arquivo)
    except (OSError, json.JSONDecodeError, UnicodeDecodeError) as e:
        print(f"ERRO: não foi possível ler '{args.arquivo}': {e}", file=sys.stderr)
        return 2

    if args.json:
        print(json.dumps([e.como_dict() for e in erros], ensure_ascii=False, indent=2))
    else:
        for e in erros:
            print(f"{e.severidade.upper():5} {e.codigo:32} {e.caminho or '/'}  {e.mensagem}")
        n_erros = sum(e.severidade == "erro" for e in erros)
        n_avisos = len(erros) - n_erros
        print(f"{'INVÁLIDO' if n_erros else 'VÁLIDO'}: {n_erros} erro(s), {n_avisos} aviso(s).")
    return 1 if tem_erros(erros) else 0


if __name__ == "__main__":
    raise SystemExit(main())
