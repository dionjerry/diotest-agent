export interface PrContext {
  repo: string;
  prNumber: number;
  title: string;
  description: string;
  changedFiles: string[];
  url: string;
}

export interface RawPrContext {
  repo?: string;
  prNumber?: number | string;
  title?: string;
  description?: string;
  changedFiles?: string[];
  url?: string;
}

export interface PrExtractSuccess {
  ok: true;
  context: PrContext;
}

export interface PrExtractFailure {
  ok: false;
  error: string;
}

export type PrExtractResult = PrExtractSuccess | PrExtractFailure;
