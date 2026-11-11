import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-loading-overlay',
  imports: [MatProgressSpinnerModule],
  templateUrl: './loading-overlay.html',
  styleUrl: './loading-overlay.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.active]': 'active()',
    '[attr.role]': 'active() && announce() ? "status" : null',
    '[attr.aria-live]': 'announce() ? "polite" : null',
    '[attr.aria-atomic]': 'announce() ? "true" : null',
    '[attr.aria-hidden]': 'announce() ? null : "true"',
  },
})
export class LoadingOverlay {
  readonly active = input.required<boolean>();
  readonly label = input.required<string>();
  // A caller with an existing live status can avoid announcing the same message twice.
  readonly announce = input(true);
}
