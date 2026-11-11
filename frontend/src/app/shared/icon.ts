import { ChangeDetectionStrategy, Component, input } from '@angular/core';

const paths = {
  bus: 'M5 17H4V5c0-2 16-2 16 0v12h-1M5 17h14M7 17v3M17 17v3M4 10h16M12 4v6M7 14h1M16 14h1',
  overview: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  route: 'M6 6h9a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h9M3 3h6v6H3zM16 19h5v4h-5z',
  pin: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0ZM9 10a3 3 0 1 0 6 0 3 3 0 0 0-6 0',
  settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
  arrow: 'M4 12h16M14 6l6 6-6 6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'm5 5 14 14M19 5 5 19',
  plus: 'M12 5v14M5 12h14',
  search: 'M21 21l-5-5M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  edit: 'M17 3a2.8 2.8 0 0 1 4 4L7 21H3v-4L17 3ZM15 5l4 4',
  delete: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2ZM7 3v6h10V3M7 21v-8h10v8',
  more: 'M13 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0M13 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0M13 19a1 1 0 1 1-2 0 1 1 0 0 1 2 0',
  refresh: 'M3 11a9 9 0 0 1 15.36-6.36L21 7M21 3v4h-4M21 13a9 9 0 0 1-15.36 6.36L3 17M7 17H3v4',
} as const;
export type IconName = keyof typeof paths;

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './icon.html',
  styleUrl: './icon.scss',
})
export class Icon {
  readonly name = input.required<IconName>();
  protected readonly paths = paths;
}
