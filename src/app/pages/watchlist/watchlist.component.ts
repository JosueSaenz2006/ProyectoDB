import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WatchlistService } from '../../../services/watchlist.service';

@Component({
    selector: 'app-watchlist',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './watchlist.component.html',
    styleUrl: './watchlist.component.css'
})
export class WatchlistComponent {
    watchlistService = inject(WatchlistService);

    remove(id: number) {
        this.watchlistService.removeById(id);
    }
}
