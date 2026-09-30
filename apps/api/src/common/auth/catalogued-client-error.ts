export type ClientErrorSpec = {
  readonly message: string;
  readonly statusCode: number;
};

export type CataloguedClientPayload = {
  code: string;
  message: string;
  statusCode: number;
};

/**
 * Client-visible failure selected from a closed code catalog.
 * Subclasses accept a code only. The HTTP mapper reads `toClientPayload()`, not `Error.message`.
 */
export abstract class CataloguedClientError extends Error {
  readonly code: string;
  readonly statusCode: number;
  private readonly clientMessage: string;

  protected constructor(code: string, spec: ClientErrorSpec) {
    super(spec.message);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = spec.statusCode;
    this.clientMessage = spec.message;
  }

  toClientPayload(): CataloguedClientPayload {
    return {
      code: this.code,
      message: this.clientMessage,
      statusCode: this.statusCode,
    };
  }
}
