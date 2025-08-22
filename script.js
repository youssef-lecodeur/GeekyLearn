document.addEventListener('DOMContentLoaded', function() {
    // Chargement de la barre de navigation
    fetch('navbar.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('navbar').innerHTML = data;
            setupModalTriggers();
            setupAuthForms();
            checkLoginStatus(); // NOUVEAU: Vérifier si l'utilisateur est déjà connecté
        })
        .catch(error => console.error('Error loading navbar:', error));

    const modal = document.getElementById('auth-modal');
    const closeButton = document.querySelector('.close-button');
    const loginForm = document.getElementById('login-form-container');
    const registerForm = document.getElementById('register-form-container');

    function setupModalTriggers() {
        const loginLink = document.getElementById('login-link');
        const registerLink = document.getElementById('register-link');

        if (loginLink) {
            loginLink.addEventListener('click', (e) => {
                e.preventDefault();
                modal.style.display = 'block';
                loginForm.style.display = 'block';
                registerForm.style.display = 'none';
            });
        }

        if (registerLink) {
            registerLink.addEventListener('click', (e) => {
                e.preventDefault();
                modal.style.display = 'block';
                loginForm.style.display = 'none';
                registerForm.style.display = 'block';
            });
        }
    }

    // Fermer la modale
    if (closeButton) {
        closeButton.onclick = function() {
            modal.style.display = "none";
        }
    }
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    function setupAuthForms() {
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');

        if (loginForm) {
            loginForm.addEventListener('submit', function(e) {
                e.preventDefault();
                const formData = new FormData(this);
                const data = Object.fromEntries(formData.entries());

                fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                })
                .then(res => res.json())
                .then(response => {
                    if (response.success) {
                        sessionStorage.setItem('user', JSON.stringify(response.user));
                        // NOUVEAU: Rediriger vers le tableau de bord
                        window.location.href = 'dashboard.html';
                    } else {
                        alert(response.message);
                    }
                }).catch(err => console.error('Login error:', err));
            });
        }

        if (registerForm) {
            registerForm.addEventListener('submit', function(e) {
                e.preventDefault();
                // NOUVEAU: On envoie directement l'objet FormData
                const formData = new FormData(this);

                fetch('/register', {
                    method: 'POST',
                    // PAS de header 'Content-Type', le navigateur le gère pour multipart/form-data
                    body: formData 
                })
                .then(res => res.json())
                .then(response => {
                    alert(response.message);
                    if (response.success) {
                        document.getElementById('login-form-container').style.display = 'block';
                        document.getElementById('register-form-container').style.display = 'none';
                    }
                }).catch(err => console.error('Register error:', err));
            });
        }
    }

    function updateNavbarForLoggedInUser(user) {
        document.getElementById('nav-login').style.display = 'none';
        document.getElementById('nav-register').style.display = 'none';

        const userMenu = document.getElementById('user-menu');
        const userName = document.getElementById('user-name');
        // NOUVEAU: Mettre à jour la photo de profil
        const profilePic = document.getElementById('navbar-profile-pic');

        userName.textContent = `${user.prenom} ${user.nom}`;
        // Remplace les backslashes par des slashes pour les URL
        profilePic.src = user.profilePicPath.replace(/\\/g, "/"); 
        userMenu.style.display = 'list-item';

        document.getElementById('logout-link').addEventListener('click', (e) => {
            e.preventDefault();
            sessionStorage.removeItem('user');
            updateNavbarForLoggedOutUser();
        });
    }

    // NOUVEAU: Fonction pour réinitialiser la navbar
    function updateNavbarForLoggedOutUser() {
        document.getElementById('nav-login').style.display = 'list-item';
        document.getElementById('nav-register').style.display = 'list-item';
        document.getElementById('user-menu').style.display = 'none';
        // NOUVEAU: Réinitialiser l'image par défaut
        document.getElementById('navbar-profile-pic').src = 'plavatar.png';

        // NOUVEAU: Rediriger vers l'accueil si on se déconnecte
        if (window.location.pathname.includes('dashboard.html')) {
            window.location.href = 'accueil.html';
        }
    }

    // NOUVEAU: Fonction pour vérifier l'état de connexion au chargement
    function checkLoginStatus() {
        const userString = sessionStorage.getItem('user');
        if (userString) {
            const user = JSON.parse(userString);
            updateNavbarForLoggedInUser(user);

            // NOUVEAU: Mettre à jour le nom sur le tableau de bord s'il existe
            const dashboardUsername = document.getElementById('dashboard-username');
            if (dashboardUsername) {
                dashboardUsername.textContent = user.prenom;
            }
        } else {
            // NOUVEAU: Si on n'est pas connecté et qu'on essaie d'aller sur le dashboard, on redirige
            if (window.location.pathname.includes('dashboard.html')) {
                window.location.href = 'accueil.html';
            }
        }
    }

    const navLinks = document.querySelectorAll('nav ul li');

    navLinks.forEach(link => {
        link.addEventListener('mouseenter', function() {
            this.classList.add('hovered');
        });

        link.addEventListener('mouseleave', function() {
            this.classList.remove('hovered');
        });
    });

    // Gestion du menu déroulant sur mobile
    const dropdownArrow = document.getElementById('dropdown-arrow');
    if (dropdownArrow) {
        dropdownArrow.addEventListener('click', function(event) {
            event.preventDefault(); // Empêcher la navigation
            const parentLi = this.parentNode;
            const dropdownMenu = parentLi.querySelector('ul');
            if (dropdownMenu) {
                dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
            }
        });
    }

    // Attend que la navbar soit chargée
    function initThemeToggle() {
        const icon = document.getElementById('theme-icon');
        if (!icon) return;

        // Applique le thème sauvegardé
        let theme = localStorage.getItem('theme') || 'sombre';
        document.body.className = theme === 'clair' ? 'theme-clair' : 'theme-sombre';
        icon.src = theme === 'clair' ? 'sombre.png' : 'clair.png';

        icon.onclick = function () {
          if (document.body.className === 'theme-sombre') {
            document.body.className = 'theme-clair';
            icon.src = 'sombre.png';
            localStorage.setItem('theme', 'clair');
          } else {
            document.body.className = 'theme-sombre';
            icon.src = 'clair.png';
            localStorage.setItem('theme', 'sombre');
          }
        };
      }

      // Si la navbar est chargée dynamiquement, attends qu'elle soit là
      if (document.getElementById('theme-icon')) {
        initThemeToggle();
      } else {
        // Essaie plusieurs fois si besoin
        let tries = 0;
        const interval = setInterval(() => {
          if (document.getElementById('theme-icon')) {
            clearInterval(interval);
            initThemeToggle();
          }
          if (++tries > 20) clearInterval(interval);
        }, 100);
      }

      const arrow = document.getElementById('menu-arrow');
      const userMenu = document.getElementById('user-menu');
      if (arrow && userMenu) {
        let open = false;
        arrow.onclick = () => {
          open = !open;
          arrow.src = open ? 'flechemenu1.png' : 'flechemenu.png';
          const menuList = userMenu.querySelector('ul');
          if (menuList) menuList.style.display = open ? 'block' : 'none';
        };
      }

      // Nouveau code pour le changement d'icône flèche
      function updateArrowByTheme() {
        const arrow = document.getElementById('menu-arrow');
        if (!arrow) return;
        arrow.src = document.body.classList.contains('theme-clair') ? 'flechemenu1.png' : 'flechemenu.png';
      }

      document.addEventListener('DOMContentLoaded', () => {
        updateArrowByTheme();
        const themeIcon = document.getElementById('theme-icon');
        if (themeIcon) {
          themeIcon.addEventListener('click', () => {
            setTimeout(updateArrowByTheme, 0);
          });
        }
      });
});