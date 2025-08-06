import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class ResponseHeaderInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse();
    response.setHeader('Content-Type', 'application/json');
    return next.handle().pipe(
      tap(() => {
        // console.log('Final headers:', response.getHeaders());
      })
    );
  }
}
