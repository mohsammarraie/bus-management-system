import { ParamMap, Params } from '@angular/router';
import { BusQuery, DEFAULT_BUS_QUERY } from './buses.models';

export function busEditIdFromParams(params: ParamMap): number | null {
  const value = params.getAll('edit').length === 1 ? params.get('edit') : null;
  const id = value !== null && /^[1-9]\d*$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(id) ? id : null;
}

export function busQueryFromParams(params: ParamMap): BusQuery {
  // Reject repeated values rather than choosing an ambiguous first/last parameter.
  const single = (key: string) => (params.getAll(key).length === 1 ? params.get(key) : null);
  const integer = (key: string, min: number, max: number, fallback: number) => {
    const value = single(key);
    const number = value !== null && /^\d+$/.test(value) ? Number(value) : NaN;
    return Number.isSafeInteger(number) && number >= min && number <= max ? number : fallback;
  };
  const q = single('q')?.trim() ?? '';
  const active = single('active');
  const sort = single('sort');
  return {
    q: q.length <= 100 ? q : '',
    active: active === 'true' || active === 'false' ? active : 'all',
    page: integer('page', 0, 10000, DEFAULT_BUS_QUERY.page),
    size: integer('size', 1, 100, DEFAULT_BUS_QUERY.size),
    sort:
      sort === 'registrationNumber' || sort === 'capacity' || sort === 'active'
        ? sort
        : DEFAULT_BUS_QUERY.sort,
    direction: single('direction') === 'desc' ? 'desc' : 'asc',
  };
}

export function busQueryParams(query: BusQuery): Params {
  // Null removes an old value when merging. Defaults keep the URL short.
  return {
    q: query.q || null,
    active: query.active === 'all' ? null : query.active,
    page: query.page === DEFAULT_BUS_QUERY.page ? null : query.page,
    size: query.size === DEFAULT_BUS_QUERY.size ? null : query.size,
    sort: query.sort === DEFAULT_BUS_QUERY.sort ? null : query.sort,
    direction: query.direction === DEFAULT_BUS_QUERY.direction ? null : query.direction,
  };
}

export function sameBusQuery(left: BusQuery, right: BusQuery): boolean {
  return (
    left.q === right.q &&
    left.active === right.active &&
    left.page === right.page &&
    left.size === right.size &&
    left.sort === right.sort &&
    left.direction === right.direction
  );
}
