import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initRapier } from './core/physics/RapierInit';

initRapier().then(() => {
  createRoot(document.getElementById('root')!).render(<App />);
});
