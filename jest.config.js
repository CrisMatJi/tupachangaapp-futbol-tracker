/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // Stub the expo winter runtime subsystem entirely.
    // jest-expo's setup.js does require('expo/src/winter'), which resolves to
    // runtime.native.ts (platform=ios), which installs lazy getters that call
    // require() inside closures — Jest rejects this as out-of-scope imports.
    '^expo/src/winter$': '<rootDir>/__tests__/__mocks__/expoWinterRuntime.js',
    '^expo/src/winter/': '<rootDir>/__tests__/__mocks__/expoWinterRuntime.js',
  },
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/setup/', '/__tests__/__mocks__/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
}
