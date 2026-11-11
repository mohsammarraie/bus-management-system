import { createEntityAdapter, EntityState } from '@ngrx/entity';
import {
  createActionGroup,
  createFeature,
  createReducer,
  emptyProps,
  on,
  props,
} from '@ngrx/store';
import { Bus, BusCommand, BusFailure, BusPage, BusQuery, DEFAULT_BUS_QUERY } from './buses.models';

export const busesActions = createActionGroup({
  source: 'Buses',
  events: {
    'Page Opened': props<{ query: BusQuery }>(),
    'Page Left': emptyProps(),
    'Query Changed': props<{ query: BusQuery }>(),
    'Page Correction Requested': props<{ query: BusQuery }>(),
    'Refresh Requested': emptyProps(),
    'Load Succeeded': props<{ page: BusPage }>(),
    'Load Failed': props<{ error: BusFailure }>(),
    'Dialog Opened': props<{ bus: Bus | null }>(),
    'Dialog Closed': emptyProps(),
    'Save Requested': props<{ command: BusCommand }>(),
    'Save Succeeded': props<{ kind: BusCommand['kind'] }>(),
    'Save Failed': props<{ error: BusFailure }>(),
    'Latest Requested': props<{ id: number }>(),
    'Latest Loaded': props<{ bus: Bus }>(),
    'Latest Failed': props<{ error: BusFailure }>(),
  },
});

interface BusesState extends EntityState<Bus> {
  query: BusQuery;
  loading: boolean;
  error: BusFailure | null;
  total: number;
  selectedBus: Bus | null;
  mutation: 'idle' | 'saving' | 'reloading' | 'succeeded' | 'failed';
  mutationError: BusFailure | null;
}
const adapter = createEntityAdapter<Bus>();
const initialState: BusesState = adapter.getInitialState({
  query: DEFAULT_BUS_QUERY,
  loading: false,
  error: null,
  total: 0,
  selectedBus: null,
  mutation: 'idle',
  mutationError: null,
});
const loading = (state: BusesState): BusesState => ({ ...state, loading: true, error: null });

export const busesFeature = createFeature({
  name: 'buses',
  reducer: createReducer(
    initialState,
    on(busesActions.pageOpened, (_, { query }) => loading({ ...initialState, query })),
    on(busesActions.pageLeft, () => initialState),
    on(busesActions.queryChanged, (state, { query }) => loading({ ...state, query })),
    on(busesActions.refreshRequested, (state) => loading(state)),
    on(busesActions.loadSucceeded, (state, { page }) =>
      adapter.setAll(page.content, {
        ...state,
        total: page.totalElements,
        loading: false,
        error: null,
      }),
    ),
    on(busesActions.loadFailed, (state, { error }) =>
      adapter.removeAll({ ...state, loading: false, total: 0, error }),
    ),
    on(busesActions.dialogOpened, (state, { bus }) => ({
      ...state,
      selectedBus: bus,
      mutation: 'idle' as const,
      mutationError: null,
    })),
    on(busesActions.dialogClosed, (state) => ({
      ...state,
      selectedBus: null,
      mutation: 'idle' as const,
      mutationError: null,
    })),
    on(busesActions.saveRequested, (state) => ({
      ...state,
      mutation: 'saving' as const,
      mutationError: null,
    })),
    on(busesActions.saveSucceeded, (state) => loading({ ...state, mutation: 'succeeded' })),
    on(busesActions.saveFailed, busesActions.latestFailed, (state, { error }) => ({
      ...state,
      mutation: 'failed' as const,
      mutationError: error,
    })),
    on(busesActions.latestRequested, (state) => ({
      ...state,
      mutation: 'reloading' as const,
      mutationError: null,
    })),
    on(busesActions.latestLoaded, (state, { bus }) => ({
      ...state,
      selectedBus: bus,
      mutation: 'idle' as const,
      mutationError: null,
    })),
  ),
  extraSelectors: ({ selectBusesState }) => ({
    selectRows: adapter.getSelectors(selectBusesState).selectAll,
  }),
});
