export class PublicError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PublicError";
    this.status = status;
  }
}

export function getErrorResponse(error: unknown) {
  if (error instanceof PublicError) {
    return {
      message: error.message,
      status: error.status,
    };
  }

  console.error(error);

  return {
    message: "Nao foi possivel concluir a acao agora.",
    status: 500,
  };
}
