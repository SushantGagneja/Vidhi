
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { CaseProvider } from './context/CaseContext.jsx'
import Layout from './layout/Layout.jsx'
import LandingPage from './pages/LandingPage.jsx'
import ConsentPage from './pages/ConsentPage.jsx'
import CapturePage from './pages/CapturePage.jsx'
import NeuralPage from './pages/NeuralPage.jsx'
import TimelinePage from './pages/TimelinePage.jsx'
import LegalPage from './pages/LegalPage.jsx'
import OutputPage from './pages/OutputPage.jsx'
import StorySegmentsPage from './pages/StorySegmentsPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <CaseProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/consent" element={<ConsentPage />} />
            <Route path="/interview" element={<CapturePage />} />
            <Route path="/neural" element={<NeuralPage />} />
            <Route path="/inference" element={<TimelinePage />} />
            <Route path="/story" element={<StorySegmentsPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/legal" element={<LegalPage />} />
            <Route path="/output" element={<OutputPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </CaseProvider>
    </BrowserRouter>
  )
}
