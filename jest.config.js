module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.js'],
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/server.js' // Exclude server entry point
    ],
    coverageDirectory: 'coverage',
    verbose: true,
    testTimeout: 10000,
    // Don't run migrations or connect to real DB during tests
    setupFilesAfterEnv: ['./tests/setup.js']
};
