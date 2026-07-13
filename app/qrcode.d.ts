declare module "qrcode" {
  interface QRCodeOptions {
    width?: number;
    margin?: number;
    color?: { dark?: string; light?: string };
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  }
  function toDataURL(text: string, options?: QRCodeOptions): Promise<string>;
  function toCanvas(
    canvas: HTMLCanvasElement,
    text: string,
    options?: QRCodeOptions
  ): Promise<void>;
  export default { toDataURL, toCanvas };
}
