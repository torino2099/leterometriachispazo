// Web Worker: calcula estadísticas sin bloquear la interfaz.
import { computeAll } from './stats-core.js';

self.onmessage = (e) => {
  const { id, draws } = e.data;
  try {
    self.postMessage({ id, result: computeAll(draws) });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
