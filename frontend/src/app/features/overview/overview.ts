import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { Icon, IconName } from '../../shared/icon';
import { BusIllustration } from './bus-illustration';

@Component({
  selector: 'app-overview',
  imports: [MatButtonModule, MatCardModule, RouterLink, TranslocoDirective, Icon, BusIllustration],
  templateUrl: './overview.html',
  styleUrl: './overview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Overview {
  protected readonly features: { key: string; icon: IconName }[] = [
    { key: 'buses', icon: 'bus' },
    { key: 'routes', icon: 'route' },
    { key: 'trips', icon: 'pin' },
  ];
}
