import type { ConsultaApiBody, MensagemConsultaDto } from "../../shared/api";
import { chamar } from "./cliente";

// Chat de consulta somente leitura (/api/v1/systems/:id/consulta, seção 15).

export interface EstadoConsulta {
  mensagens: MensagemConsultaDto[];
  iaDisponivel: boolean;
}

const estado = (r: ConsultaApiBody): EstadoConsulta => ({
  mensagens: r.mensagens ?? [],
  iaDisponivel: r.iaDisponivel ?? false,
});

export async function obterConsulta(sistema: string) {
  return estado(await chamar<ConsultaApiBody>(`/systems/${encodeURIComponent(sistema)}/consulta`));
}

export async function perguntar(sistema: string, texto: string, chave: string) {
  return estado(
    await chamar<ConsultaApiBody>(`/systems/${encodeURIComponent(sistema)}/consulta/mensagens`, {
      method: "POST",
      body: { texto },
      chave,
    }),
  );
}
