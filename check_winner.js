const DrawService = require('./src/services/DrawService.js');

(async () => {
    const currentDraw = await DrawService.getCurrentDraw();

    if (!currentDraw) {
        console.log('Nenhuma rifa ativa');
        process.exit(0);
    }

    const winningNumber = await DrawService.getWeightedDrawResult(currentDraw.id);

    console.log(`Rifa #${currentDraw.id}: ${currentDraw.draw_name}`);
    console.log(`Número ganhador (menor número de compradores): ${winningNumber}`);

    process.exit(0);
})();
