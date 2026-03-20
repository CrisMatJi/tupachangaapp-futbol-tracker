/**
 * Parchea los globals lazy de Expo que no funcionan en el entorno Node de Jest.
 * Se ejecuta como setupFile (antes del framework de test).
 */

// structuredClone ya está disponible en Node 17+ pero definirlo explícitamente
// evita que Expo intente cargarlo con un require() fuera de contexto
if (!globalThis.structuredClone) {
  globalThis.structuredClone = (obj) => JSON.parse(JSON.stringify(obj))
}

// Parchar los getters de installGlobal que disparan runtime.native.ts
const lazies = [
  '__ExpoImportMetaRegistry',
  'structuredClone',
  'TextDecoder',
  'TextDecoderStream',
  'TextEncoderStream',
  'URL',
  'URLSearchParams',
  'ReadableStream',
]

lazies.forEach((name) => {
  if (!Object.getOwnPropertyDescriptor(globalThis, name)) {
    Object.defineProperty(globalThis, name, {
      value: undefined,
      writable: true,
      configurable: true,
    })
  }
})
