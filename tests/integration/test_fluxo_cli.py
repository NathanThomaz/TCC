"""Fluxo completo de uma execução-piloto pela CLI, num projeto temporário."""

import shutil

import pandas as pd

from tcc_exp import cli, config, tarefas
from tcc_exp import eventos as ev


def test_execucao_completa_com_devolutiva(projeto, capsys, tmp_path):
    plano = {l.split(",")[1]: l.split(",") for l in
             (projeto / "experiment/randomization/plano-piloto.csv").read_text().splitlines()[2:]}
    # escolhe a execução do plano que é da condição A e da tarefa P1a ou P2a
    exec_id = next(k for k, v in plano.items() if v[5] == "A")
    tarefa = plano[exec_id][4]

    assert cli.main(["abrir", exec_id]) == 1  # sem --confirmo-sem-ia: recusado, nada gravado
    cfg = config.carregar()
    assert not (cfg.dados_brutos / "sessoes" / f"{exec_id}.jsonl").exists()

    assert cli.main(["abrir", exec_id, "--confirmo-sem-ia"]) == 0
    ws = cfg.workspaces / exec_id
    assert (ws / "ENUNCIADO.md").exists()
    assert not any("testes_ocultos" in p.parts for p in ws.rglob("*"))

    assert cli.main(["entregar", exec_id]) == 1  # ainda não iniciou
    assert cli.main(["iniciar", exec_id]) == 0
    assert cli.main(["testar", exec_id]) == 0
    assert cli.main(["questionario", exec_id, "--dificuldade", "3", "--esforco", "2"]) == 1  # antes do fim
    assert cli.main(["entregar", exec_id, "--confianca", "4"]) == 0  # estado inicial com defeito → devolutiva
    assert "DEVOLUTIVA" in capsys.readouterr().out

    # "corrige" aplicando a solução de referência da tarefa sobre o workspace
    ref = tmp_path / "ref"
    tarefas.montar_workspace(tarefas.carregar(cfg.tarefas, tarefa, cfg.base_dir), ref, com_referencia=True)
    shutil.copytree(ref / "loja", ws / "loja", dirs_exist_ok=True)
    assert cli.main(["entregar", exec_id]) == 0
    assert "ACEITA" in capsys.readouterr().out
    assert cli.main(["percepcao", exec_id, "12"]) == 0
    assert cli.main(["questionario", exec_id, "--dificuldade", "3", "--esforco", "2",
                     "--utilidade-ia", "4"]) == 1  # condição A não avalia utilidade da IA
    assert cli.main(["questionario", exec_id, "--dificuldade", "3", "--esforco", "2"]) == 0

    arq = cfg.dados_brutos / "sessoes" / f"{exec_id}.jsonl"
    assert ev.verificar_cadeia(arq) == []
    tipos = [e["tipo"] for e in ev.ler(arq)]
    assert tipos.count("entrega") == 2 and tipos.count("devolutiva") == 1 and "fim" in tipos

    assert cli.main(["processar"]) == 0
    df = pd.read_csv(cfg.dados_processados / "execucoes.csv")
    linha = df.iloc[0]
    assert linha["aceita"] and linha["ciclos"] == 1 and linha["conforme_plano"]
    assert 0 < linha["taxa_ocultos_1a"] < 1 and linha["taxa_ocultos_final"] == 1
    assert linha["churn_pos_1a_linhas"] > 0
    assert linha["confianca_1a"] == 4 and linha["dificuldade_percebida"] == 3

    assert cli.main(["analisar"]) == 0
    rel = (cfg.relatorios / "relatorio-experimento.md").read_text(encoding="utf-8")
    assert "Menos de 2 pares completos" in rel


def test_abrir_duas_vezes_e_recusado(projeto):
    cfg = config.carregar()
    linha = (projeto / "experiment/randomization/plano-piloto.csv").read_text().splitlines()[2].split(",")
    exec_id, cond = linha[1], linha[5]
    args = ["abrir", exec_id] + (["--confirmo-sem-ia"] if cond == "A" else [])
    if cond == "B":
        return  # condição B exige a ferramenta configurada (D3); coberto nos testes unitários
    assert cli.main(args) == 0
    assert cli.main(args) == 1
    assert len(ev.ler(cfg.dados_brutos / "sessoes" / f"{exec_id}.jsonl")) == 3
