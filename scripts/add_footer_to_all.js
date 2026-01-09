const fs = require('fs');
const path = require('path');

const footerHTML = `
    <!-- IDSR Footer -->
    <footer class="idsr-footer">
        <div class="idsr-footer-content">
            <span class="idsr-footer-text">© 2026 IDSR. Todos os direitos reservados.</span>
            <span class="idsr-separator">|</span>
            <a href="https://idsr.com.br" target="_blank" rel="noopener noreferrer" class="idsr-link">
                Produzido e gerenciado por <strong>IDSR</strong>
            </a>
        </div>
    </footer>

    <style>
    .idsr-footer {
        width: 100%;
        padding: 15px 20px;
        background: rgba(0, 0, 0, 0.05);
        border-top: 1px solid rgba(0, 0, 0, 0.1);
        margin-top: 40px;
        text-align: center;
    }

    .idsr-footer-content {
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: 8px;
        font-size: 0.75rem;
        color: #666;
    }

    .idsr-footer-text {
        opacity: 0.7;
    }

    .idsr-separator {
        opacity: 0.3;
    }

    .idsr-link {
        color: #666;
        text-decoration: none;
        transition: all 0.2s ease;
        opacity: 0.8;
    }

    .idsr-link:hover {
        color: #000;
        opacity: 1;
    }

    .idsr-link strong {
        font-weight: 600;
        color: #d4af37;
    }

    @media (max-width: 600px) {
        .idsr-footer-content {
            font-size: 0.7rem;
            flex-direction: column;
            gap: 4px;
        }
        
        .idsr-separator {
            display: none;
        }
    }
    </style>
`;

const filesToUpdate = [
    'admin-amigos.html',
    'admin-hub.html',
    'admin-login.html',
    'admin-setup.html',
    'admin-zapao.html',
    'afiliado.html',
    'amigos-do-zapao.html',
    'meus-numeros.html'
    // zapao-da-sorte.html already updated manually
];

console.log('🔧 Adicionando footer IDSR em todas as páginas...\n');

filesToUpdate.forEach(file => {
    const filePath = path.join(__dirname, '..', 'public', file);

    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  ${file} - NÃO ENCONTRADO`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');

    // Check if footer already exists
    if (content.includes('IDSR Footer') || content.includes('idsr-footer')) {
        console.log(`✅ ${file} - JÁ TEM FOOTER`);
        return;
    }

    // Add footer before </body>
    content = content.replace('</body>', `${footerHTML}\n</body>`);

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${file} - FOOTER ADICIONADO`);
});

console.log('\n🎉 Concluído!');
