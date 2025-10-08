/// <reference types="node" />

declare namespace PdfParse {
  interface Result {
    text: string;
    numpages: number;
    info: null;
    metadata: null;
    version: string;
  }
}

declare function pdfParse(dataBuffer: Buffer | ArrayBuffer | Uint8Array): Promise<PdfParse.Result>;

export = pdfParse;
