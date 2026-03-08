export interface PrContext {
  pageType: "pull_request" | "commit";
  repo: string;
  prNumber?: number;
  commitSha?: string;
  title: string;
  description: string;
  changedFiles: string[];
  url: string;
}

export interface RawPrContext {
  pageType?: "pull_request" | "commit";
  repo?: string;
  prNumber?: number | string;
  commitSha?: string;
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
