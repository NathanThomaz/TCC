import type { PedidoDto, PedidosApiBody } from "../../shared/api";
import { chamar, novaChave } from "./cliente";

// Pedidos ao desenvolvedor (/api/v1/systems/:id/pedidos), ADR-004.

function base(sistema: string) {
  return `/systems/${encodeURIComponent(sistema)}/pedidos`;
}

export async function listarPedidos(sistema: string): Promise<PedidoDto[]> {
  return (await chamar<PedidosApiBody>(base(sistema))).pedidos ?? [];
}

export async function criarPedido(
  sistema: string,
  titulo: string,
  pedido: string,
  chave = novaChave(),
): Promise<PedidoDto> {
  const r = await chamar<PedidosApiBody>(base(sistema), {
    method: "POST",
    body: { titulo, pedido },
    chave,
  });
  return r.pedido!;
}

export async function comentarPedido(
  sistema: string,
  id: string,
  texto: string,
  chave = novaChave(),
): Promise<PedidoDto> {
  const r = await chamar<PedidosApiBody>(`${base(sistema)}/${encodeURIComponent(id)}/comentarios`, {
    method: "POST",
    body: { texto },
    chave,
  });
  return r.pedido!;
}

export async function cancelarPedido(
  sistema: string,
  id: string,
  chave = novaChave(),
): Promise<PedidoDto> {
  const r = await chamar<PedidosApiBody>(`${base(sistema)}/${encodeURIComponent(id)}/cancelar`, {
    method: "POST",
    body: {},
    chave,
  });
  return r.pedido!;
}
