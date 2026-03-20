// Stub de expo/src/winter/installGlobal
// El original instala getters lazy que disparan require() de runtime.native
// dentro de la evaluación del setupFile, lo que Jest no permite.
// En tests, simplemente no instalamos nada — los tests unitarios no lo necesitan.
module.exports = {
  installGlobal: () => {},
  install: () => {},
}
