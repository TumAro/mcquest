import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router'
import './styles.css'
import ResumeDialog from './components/ResumeDialog'
import { BrowseExams, BrowseYears } from './routes/Browse'
import Player from './routes/Player'
import Results from './routes/Results'
import Subject from './routes/Subject'
import Bookmarked from './routes/Bookmarked'
import Weakest from './routes/Weakest'
import Stats from './routes/Stats'
import YearConfig from './routes/YearConfig'
import { loadSettings } from './storage'
import { applyTheme } from './theme'

// Reconcile the attribute with the stored record in case the localStorage mirror is missing.
void loadSettings().then((s) => applyTheme(s.theme))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <ResumeDialog>
        <Routes>
          <Route path="/" element={<BrowseExams />} />
          <Route path="/exam/:slug" element={<BrowseYears />} />
          <Route path="/exam/:slug/:year/config" element={<YearConfig />} />
          <Route path="/test/subject" element={<Subject />} />
          <Route path="/test/bookmarked" element={<Bookmarked />} />
          <Route path="/test/weakest" element={<Weakest />} />
          <Route path="/test/play" element={<Player />} />
          <Route path="/results/:id" element={<Results />} />
          <Route path="/stats" element={<Stats />} />
        </Routes>
      </ResumeDialog>
    </HashRouter>
  </StrictMode>,
)
