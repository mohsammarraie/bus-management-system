import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-bus-illustration',
  templateUrl: './bus-illustration.html',
  styleUrl: './bus-illustration.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusIllustration {}
