const DrawService = require('./src/services/DrawService');

async function testHistory() {
    try {
        console.log('Fetching history...');
        // Mocking the environment if needed or DrawService handles it
        // DrawService uses db pool which loads env. ensuring it works.
        const history = await DrawService.getAllWinners();
        console.log(JSON.stringify(history, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

testHistory();
