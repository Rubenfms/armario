import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './ui/Layout';
import { HomePage } from './pages/HomePage';
import { WardrobePage } from './pages/WardrobePage';
import { OutfitsPage } from './pages/OutfitsPage';
import { GarmentPage } from './pages/GarmentPage';

/**
 * HashRouter a propósito: GitHub Pages no hace fallback de SPA, así que una
 * recarga en /armario/outfits daría 404. Con el hash todas las rutas viven
 * detrás de index.html.
 */
export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/armario" element={<WardrobePage />} />
          <Route path="/outfits" element={<OutfitsPage />} />
          <Route path="/prenda/:id" element={<GarmentPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
