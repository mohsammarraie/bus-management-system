import { HttpErrorResponse } from '@angular/common/http';

export interface Bus {
  id: number;
  registrationNumber: string;
  capacity: number;
  active: boolean;
  version: number;
}
export type BusDraft = Pick<Bus, 'registrationNumber' | 'capacity' | 'active'>;
export type BusSort = 'registrationNumber' | 'capacity' | 'active';
export interface BusQuery {
  page: number;
  size: number;
  sort: BusSort;
  direction: 'asc' | 'desc';
  q: string;
  active: 'all' | 'true' | 'false';
}
export interface BusPage {
  content: Bus[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
export type BusCommand =
  | { kind: 'create'; draft: BusDraft }
  | { kind: 'update'; bus: Bus; draft: BusDraft }
  | { kind: 'delete'; bus: Bus };
export type BusDialogMode = 'create' | 'edit' | 'delete';
export interface BusDialogData {
  mode: BusDialogMode;
  id?: number;
}
export type BusErrorCode =
  | 'UNAVAILABLE'
  | 'INVALID_REQUEST'
  | 'VALIDATION_FAILED'
  | 'AUTHENTICATION_REQUIRED'
  | 'ACCESS_DENIED'
  | 'BUS_NOT_FOUND'
  | 'BUS_REGISTRATION_CONFLICT'
  | 'BUS_VERSION_CONFLICT'
  | 'BUS_IN_USE';
export interface BusFailure {
  code: BusErrorCode;
}

export const DEFAULT_BUS_QUERY: BusQuery = {
  page: 0,
  size: 20,
  sort: 'registrationNumber',
  direction: 'asc',
  q: '',
  active: 'all',
};

export function busFailure(error: unknown): BusFailure {
  const codes: BusErrorCode[] = [
    'INVALID_REQUEST',
    'VALIDATION_FAILED',
    'AUTHENTICATION_REQUIRED',
    'ACCESS_DENIED',
    'BUS_NOT_FOUND',
    'BUS_REGISTRATION_CONFLICT',
    'BUS_VERSION_CONFLICT',
    'BUS_IN_USE',
  ];
  if (error instanceof HttpErrorResponse) {
    const body: unknown = error.error;
    if (
      body &&
      typeof body === 'object' &&
      'code' in body &&
      codes.includes(body.code as BusErrorCode)
    ) {
      return { code: body.code as BusErrorCode };
    }
  }
  // Store only known display codes, never raw responses, exception objects or session data.
  return { code: 'UNAVAILABLE' };
}
