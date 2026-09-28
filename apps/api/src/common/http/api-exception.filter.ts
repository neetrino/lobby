import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';

import { ApiError } from './api-error';

type ErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

type ErrorResponse = {
  status(statusCode: number): { json(body: ErrorBody): void };
};

@Catch(ApiError)
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: ApiError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<ErrorResponse>();
    response.status(exception.statusCode).json({
      error: { code: exception.code, message: exception.message },
    });
  }
}
