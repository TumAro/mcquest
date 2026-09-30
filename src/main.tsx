import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router'
import './styles.css'
import ResumeDialog from './components/ResumeDialog'
import { BrowseExams, BrowseYears } from './routes/Browse'
import Player from './routes/Player'
import Results from './routes/Results'
import Subject from './routes/Subject'
import Random from './routes/Random'
import YearConfig from './routes/YearConfig'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <ResumeDialog>
        <Routes>
          <Route path="/" element={<BrowseExams />} />
          <Route path="/exam/:slug" element={<BrowseYears />} />
          <Route path="/exam/:slug/:year/config" element={<YearConfig />} />
          <Route path="/exam/:slug/:year/play" element={<Player />} />
          <Route path="/exam/:slug/:year" element={<YearConfig />} />
          <Route path="/test/subject" element={<Subject />} />
          <Route path="/test/random" element={<Random />} />
          <Route path="/test/play" element={<Player />} />
          <Route path="/results/:id" element={<Results />} />
        </Routes>
      </ResumeDialog>
    </HashRouter>
  </StrictMode>,
)
