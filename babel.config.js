module.exports = function (api) {
  const isTest = api.env('test');
  // Cachear por entorno (test vs non-test), no globalmente
  api.cache.using(() => isTest);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Transform import.meta for web compatibility (not needed in test env)
          unstable_transformImportMeta: !isTest,
        },
      ],
    ],
    // react-native-worklets/plugin usa import.meta y no es compatible con Jest
    plugins: isTest ? [] : ['react-native-worklets/plugin'],
  };
};

