// Leitura de código de barras pela câmera. Usa o BarcodeDetector do navegador quando ele existe
// (Chrome no Android); nos demais (Chrome no Windows, Firefox, Safari), a biblioteca zxing em
// WebAssembly, carregada só quando a câmera abre e servida pelo próprio Nexus, sem serviço externo.

export interface Detector {
  detect: (fonte: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
}

interface ConstrutorDetector {
  new (o?: { formats?: string[] }): Detector;
  getSupportedFormats?: () => Promise<string[]>;
}

export const FORMATOS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"];

/** Há câmera para pedir (o navegador só oferece em conexão segura). */
export function temCamera(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

async function detectorNativo(): Promise<Detector | null> {
  const Nativo = (window as unknown as { BarcodeDetector?: ConstrutorDetector }).BarcodeDetector;
  if (!Nativo) return null;
  try {
    // Alguns navegadores expõem o construtor sem ler nenhum formato.
    const suportados = (await Nativo.getSupportedFormats?.()) ?? FORMATOS;
    const formatos = FORMATOS.filter((f) => suportados.includes(f));
    return formatos.length ? new Nativo({ formats: formatos }) : null;
  } catch {
    return null;
  }
}

export async function criarDetector(): Promise<Detector> {
  const nativo = await detectorNativo();
  if (nativo) return nativo;
  const [{ BarcodeDetector, setZXingModuleOverrides }, { default: wasm }] = await Promise.all([
    import("barcode-detector/ponyfill"),
    import("zxing-wasm/reader/zxing_reader.wasm?url"),
  ]);
  setZXingModuleOverrides({
    locateFile: (caminho: string, prefixo: string) =>
      caminho.endsWith(".wasm") ? new URL(wasm, window.location.href).href : prefixo + caminho,
  });
  return new BarcodeDetector({ formats: FORMATOS as never });
}

/** Mensagem para a pessoa quando a câmera não abre. */
export function motivoCamera(erro: unknown): string {
  const nome = erro instanceof DOMException ? erro.name : "";
  if (nome === "NotAllowedError" || nome === "SecurityError") {
    return "A câmera foi bloqueada. Libere em Permissões do site (cadeado ao lado do endereço) e tente de novo.";
  }
  if (nome === "NotFoundError" || nome === "OverconstrainedError") {
    return "Nenhuma câmera encontrada neste aparelho. Use o leitor USB ou digite o código.";
  }
  if (nome === "NotReadableError") {
    return "A câmera está em uso por outro programa. Feche-o e tente de novo.";
  }
  return "Não foi possível abrir a câmera. Tente de novo ou digite o código.";
}
