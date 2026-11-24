import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { ThermalReceiptPrintPage } from './components/ThermalReceiptPrintPage.tsx';
import './index.css';
import { isThermalReceiptPrintRoute } from './utils/thermalReceiptUrl.ts';

const isThermalPrintTab = isThermalReceiptPrintRoute();

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    {isThermalPrintTab ? <ThermalReceiptPrintPage /> : <App />}
  </ErrorBoundary>,
);
