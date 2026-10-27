"""Interface de linha de comando `exp`. O roteiro de uso está em docs/guia-sessao.md."""

from __future__ import annotations

import argparse
import dataclasses
import hashlib
import json
import platform
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from tcc_exp import analise_estatica, avaliacao, config, ia, sessao, sintetico, sorteio, tarefas, workspace
from tcc_exp import eventos as ev
from tcc_exp.analise import dashboard, pipeline


class ErroProtocolo(RuntimeError):
    pass


# ---------------------------------------------------------------- utilidades

def _arquivo_sessao(cfg: config.Config, exec_id: str) -> Path:
    return cfg.dados_brutos / "sessoes" / f"{exec_id}.jsonl"


def _estado(cfg, exec_id) -> sessao.EstadoSessao:
    return sessao.reconstruir(ev.ler(_arquivo_sessao(cfg, exec_id)))


def _registrar(cfg, exec_id, tipo, payload=None) -> dict:
    s = _estado(cfg, exec_id)
    sessao.proximo_estado(s.estado, tipo)  # levanta TransicaoInvalida antes de gravar
    return ev.registrar(_arquivo_sessao(cfg, exec_id), exec_id, tipo, payload)


def _ws(cfg, exec_id) -> Path:
    return cfg.workspaces / exec_id


def _tarefa_da_sessao(cfg, s: sessao.EstadoSessao) -> tarefas.Tarefa:
    return tarefas.carregar(cfg.tarefas, s.tarefa_id, cfg.base_dir)


def _minutos_ativos(cfg, exec_id) -> float:
    """Tempo ativo desde o início até AGORA (ou até o fim, se a execução já terminou)."""
    evs = ev.ler(_arquivo_sessao(cfg, exec_id))
    if not sessao.reconstruir(evs).finalizada:
        evs.append({"tipo": "nota", "ts": ev.agora_utc().isoformat()})  # marcador em memória, não gravado
    seg = sessao.tempo_ativo_desde_inicio(evs)
    return 0.0 if seg is None else seg / 60


def _selos_arquivo(cfg) -> Path:
    return cfg.raiz / "experiment" / "tasks" / f"selos-{cfg.fase}.json"


# ---------------------------------------------------------------- comandos

def cmd_verificar_ambiente(cfg, args) -> int:
    print(f"Fase: {cfg.fase}")
    print(f"Python: {sys.version.split()[0]} ({platform.platform()})")
    git = shutil.which("git")
    print(f"git: {'ok' if git else 'NÃO ENCONTRADO'}")
    for mod in ("pytest", "pandas", "scipy", "matplotlib", "ruff", "radon"):
        import importlib.util
        print(f"{mod}: {'ok' if importlib.util.find_spec(mod) else 'não instalado'}")
    print(f"Tarefas: {cfg.tarefas} ({'ok' if cfg.tarefas.exists() else 'NÃO EXISTE'})")
    print(f"Plano: {cfg.plano} ({'ok' if cfg.plano.exists() else 'ainda não sorteado'})")
    print(f"Workspaces: {cfg.workspaces}")
    try:
        ia.validar_ferramenta(cfg.experimento.get("ferramenta_ia", {}))
        print("Ferramenta de IA (condição B): configurada")
    except config.ErroConfiguracao as e:
        print(f"Ferramenta de IA (condição B): {e}")
    return 0


def cmd_sortear(cfg, args) -> int:
    pares = sorteio.ler_pares(Path(args.pares))
    saida = Path(args.saida) if args.saida else cfg.plano
    if saida.exists() and not args.sobrescrever:
        raise ErroProtocolo(f"{saida} já existe. Um plano sorteado não deve ser refeito "
                            "(use --sobrescrever apenas antes do congelamento).")
    linhas = sorteio.gerar_plano(pares, args.semente)
    digest = sorteio.salvar(linhas, saida, args.semente)
    print(f"Plano com {len(linhas)} execuções salvo em {saida} (sha256 {digest[:16]}…)")
    return 0


def cmd_selar(cfg, args) -> int:
    selos = {p.name: tarefas.hashes_pacote(p) for p in sorted(cfg.tarefas.iterdir())
             if (p / "task.toml").exists()}
    arq = _selos_arquivo(cfg)
    arq.write_text(json.dumps(selos, indent=2, sort_keys=True), encoding="utf-8")
    print(f"{len(selos)} pacote(s) selado(s) em {arq}. Versione este arquivo ANTES da coleta.")
    return 0


def cmd_validar_tarefa(cfg, args) -> int:
    ids = args.tarefas or sorted(p.name for p in cfg.tarefas.iterdir() if (p / "task.toml").exists())
    falhou = False
    for tid in ids:
        t = tarefas.carregar(cfg.tarefas, tid, cfg.base_dir)
        with tempfile.TemporaryDirectory(prefix="tcc-val-") as tmp:
            ini, ref = Path(tmp) / "inicial", Path(tmp) / "referencia"
            tarefas.montar_workspace(t, ini)
            tarefas.montar_workspace(t, ref, com_referencia=True)
            r_ini = avaliacao.rodar_pytest(ini, t.testes_ocultos, t.total_ocultos)
            r_ref_o = avaliacao.rodar_pytest(ref, t.testes_ocultos, t.total_ocultos)
            r_ref_p = avaliacao.rodar_pytest(ref, ref / "testes_publicos")
            r_ini_p = avaliacao.rodar_pytest(ini, ini / "testes_publicos")
        problemas = []
        if r_ref_o.taxa < 1:
            problemas.append(f"referência não passa todos os ocultos: {r_ref_o.reprovados}")
        if r_ref_p.taxa < 1:
            problemas.append(f"referência não passa todos os públicos: {r_ref_p.reprovados}")
        if r_ini.taxa >= 1:
            problemas.append("estado inicial já passa todos os ocultos (tarefa trivial)")
        nomes = set(r_ref_o.aprovados)
        if nomes and nomes != set(t.severidade):
            problemas.append(f"nomes dos testes ocultos ≠ manifesto: {sorted(nomes ^ set(t.severidade))}")
        status = "OK" if not problemas else "FALHA"
        falhou |= bool(problemas)
        print(f"[{status}] {tid}: inicial públicos {r_ini_p.taxa:.0%}, ocultos {r_ini.taxa:.0%} | "
              f"referência públicos {r_ref_p.taxa:.0%}, ocultos {r_ref_o.taxa:.0%}")
        for p in problemas:
            print(f"    - {p}")
    return 1 if falhou else 0


def cmd_abrir(cfg, args) -> int:
    exec_id = args.exec_id
    if ev.ler(_arquivo_sessao(cfg, exec_id)):
        raise ErroProtocolo(f"{exec_id} já foi aberta. Uma execução não é reaberta. Registre um desvio.")
    linha = sorteio.buscar(sorteio.ler_plano(cfg.plano), exec_id)
    # valida as condições ANTES de registrar qualquer coisa
    meta_ia = ia.metadados_condicao(linha["condicao"], cfg.experimento, args.confirmo_sem_ia, args.modelo)
    t = tarefas.carregar(cfg.tarefas, linha["tarefa_id"], cfg.base_dir)
    if cfg.fase == "principal":
        selos = tarefas.ler_selos(_selos_arquivo(cfg))
        if t.id not in selos:
            raise ErroProtocolo(f"Tarefa {t.id} não está selada em {_selos_arquivo(cfg)}")
        problemas = tarefas.verificar_selo(t.pacote, selos[t.id])
        if problemas:
            raise ErroProtocolo(f"Pacote {t.id} difere do selo: {problemas}")
    elif not t.piloto:
        raise ErroProtocolo(f"A tarefa {t.id} não é de piloto. Use TCC_FASE=principal.")

    ws = _ws(cfg, exec_id)
    tarefas.montar_workspace(t, ws)
    commit = workspace.iniciar(ws)
    estatica = analise_estatica.analisar(ws)
    _registrar(cfg, exec_id, "abertura", {
        "tarefa_id": t.id, "par": linha["par"], "tipo": linha["tipo"], "condicao": linha["condicao"],
        "posicao": int(linha["posicao"]), "ordem_no_par": int(linha["ordem_no_par"]),
        "commit_inicial": commit, "fase": cfg.fase, "workspace": str(ws),
        "protocolo_versao": cfg.experimento["experimento"]["protocolo_versao"],
        "executor": cfg.experimento["executor"]["id"],
        "python": sys.version.split()[0], "plataforma": platform.platform(),
    })
    _registrar(cfg, exec_id, "metadados_ia", meta_ia)
    _registrar(cfg, exec_id, "analise_estatica", {"momento": "inicial", "resultado": estatica})
    print(f"Execução {exec_id} aberta — condição {linha['condicao']} ({ia.CONDICOES[linha['condicao']]}).")
    print(f"Workspace: {ws}")
    print(f"Leia {ws / 'ENUNCIADO.md'} e, ao terminar a leitura, rode: exp iniciar {exec_id}")
    return 0


def cmd_simples(tipo: str):
    def cmd(cfg, args) -> int:
        payload = {"motivo": args.motivo} if getattr(args, "motivo", None) else {}
        _registrar(cfg, args.exec_id, tipo, payload)
        print(f"{args.exec_id}: {tipo} registrado. Tempo ativo: {_minutos_ativos(cfg, args.exec_id):.1f} min")
        return 0
    return cmd


def cmd_testar(cfg, args) -> int:
    s = _estado(cfg, args.exec_id)
    sessao.proximo_estado(s.estado, "teste_publico")
    ws = _ws(cfg, args.exec_id)
    r = avaliacao.rodar_pytest(ws, ws / "testes_publicos")
    commit = workspace.snapshot(ws, "teste público")
    _registrar(cfg, args.exec_id, "teste_publico", {"commit": commit, "resultado": r.como_dict()})
    print(r.saida)
    print(f"Testes públicos: {len(r.aprovados)}/{r.total} aprovados")
    return 0


def _finalizar(cfg, exec_id, motivo, s, ws) -> None:
    evs = ev.ler(_arquivo_sessao(cfg, exec_id))
    commit_final = workspace.snapshot(ws, f"fim ({motivo})")
    commit_ini = evs[0]["payload"]["commit_inicial"]
    primeira = next(e for e in evs if e["tipo"] == "entrega")["payload"]["commit"]
    a1, r1 = workspace.numstat(ws, primeira, commit_final)
    a2, r2 = workspace.numstat(ws, commit_ini, commit_final)
    _registrar(cfg, exec_id, "analise_estatica",
               {"momento": "final", "resultado": analise_estatica.analisar(ws)})
    _registrar(cfg, exec_id, "fim", {
        "motivo": motivo, "commit_final": commit_final,
        "churn_pos_1a_linhas": a1 + r1, "diff_total_linhas": a2 + r2,
    })


def _entregar(cfg, exec_id, forcada: bool, confianca: int | None = None) -> int:
    s = _estado(cfg, exec_id)
    sessao.proximo_estado(s.estado, "entrega")
    t = _tarefa_da_sessao(cfg, s)
    ws = _ws(cfg, exec_id)
    lim = cfg.experimento["experimento"]
    numero = s.entregas + 1
    commit = workspace.snapshot(ws, f"entrega {numero}")
    _registrar(cfg, exec_id, "entrega", {"numero": numero, "commit": commit, "forcada_por_limite": forcada,
                                         "confianca": confianca})
    r = avaliacao.rodar_pytest(ws, t.testes_ocultos, t.total_ocultos)
    _registrar(cfg, exec_id, "avaliacao", {"numero": numero, "resultado": r.como_dict()})

    excedeu = _minutos_ativos(cfg, exec_id) >= lim["limite_minutos"]
    if r.taxa >= 1:
        _finalizar(cfg, exec_id, "aceita", s, ws)
        print("Entrega ACEITA: todos os cenários de avaliação foram atendidos.")
    elif forcada or excedeu:
        _finalizar(cfg, exec_id, "limite", s, ws)
        print(f"Tempo-limite atingido. Execução encerrada com {r.taxa:.0%} dos cenários atendidos.")
    elif s.devolutivas >= lim["max_rodadas_correcao"]:
        _finalizar(cfg, exec_id, "rejeitada", s, ws)
        print(f"Rodadas de correção esgotadas. Execução encerrada com {r.taxa:.0%} dos cenários atendidos.")
    else:
        texto = avaliacao.devolutiva(r, t.descricao_ocultos)
        _registrar(cfg, exec_id, "devolutiva", {"numero": s.devolutivas + 1, "texto": texto})
        print("DEVOLUTIVA DA AVALIAÇÃO\n")
        print(texto)
        print(f"\nCorrija e rode `exp entregar {exec_id}` novamente.")
        return 0
    print(f"Registre sua percepção: exp percepcao {exec_id} <minutos que você estima ter gasto>")
    return 0


def cmd_entregar(cfg, args) -> int:
    return _entregar(cfg, args.exec_id, forcada=False, confianca=args.confianca)


def cmd_questionario(cfg, args) -> int:
    s = _estado(cfg, args.exec_id)
    if not s.finalizada:
        raise ErroProtocolo("O questionário é respondido depois do fim da execução.")
    if args.utilidade_ia is not None and s.condicao != "B":
        raise ErroProtocolo("--utilidade-ia só se aplica à condição B.")
    _registrar(cfg, args.exec_id, "questionario", {
        "dificuldade": args.dificuldade, "esforco": args.esforco,
        "utilidade_ia": args.utilidade_ia, "comentario": args.comentario,
    })
    print("Questionário registrado.")
    return 0


def cmd_encerrar_limite(cfg, args) -> int:
    return _entregar(cfg, args.exec_id, forcada=True)


def cmd_abortar(cfg, args) -> int:
    _registrar(cfg, args.exec_id, "aborto", {"motivo": args.motivo})
    print(f"{args.exec_id} abortada: {args.motivo}. Registre o desvio em docs/desvios.md.")
    return 0


def cmd_nota(cfg, args) -> int:
    _registrar(cfg, args.exec_id, "nota", {"texto": args.texto})
    return 0


def cmd_percepcao(cfg, args) -> int:
    _registrar(cfg, args.exec_id, "percepcao", {"estimativa_min": args.minutos})
    return 0


def cmd_anexar(cfg, args) -> int:
    origem = Path(args.arquivo)
    destino = cfg.dados_brutos / "anexos" / args.exec_id / origem.name
    if destino.exists():
        raise ErroProtocolo(f"{destino} já existe. Anexos não são sobrescritos.")
    destino.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(origem, destino)
    sha = hashlib.sha256(destino.read_bytes()).hexdigest()
    _registrar(cfg, args.exec_id, "anexo", {"arquivo": destino.name, "sha256": sha, "descricao": args.descricao})
    print(f"Anexado: {destino}")
    return 0


def cmd_status(cfg, args) -> int:
    s = _estado(cfg, args.exec_id)
    lim = cfg.experimento["experimento"]["limite_minutos"]
    ativo = _minutos_ativos(cfg, args.exec_id)
    print(f"{args.exec_id}: estado={s.estado} tarefa={s.tarefa_id} condição={s.condicao} "
          f"entregas={s.entregas} devolutivas={s.devolutivas}")
    print(f"Tempo ativo: {ativo:.1f} min de {lim} (restam {max(0, lim - ativo):.1f})")
    return 0


def cmd_processar(cfg, args) -> int:
    print(f"Gerado: {pipeline.processar(cfg)}")
    return 0


def cmd_analisar(cfg, args) -> int:
    print(f"Gerado: {pipeline.analisar(cfg, Path(args.saida) if args.saida else None)}")
    return 0


def cmd_dashboard(cfg, args) -> int:
    print(f"Gerado: {dashboard.gerar(cfg, Path(args.saida) if args.saida else None)}")
    return 0


def cmd_demo_dashboard(cfg, args) -> int:
    """Dashboard de DEMONSTRAÇÃO com dados sintéticos de efeito nulo, sempre fora de reports/ e data/."""
    saida = Path(args.saida).resolve()
    for proibido in (cfg.raiz / "reports", cfg.raiz / "data"):
        if saida.is_relative_to(proibido.resolve()):
            raise ErroProtocolo(f"A demonstração sintética não pode ser gravada em {proibido}.")
    tmp = saida / "_dados_sinteticos"
    if tmp.exists():
        shutil.rmtree(tmp)
    piloto = cfg.raiz / "experiment" / "tasks" / "piloto"
    cfg_demo = dataclasses.replace(
        cfg, fase="demonstracao", tarefas=piloto, dados_brutos=tmp / "raw",
        dados_processados=tmp / "processed", plano=tmp / "sem-plano.csv", relatorios=tmp / "nao-usar",
    )
    pares = {"T1": ("P1a", "P1b"), "T2": ("P3a", "P3b"), "T3": ("P2a", "P2b"), "T4": ("P4a", "P4b")}
    ocultos = {t: list(tarefas.carregar(piloto, t, cfg.base_dir).severidade) for par in pares.values() for t in par}
    n = sintetico.gerar_conjunto_demo(cfg_demo.dados_brutos / "sessoes", pares, ocultos, semente=args.semente)
    pipeline.processar(cfg_demo)
    arq = dashboard.gerar(cfg_demo, saida)
    print(f"{n} execuções SINTÉTICAS (efeito nulo) → {arq}")
    return 0


# ---------------------------------------------------------------- parser

def construir_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="exp", description="Instrumento do experimento do TCC")
    sub = p.add_subparsers(dest="comando", required=True)

    def com_exec(nome, func, ajuda, motivo=False):
        sp = sub.add_parser(nome, help=ajuda)
        sp.add_argument("exec_id")
        if motivo:
            sp.add_argument("--motivo", default=None)
        sp.set_defaults(func=func)
        return sp

    sp = sub.add_parser("verificar-ambiente", help="Mostra ferramentas, caminhos e configuração")
    sp.set_defaults(func=cmd_verificar_ambiente)

    sp = sub.add_parser("sortear", help="Gera o plano de randomização")
    sp.add_argument("--pares", required=True, help="TOML com a lista de pares de tarefas")
    sp.add_argument("--semente", type=int, required=True)
    sp.add_argument("--saida")
    sp.add_argument("--sobrescrever", action="store_true")
    sp.set_defaults(func=cmd_sortear)

    sp = sub.add_parser("selar", help="Registra os hashes dos pacotes de tarefa da fase")
    sp.set_defaults(func=cmd_selar)

    sp = sub.add_parser("validar-tarefa", help="Confere estado inicial e solução de referência")
    sp.add_argument("tarefas", nargs="*")
    sp.set_defaults(func=cmd_validar_tarefa)

    sp = com_exec("abrir", cmd_abrir, "Monta o workspace e exibe o enunciado")
    sp.add_argument("--confirmo-sem-ia", action="store_true")
    sp.add_argument("--modelo", help="Modelo efetivamente exibido pela ferramenta (condição B)")
    com_exec("iniciar", cmd_simples("inicio"), "Fim da leitura, início do trabalho")
    com_exec("pausar", cmd_simples("pausa"), "Pausa (interrupção externa)", motivo=True)
    com_exec("retomar", cmd_simples("retomada"), "Retoma após pausa")
    com_exec("testar", cmd_testar, "Roda os testes públicos")
    sp = com_exec("entregar", cmd_entregar, "Entrega a solução para avaliação")
    sp.add_argument("--confianca", type=int, choices=range(1, 6),
                    help="1–5: quão confiante você está de que a entrega atende a TODOS os cenários")
    sp = com_exec("questionario", cmd_questionario, "Questionário pós-sessão (escalas 1–5)")
    sp.add_argument("--dificuldade", type=int, choices=range(1, 6), required=True,
                    help="1 = muito fácil … 5 = muito difícil")
    sp.add_argument("--esforco", type=int, choices=range(1, 6), required=True,
                    help="esforço mental: 1 = muito baixo … 5 = muito alto")
    sp.add_argument("--utilidade-ia", type=int, choices=range(1, 6),
                    help="só condição B: 1 = atrapalhou muito … 5 = ajudou muito")
    sp.add_argument("--comentario", default="")
    com_exec("encerrar-limite", cmd_encerrar_limite, "Encerra ao atingir o tempo-limite")
    sp = com_exec("abortar", cmd_abortar, "Aborta por falha de ambiente/API")
    sp.add_argument("--motivo", required=True)
    sp = com_exec("nota", cmd_nota, "Registra uma observação")
    sp.add_argument("texto")
    sp = com_exec("percepcao", cmd_percepcao, "Estimativa do executor sobre o tempo gasto")
    sp.add_argument("minutos", type=float)
    sp = com_exec("anexar", cmd_anexar, "Anexa transcrição da IA ou outro arquivo bruto")
    sp.add_argument("arquivo")
    sp.add_argument("--descricao", default="")
    com_exec("status", cmd_status, "Mostra o estado da execução")

    sp = sub.add_parser("processar", help="data/raw → data/processed")
    sp.set_defaults(func=cmd_processar)
    sp = sub.add_parser("analisar", help="data/processed → reports")
    sp.add_argument("--saida")
    sp.set_defaults(func=cmd_analisar)
    sp = sub.add_parser("dashboard", help="Gera reports/<fase>/dashboard.html a partir dos dados reais")
    sp.add_argument("--saida")
    sp.set_defaults(func=cmd_dashboard)
    sp = sub.add_parser("demo-dashboard", help="Dashboard de DEMONSTRAÇÃO com dados sintéticos (efeito nulo)")
    sp.add_argument("--saida", required=True, help="Diretório fora de reports/ e data/")
    sp.add_argument("--semente", type=int, default=7)
    sp.set_defaults(func=cmd_demo_dashboard)
    return p


def main(argv: list[str] | None = None) -> int:
    for fluxo in (sys.stdout, sys.stderr):
        if hasattr(fluxo, "reconfigure"):
            fluxo.reconfigure(encoding="utf-8")
    args = construir_parser().parse_args(argv)
    try:
        cfg = config.carregar()
        return args.func(cfg, args)
    except (config.ErroConfiguracao, ErroProtocolo, sessao.TransicaoInvalida, tarefas.ErroTarefa,
            workspace.ErroGit, KeyError, FileNotFoundError, subprocess.SubprocessError) as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1
