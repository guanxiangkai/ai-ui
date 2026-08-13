import type { PlatformRequestClient, PlatformRequestOptions } from "../../src/types.js";

export interface RecordedRequest {
  path: string;
  options: PlatformRequestOptions;
}

export class RecordingTransport implements PlatformRequestClient {
  readonly calls: RecordedRequest[] = [];

  constructor(
    private readonly response: unknown = {
      records: [],
      total: 0,
    },
  ) {}

  async request<T>(path: string, options: PlatformRequestOptions = {}): Promise<T> {
    this.calls.push({ path, options });
    return this.response as T;
  }
}
