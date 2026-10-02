import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';

import { mapHttpException } from './map-http-exception';
import { respondWithMappedException } from './respond-with-http-error';

/** Catch-all for routes that do not install a module filter. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    respondWithMappedException(exception, host, mapHttpException);
  }
}
