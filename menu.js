// menu.js - Стильное меню внизу
document.addEventListener('DOMContentLoaded', function() {
    const menuHTML = `
        <div class="footer-menu">
            <div class="menu-container">
                <div class="menu-header">
                    <div class="avatar-container">
                        <img src="assets/avatar.png" alt="Аватар" class="avatar" id="customAvatar">
                        <div class="avatar-overlay" id="avatarUploadBtn">
                            <span>✏️</span>
                        </div>
                    </div>
                    <div class="user-info">
                        <h3 id="username">Advanced Search</h3>
                        <p>🔍 Поиск по большим файлам</p>
                    </div>
                </div>
                
                <div class="social-links">
                    <div class="link-item" data-link="https://t.me/">
                        <div class="link-icon" style="background: #0088cc;">
                            <span>📢</span>
                        </div>
                        <div class="link-content">
                            <input type="text" class="link-input" placeholder="Введите ссылку Telegram" value="https://t.me/">
                            <button class="go-btn" data-link="https://t.me/">Перейти</button>
                        </div>
                    </div>
                    
                    <div class="link-item" data-link="https://discord.gg/">
                        <div class="link-icon" style="background: #5865F2;">
                            <span>💬</span>
                        </div>
                        <div class="link-content">
                            <input type="text" class="link-input" placeholder="Введите ссылку Discord" value="https://discord.gg/">
                            <button class="go-btn" data-link="https://discord.gg/">Перейти</button>
                        </div>
                    </div>
                    
                    <div class="link-item" data-link="https://github.com/">
                        <div class="link-icon" style="background: #333;">
                            <span>💻</span>
                        </div>
                        <div class="link-content">
                            <input type="text" class="link-input" placeholder="Введите ссылку GitHub" value="https://github.com/">
                            <button class="go-btn" data-link="https://github.com/">Перейти</button>
                        </div>
                    </div>
                    
                    <div class="link-item" data-link="mailto:example@mail.com">
                        <div class="link-icon" style="background: #ea4335;">
                            <span>📧</span>
                        </div>
                        <div class="link-content">
                            <input type="text" class="link-input" placeholder="Введите email" value="mailto:example@mail.com">
                            <button class="go-btn" data-link="mailto:example@mail.com">Написать</button>
                        </div>
                    </div>
                </div>
                
                <div class="menu-footer">
                    <button id="settingsBtn" class="menu-btn">
                        <span>⚙️</span> Настройки
                    </button>
                    <button id="themeBtn" class="menu-btn">
                        <span>🌙</span> Тема
                    </button>
                    <button id="hideMenuBtn" class="menu-btn">
                        <span>👇</span> Скрыть меню
                    </button>
                </div>
            </div>
            
            <div class="menu-toggle" id="menuToggle">
                <span>☰</span> Меню
            </div>
        </div>
        
        <div id="avatarModal" class="modal">
            <div class="modal-content">
                <h3>📷 Загрузите свою аватарку</h3>
                <p>Выберите изображение для вашего профиля</p>
                
                <div class="avatar-upload-area" id="avatarUploadArea">
                    <span style="font-size: 3rem;">📁</span>
                    <p>Перетащите сюда изображение</p>
                    <p style="font-size: 0.9rem; opacity: 0.7;">или кликните для выбора</p>
                    <input type="file" id="avatarFileInput" accept="image/*" style="display: none;">
                </div>
                
                <div class="modal-buttons">
                    <button id="cancelAvatarBtn" class="btn">Отмена</button>
                    <button id="saveAvatarBtn" class="btn btn-primary">Сохранить</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', menuHTML);
    
    const menuToggle = document.getElementById('menuToggle');
    const footerMenu = document.querySelector('.footer-menu');
    const hideMenuBtn = document.getElementById('hideMenuBtn');
    const goBtns = document.querySelectorAll('.go-btn');
    const avatarUploadBtn = document.getElementById('avatarUploadBtn');
    const avatarModal = document.getElementById('avatarModal');
    const avatarFileInput = document.getElementById('avatarFileInput');
    const avatarUploadArea = document.getElementById('avatarUploadArea');
    const cancelAvatarBtn = document.getElementById('cancelAvatarBtn');
    const saveAvatarBtn = document.getElementById('saveAvatarBtn');
    const customAvatar = document.getElementById('customAvatar');
    
    menuToggle.addEventListener('click', function() {
        footerMenu.classList.toggle('expanded');
        menuToggle.classList.toggle('active');
    });
    
    hideMenuBtn.addEventListener('click', function() {
        footerMenu.classList.remove('expanded');
        menuToggle.classList.remove('active');
    });
    
    goBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const link = this.getAttribute('data-link');
            const input = this.parentElement.querySelector('.link-input');
            const url = input.value.trim();
            
            if (url) {
                const fullUrl = url.startsWith('http') ? url : `https://${url}`;
                window.open(fullUrl, '_blank');
            }
        });
    });
    
    document.querySelectorAll('.link-input').forEach(input => {
        input.addEventListener('change', function() {
            const btn = this.nextElementSibling;
            btn.setAttribute('data-link', this.value);
        });
    });
    
    avatarUploadBtn.addEventListener('click', function() {
        avatarModal.style.display = 'block';
    });
    
    avatarUploadArea.addEventListener('click', function() {
        avatarFileInput.click();
    });
    
    avatarFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                customAvatar.src = e.target.result;
                localStorage.setItem('customAvatar', e.target.result);
            };
            reader.readAsDataURL(file);
        }
    });
    
    cancelAvatarBtn.addEventListener('click', function() {
        avatarModal.style.display = 'none';
    });
    
    saveAvatarBtn.addEventListener('click', function() {
        avatarModal.style.display = 'none';
        showNotification('Аватарка сохранена!', 'success');
    });
    
    window.addEventListener('click', function(e) {
        if (e.target === avatarModal) {
            avatarModal.style.display = 'none';
        }
    });
    
    const savedAvatar = localStorage.getItem('customAvatar');
    if (savedAvatar) {
        customAvatar.src = savedAvatar;
    }
    
    function showNotification(text, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = text;
        notification.style.cssText = `
            position: fixed;
            bottom: 100px;
            right: 20px;
            background: rgba(26, 26, 46, 0.95);
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            border-left: 4px solid #8a8aff;
            z-index: 10000;
            backdrop-filter: blur(10px);
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
});
