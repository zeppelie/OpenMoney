import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-movements',
  imports: [MatCardModule],
  template: `
    <main class="page">
      <h1>Movimenti</h1>
      <mat-card appearance="outlined">
        <mat-card-content>
          <p class="muted">Ancora nessun movimento: conti, categorie e registrazioni arrivano con il prossimo passo.</p>
        </mat-card-content>
      </mat-card>
    </main>
  `,
})
export class Movements {}
