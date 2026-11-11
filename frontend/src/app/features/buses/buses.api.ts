import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, timeout } from 'rxjs';
import { Bus, BusCommand, BusPage, BusQuery } from './buses.models';

@Injectable()
export class BusesApi {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/v1/buses';

  list(query: BusQuery): Observable<BusPage> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('size', query.size)
      .set('sort', query.sort)
      .set('direction', query.direction);
    if (query.q) params = params.set('q', query.q);
    if (query.active !== 'all') params = params.set('active', query.active);
    return this.http.get<BusPage>(this.url, { params }).pipe(timeout(10000));
  }

  get(id: number): Observable<Bus> {
    return this.http.get<Bus>(`${this.url}/${id}`).pipe(timeout(10000));
  }

  save(command: BusCommand): Observable<Bus | null> {
    // Angular HttpClient supplies the raw XSRF-TOKEN cookie in X-XSRF-TOKEN for these relative URLs.
    let result: Observable<Bus | null>;
    switch (command.kind) {
      case 'create':
        result = this.http.post<Bus>(this.url, command.draft);
        break;
      case 'update':
        result = this.http.put<Bus>(`${this.url}/${command.bus.id}`, {
          ...command.draft,
          version: command.bus.version,
        });
        break;
      case 'delete':
        result = this.http
          .delete<void>(`${this.url}/${command.bus.id}`, {
            params: { version: command.bus.version },
          })
          .pipe(map(() => null));
    }
    return result.pipe(timeout(10000));
  }
}
