import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FirebaseService } from './core/services/firebase.service';
import { AuthService } from './core/services/auth.service';
import { UserService } from './core/services/user.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'smartlibroai';

  constructor(
    private firebaseService: FirebaseService,
    private authService: AuthService,
    private userService: UserService
  ) { }

  async ngOnInit() {
    try {
      await this.firebaseService.initializeApp(this.authService, this.userService);

    } catch (error) {
      console.error('Failed to initialize app:', error);
    }
  }
}
