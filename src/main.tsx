import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router'
import './styles.css'
import { BrowseExams, BrowseYears } from './routes/Browse'
import Player from './routes/Player'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<BrowseExams />} />
        <Route path="/exam/:slug" element={<BrowseYears />} />
        <Route path="/exam/:slug/:year" element={<Player />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
)
