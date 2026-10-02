import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';

import { mapHttpException } from '../../../common/http/map-http-exception';
import { respondWithMappedException } from '../../../common/http/respond-with-http-error';

/**
 * Same mapping as the global filter.
 * The lower-level auth harness still constructs this class. Nest controllers do not.
 */
@Catch()
export class IdentityExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    respondWithMappedException(exception, host, mapHttpException);
  }
}
