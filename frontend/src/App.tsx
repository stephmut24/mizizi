import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { NotebookProvider } from './api/notebook';
import { Shell } from './components/Shell';
import { DataGate, EmptyState } from './components/NotebookUi';
import { Herbarium } from './pages/Herbarium';
import { PlantDetail } from './pages/PlantDetail';
import { PlantForm } from './pages/PlantForm';
import { Walks } from './pages/Walks';
import { People } from './pages/People';
import { PrintPage } from './pages/PrintPage';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/print/card/:id" element={<PrintPage kind="card" />} />
        <Route
          path="/print/booklet/:id"
          element={<PrintPage kind="booklet" />}
        />
        <Route
          path="/print/nextwalk/:id"
          element={<PrintPage kind="nextwalk" />}
        />
        <Route path="*" element={<Notebook />} />
      </Routes>
    </HashRouter>
  );
}

function Notebook() {
  return (
    <div className="notebook-screen">
      <NotebookProvider>
        <Shell>
          <DataGate>
            <Routes>
              <Route path="/" element={<Navigate to="/herbarium" replace />} />
              <Route path="/herbarium" element={<Herbarium />} />
              <Route path="/herbarium/new" element={<PlantForm />} />
              <Route path="/herbarium/:id/edit" element={<PlantForm />} />
              <Route path="/herbarium/:id" element={<PlantDetail />} />
              <Route path="/walks" element={<Walks />} />
              <Route path="/people" element={<People />} />
              <Route
                path="*"
                element={
                  <EmptyState
                    title="This page is not in the notebook"
                    to="/herbarium"
                    action="Back to Herbarium"
                  >
                    Choose Herbarium, Walks or People to keep exploring.
                  </EmptyState>
                }
              />
            </Routes>
          </DataGate>
        </Shell>
      </NotebookProvider>
    </div>
  );
}
