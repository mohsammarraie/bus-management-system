import { convertToParamMap } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { BusQuery, DEFAULT_BUS_QUERY } from './buses.models';
import {
  busEditIdFromParams,
  busQueryFromParams,
  busQueryParams,
  sameBusQuery,
} from './buses-query';

describe('bus URL query contract', () => {
  it('accepts one safe positive edit ID and rejects ambiguous or invalid IDs', () => {
    expect(busEditIdFromParams(convertToParamMap({ edit: '7' }))).toBe(7);
    for (const edit of [undefined, '', '0', '-1', '1.5', '1e2', '9007199254740992', ['7', '8']]) {
      expect(busEditIdFromParams(convertToParamMap(edit === undefined ? {} : { edit }))).toBeNull();
    }
    expect(busQueryFromParams(convertToParamMap({ edit: '7' }))).toEqual(DEFAULT_BUS_QUERY);
  });
  it('restores all query fields, including false status and zero-based pages', () => {
    expect(
      busQueryFromParams(
        convertToParamMap({
          q: ' DEMO ',
          active: 'false',
          page: '2',
          size: '10',
          sort: 'capacity',
          direction: 'desc',
        }),
      ),
    ).toEqual({
      q: 'DEMO',
      active: 'false',
      page: 2,
      size: 10,
      sort: 'capacity',
      direction: 'desc',
    });
    expect(busQueryFromParams(convertToParamMap({ page: '10000', size: '100' })).page).toBe(10000);
    expect(busQueryFromParams(convertToParamMap({ size: '1' })).size).toBe(1);
  });

  it('uses defaults for missing, ambiguous, malformed or out-of-range values', () => {
    for (const params of [
      {},
      {
        q: 'x'.repeat(101),
        active: 'all',
        page: '-1',
        size: '0',
        sort: 'id',
        direction: 'sideways',
      },
      { page: '1.5', size: '101' },
      { page: '1e2', size: 'Infinity' },
      { page: '9007199254740992', size: '20x' },
      {
        q: ['first', 'second'],
        active: ['true', 'false'],
        page: ['1', '2'],
        size: ['10', '20'],
        sort: ['active', 'capacity'],
        direction: ['asc', 'desc'],
      },
    ])
      expect(busQueryFromParams(convertToParamMap(params))).toEqual(DEFAULT_BUS_QUERY);
  });

  it('round-trips Unicode and literal URL punctuation without encoding them twice', () => {
    const query: BusQuery = {
      q: 'حافلة & %_\\+?#= 01',
      active: 'true',
      page: 4,
      size: 50,
      sort: 'active',
      direction: 'desc',
    };
    expect(busQueryFromParams(convertToParamMap(busQueryParams(query)))).toEqual(query);
    expect(sameBusQuery(query, { ...query })).toBe(true);
    expect(sameBusQuery(query, { ...query, page: 0 })).toBe(false);
  });

  it('removes defaults when merging so stale filters and paging cannot remain in the URL', () => {
    expect(busQueryParams(DEFAULT_BUS_QUERY)).toEqual({
      q: null,
      active: null,
      page: null,
      size: null,
      sort: null,
      direction: null,
    });
  });
});
